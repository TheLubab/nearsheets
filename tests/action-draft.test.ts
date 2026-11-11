import { describe, expect, it } from "vitest";
import {
  ACTION_DRAFT_KIND,
  INTENTS_STAGE,
  draftFromRow,
  draftId,
  draftIdFromParts,
  shortDraftId,
  validateActionDraft,
} from "../src/features/treasury/model/action-draft";
import { checkNearAccountId } from "../src/features/treasury/model/near-account";

const treasury = { network: "testnet" as const, accountId: "dao.sputnikv2.testnet" };

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    rowNumber: 5,
    reference: "INV-42",
    recipient: "sara.near",
    amount: 30,
    assetId: "near",
    memo: "Design",
    ...overrides,
  };
}

describe("action drafts", () => {
  it("builds a transfer draft with exact base units", () => {
    const result = draftFromRow(validRow(), treasury);
    expect(result.issues).toEqual([]);
    expect(result.draft?.kind).toBe(ACTION_DRAFT_KIND.transfer);
    expect(result.draft?.amount.baseUnits).toBe("30000000000000000000000000");
    expect(result.draft?.recipient).toBe("sara.near");
    expect(result.draft?.intents).toBeNull();
  });

  it("keeps identity stable when the row moves", () => {
    const first = draftFromRow(validRow({ rowNumber: 5 }), treasury).draft;
    const moved = draftFromRow(validRow({ rowNumber: 90 }), treasury).draft;
    expect(first?.id).toBe(moved?.id);
  });

  it("changes identity when the reference changes", () => {
    const first = draftFromRow(validRow({ reference: "INV-42" }), treasury).draft;
    const second = draftFromRow(validRow({ reference: "INV-43" }), treasury).draft;
    expect(first?.id).not.toBe(second?.id);
  });

  it("keeps identity stable across sheet edits that do not touch the payment", () => {
    // Row number is not part of the identity, so moving the payment to another
    // row produces the same draft id.
    const atRowFive = draftFromRow(validRow({ rowNumber: 5 }), treasury).draft;
    const atRowHundred = draftFromRow(validRow({ rowNumber: 100 }), treasury).draft;
    expect(atRowFive?.id).toBe(atRowHundred?.id);
    expect(atRowFive?.id).toMatch(/^draft_[0-9a-f]{16}$/);
    expect(shortDraftId(atRowFive!.id)).toHaveLength(8);
  });

  it("scopes identity to the treasury, so the same reference is not shared", () => {
    const other = { network: "mainnet" as const, accountId: "dao.sputnikv2.near" };
    const a = draftFromRow(validRow(), treasury).draft;
    const b = draftFromRow(validRow(), other).draft;
    expect(a?.id).not.toBe(b?.id);
  });

  it("agrees with the spreadsheet formula identity", () => {
    const draft = draftFromRow(validRow(), treasury).draft;
    expect(
      draftIdFromParts("near-transfer", "testnet", "dao.sputnikv2.testnet", "INV-42"),
    ).toBe(draft?.id);
    expect(
      draftId(ACTION_DRAFT_KIND.transfer, treasury, "INV-42"),
    ).toBe(draft?.id);
  });

  it("starts Intents drafts at the planned stage with no invented quote", () => {
    const result = draftFromRow(
      validRow({ assetId: "nep141:wrap.near", decimals: 24, symbol: "wNEAR" }),
      treasury,
    );
    expect(result.draft?.kind).toBe(ACTION_DRAFT_KIND.intents);
    expect(result.draft?.intents).toMatchObject({
      stage: INTENTS_STAGE.planned,
      provider: null,
      quoteExpiresAt: null,
      quoteOriginBaseUnits: null,
      quoteDestinationBaseUnits: null,
    });
  });

  it("requires explicit precision for a non-NEAR asset", () => {
    const result = draftFromRow(validRow({ assetId: "nep141:usdc.near" }), treasury);
    expect(result.draft).toBeNull();
    expect(result.issues.map((issue) => issue.field)).toContain("decimals");
    expect(result.issues[0]?.message).toMatch(/precision is required/);
  });

  it("reports every blocking problem in one pass", () => {
    const result = draftFromRow(
      validRow({ reference: "  ", recipient: "Not An Account", amount: "lots" }),
      treasury,
    );
    expect(result.draft).toBeNull();
    const fields = result.issues.map((issue) => issue.field);
    expect(fields).toContain("reference");
    expect(fields).toContain("recipient");
    expect(fields).toContain("amount");
  });

  it("rejects a draft from outside whose id does not match its content", () => {
    const draft = draftFromRow(validRow(), treasury).draft!;
    const tampered = { ...draft, reference: "INV-999" };
    const result = validateActionDraft(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/does not match/);
    }
  });

  it("accepts a round-tripped draft", () => {
    const draft = draftFromRow(validRow(), treasury).draft!;
    const restored = validateActionDraft(JSON.parse(JSON.stringify(draft)));
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.draft.id).toBe(draft.id);
    }
  });

  it("rejects half-formed Intents records", () => {
    const draft = draftFromRow(
      validRow({ assetId: "nep141:wrap.near", decimals: 24 }),
      treasury,
    ).draft!;
    const result = validateActionDraft({ ...draft, intents: null });
    expect(result.ok).toBe(false);
  });

  it("rejects a plain transfer carrying Intents staging data", () => {
    const draft = draftFromRow(validRow(), treasury).draft!;
    const result = validateActionDraft({
      ...draft,
      intents: {
        stage: "quoted",
        provider: "1click",
        quoteExpiresAt: null,
        quoteOriginBaseUnits: null,
        quoteDestinationBaseUnits: null,
        feeBaseUnits: null,
        refundAccountId: null,
      },
    });
    expect(result.ok).toBe(false);
  });
});

describe("NEAR account ids", () => {
  it("accepts named and implicit accounts", () => {
    expect(checkNearAccountId("sara.near").ok).toBe(true);
    expect(checkNearAccountId("dao.sputnikv2.testnet").accountId).toBe(
      "dao.sputnikv2.testnet",
    );
    expect(checkNearAccountId("a".repeat(64)).ok).toBe(true);
    expect(checkNearAccountId("f".repeat(64)).ok).toBe(true);
  });

  it("normalizes case and trims whitespace", () => {
    expect(checkNearAccountId("  Sara.NEAR ").accountId).toBe("sara.near");
  });

  it("rejects malformed ids", () => {
    expect(checkNearAccountId("").ok).toBe(false);
    expect(checkNearAccountId("a").ok).toBe(false);
    expect(checkNearAccountId("has space.near").ok).toBe(false);
    expect(checkNearAccountId("-leading.near").ok).toBe(false);
    expect(checkNearAccountId("double..dot").ok).toBe(false);
    expect(checkNearAccountId("a".repeat(65)).ok).toBe(false);
    expect(checkNearAccountId(42).ok).toBe(false);
  });
});