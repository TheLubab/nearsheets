import { z } from "zod";
import type { TreasuryMetadata } from "../../documents/model/document-envelope";
import type { ExactAmount } from "./exact-amount";
import { NEAR_DECIMALS, parseExactAmount } from "./exact-amount";
import { checkNearAccountId } from "./near-account";

/**
 * Typed action drafts.
 *
 * A draft describes an intended treasury action in exactly enough detail to
 * preview and submit it later. It is data, never an instruction: nothing in
 * this module signs, submits, quotes or contacts a network.
 *
 * Identity: a draft's id derives from the treasury identity, the action kind
 * and the row's stable `reference` (an invoice or purchase-order number), not
 * from a cell coordinate. Inserting a row therefore never changes which
 * payment a stored proposal reference belongs to.
 */

export const ACTION_DRAFT_KIND = {
  /** Native or fungible-token transfer from the treasury. */
  transfer: "near-transfer",
  /** Cross-chain or cross-asset delivery prepared through NEAR Intents. */
  intents: "intents-delivery",
} as const;

export type ActionDraftKind =
  (typeof ACTION_DRAFT_KIND)[keyof typeof ACTION_DRAFT_KIND];

/**
 * NEAR Intents work is staged. A draft records the stage it reached so a later
 * task can compare an approved quote against a fresh one instead of silently
 * refreshing it after DAO approval.
 */
export const INTENTS_STAGE = {
  /** No quote requested yet. */
  planned: "planned",
  /** A quote was requested and is recorded on the draft. */
  quoted: "quoted",
  /** The quote is known to be unusable (expired or superseded). */
  stale: "stale",
  /** A deposit or settlement was submitted and awaits confirmation. */
  pending: "pending",
  /** Reached the destination. */
  settled: "settled",
  /** Refunded or failed and recorded as such. */
  refunded: "refunded",
} as const;

export type IntentsStage = (typeof INTENTS_STAGE)[keyof typeof INTENTS_STAGE];

export interface AssetIdentity {
  /**
   * Authoritative asset id. For Intents this is the provider's `assetId`
   * (for example `nep141:wrap.near`); it is never constructed by hand.
   */
  assetId: string;
  /** Display symbol recorded for human review, not used to identify the asset. */
  symbol: string;
  /** Smallest-unit precision of `assetId`. */
  decimals: number;
}

/** Recorded quote and route details. All fields are data from a provider. */
export interface IntentsPlan {
  stage: IntentsStage;
  /** Provider/route identity, once a quote exists. */
  provider: string | null;
  /** ISO timestamp after which the quote must not be funded. */
  quoteExpiresAt: string | null;
  /** Quoted origin amount in base units, as an integer string. */
  quoteOriginBaseUnits: string | null;
  /** Quoted destination amount in base units, as an integer string. */
  quoteDestinationBaseUnits: string | null;
  /** Total fee in origin base units, as an integer string. */
  feeBaseUnits: string | null;
  /** Where a refund would be sent. */
  refundAccountId: string | null;
}

export interface ActionDraft {
  /** Stable, content-derived identity. See `draftId`. */
  id: string;
  kind: ActionDraftKind;
  /** Treasury and network the action belongs to. */
  treasury: TreasuryMetadata;
  /** Stable author-supplied reference, unique within a document. */
  reference: string;
  /** Asset being spent. */
  asset: AssetIdentity;
  /** Exact amount in the token's base units. */
  amount: ExactAmount;
  /** Destination NEAR account. */
  recipient: string;
  /** Free-text purpose copied from the sheet. */
  memo: string;
  /**
   * Intents staging data. `null` for a plain transfer; always present for an
   * `intents-delivery` draft so later tasks never have to invent a stage.
   */
  intents: IntentsPlan | null;
}

/**
 * Deterministic 64-bit FNV-1a hash rendered as 16 hex characters.
 *
 * Used for identity, not for cryptographic integrity: collisions are checked
 * against the live draft set, so a clash is reported rather than trusted.
 */
function stableHash(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const char of input) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * Builds a draft id from the treasury identity, kind and reference.
 *
 * The sheet and row are deliberately absent. Renaming a sheet, sorting rows or
 * inserting a row cannot move a payment to a different id.
 */
export function draftId(
  kind: ActionDraftKind,
  treasury: TreasuryMetadata,
  reference: string,
): string {
  return `draft_${stableHash(
    `${kind}|${treasury.network}|${treasury.accountId ?? "-"}|${reference.trim()}`,
  )}`;
}

/**
 * Same identity, computed from plain strings.
 *
 * The `TREZU_DRAFT` spreadsheet formula cannot call into this module (formula
 * evaluation must not depend on storage or UI), so both paths must agree on one
 * format. They are checked against each other in the test suite.
 */
export function draftIdFromParts(
  kind: string,
  network: string,
  treasuryAccountId: string,
  reference: string,
): string | null {
  if (kind !== "near-transfer" && kind !== "intents-delivery") {
    return null;
  }
  if (network !== "mainnet" && network !== "testnet") {
    return null;
  }
  const account = treasuryAccountId.trim();
  const ref = reference.trim();
  if (account.length === 0 || ref.length === 0) {
    return null;
  }
  return `draft_${stableHash(`${kind}|${network}|${account}|${ref}`)}`;
}

/** A stable, visible preview of a draft id, safe to show in a narrow column. */
export function shortDraftId(id: string): string {
  return id.replace(/^draft_/, "").slice(0, 8).toUpperCase();
}

export interface DraftIssue {
  /** Column or field the issue belongs to, when known. */
  field: string;
  message: string;
}

export interface DraftRowInput {
  /** 1-based row number in the sheet, for messages only. */
  rowNumber: number;
  reference: unknown;
  recipient: unknown;
  amount: unknown;
  /** `near` for native NEAR; a token contract id for anything else. */
  assetId: unknown;
  /**
   * Token precision. Optional for native NEAR (24) and required for every
   * other asset: guessing the decimals would silently change the amount.
   */
  decimals?: unknown;
  memo?: unknown;
  symbol?: unknown;
}

/** Native NEAR is the only asset whose precision this application may assume. */
export const NATIVE_NEAR_ASSET = "near";

export interface DraftValidationResult {
  draft: ActionDraft | null;
  issues: DraftIssue[];
}

/**
 * Validates one payment row and builds its draft.
 *
 * Returns issues instead of throwing so the sheet can show every problem in a
 * row at once. A draft is only produced when there are no blocking issues.
 */
export function draftFromRow(
  row: DraftRowInput,
  treasury: TreasuryMetadata,
): DraftValidationResult {
  const issues: DraftIssue[] = [];

  const reference =
    typeof row.reference === "string" ? row.reference.trim() : "";
  if (reference.length === 0) {
    issues.push({
      field: "reference",
      message: `Row ${row.rowNumber}: enter a payment reference. It is the row's stable identity.`,
    });
  } else if (reference.length > 64) {
    issues.push({
      field: "reference",
      message: `Row ${row.rowNumber}: a reference must be 64 characters or fewer.`,
    });
  }

  const recipient = checkNearAccountId(row.recipient);
  if (!recipient.ok) {
    issues.push({
      field: "recipient",
      message: `Row ${row.rowNumber}: ${recipient.reason ?? "invalid recipient."}`,
    });
  }

  const decimalsInput = row.decimals;
  const assetId = typeof row.assetId === "string" ? row.assetId.trim() : "";
  if (assetId.length === 0) {
    issues.push({
      field: "asset",
      message: `Row ${row.rowNumber}: enter the asset: near for native NEAR, or a token id such as nep141:wrap.near.`,
    });
  }

  const isNativeNear = assetId === NATIVE_NEAR_ASSET;
  let decimals: number | null = null;
  if (decimalsInput === undefined || decimalsInput === null || decimalsInput === "") {
    if (isNativeNear) {
      decimals = NEAR_DECIMALS;
    } else if (assetId.length > 0) {
      issues.push({
        field: "decimals",
        message: `Row ${row.rowNumber}: token precision is required for ${assetId}; it is not guessed.`,
      });
    }
  } else {
    const parsed = Number(decimalsInput);
    if (Number.isInteger(parsed) && parsed >= 0) {
      decimals = parsed;
    } else {
      issues.push({
        field: "decimals",
        message: `Row ${row.rowNumber}: token precision must be a whole number.`,
      });
    }
  }

  const amountResult = parseExactAmount(row.amount, decimals ?? -1);
  if (decimals !== null && !amountResult.ok) {
    issues.push({
      field: "amount",
      message: `Row ${row.rowNumber}: ${amountResult.message}`,
    });
  }

  if (issues.length > 0 || !amountResult.ok || !recipient.ok || decimals === null) {
    return { draft: null, issues };
  }

  const symbol =
    typeof row.symbol === "string" && row.symbol.trim().length > 0
      ? row.symbol.trim()
      : isNativeNear
        ? "NEAR"
        : assetId;
  const memo = typeof row.memo === "string" ? row.memo.trim() : "";

  // Native NEAR is a direct transfer. Intents asset ids are delivery drafts so
  // the route/quote stage is recorded from the start, even before a quote
  // exists.
  const kind: ActionDraftKind = isNativeNear
    ? ACTION_DRAFT_KIND.transfer
    : ACTION_DRAFT_KIND.intents;

  return {
    draft: {
      id: draftId(kind, treasury, reference),
      kind,
      treasury: { ...treasury },
      reference,
      asset: { assetId, symbol, decimals },
      amount: amountResult.amount,
      recipient: recipient.accountId,
      memo,
      intents:
        kind === ACTION_DRAFT_KIND.intents
          ? {
              stage: INTENTS_STAGE.planned,
              provider: null,
              quoteExpiresAt: null,
              quoteOriginBaseUnits: null,
              quoteDestinationBaseUnits: null,
              feeBaseUnits: null,
              refundAccountId: null,
            }
          : null,
    },
    issues: [],
  };
}

/* ------------------------------------------------------------------ */
/* Validation of drafts that come from outside this module (imports). */
/* ------------------------------------------------------------------ */

const isoInstant = z.iso.datetime();

const treasurySchema = z.object({
  network: z.enum(["mainnet", "testnet"]),
  accountId: z.string().min(1).nullable(),
});

const baseUnitString = z
  .string()
  .regex(/^\d+$/, "Expected an integer base-unit amount");

const actionDraftSchema = z.object({
  id: z.string().regex(/^draft_[0-9a-f]{16}$/),
  kind: z.enum(["near-transfer", "intents-delivery"]),
  treasury: treasurySchema,
  reference: z.string().trim().min(1).max(64),
  asset: z.object({
    assetId: z.string().trim().min(1),
    symbol: z.string().trim().min(1),
    decimals: z.number().int().min(0).max(24),
  }),
  amount: z.object({
    display: z.string().min(1),
    baseUnits: baseUnitString,
    decimals: z.number().int().min(0).max(24),
  }),
  recipient: z.string().trim().min(1),
  memo: z.string(),
  intents: z
    .object({
      stage: z.enum([
        "planned",
        "quoted",
        "stale",
        "pending",
        "settled",
        "refunded",
      ]),
      provider: z.string().nullable(),
      quoteExpiresAt: isoInstant.nullable(),
      quoteOriginBaseUnits: baseUnitString.nullable(),
      quoteDestinationBaseUnits: baseUnitString.nullable(),
      feeBaseUnits: baseUnitString.nullable(),
      refundAccountId: z.string().nullable(),
    })
    .nullable(),
});

/**
 * Validates an untrusted draft. A transfer must not carry Intents staging data,
 * and an Intents draft must carry a stage, so a later execution task cannot
 * receive a half-formed record.
 */
export function validateActionDraft(value: unknown):
  | { ok: true; draft: ActionDraft }
  | { ok: false; error: string } {
  const parsed = actionDraftSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Invalid draft at ${issue?.path.join(".") || "draft"}: ${
        issue?.message ?? "unexpected structure"
      }`,
    };
  }

  const draft = parsed.data as ActionDraft;
  if (draft.kind === "near-transfer" && draft.intents !== null) {
    return { ok: false, error: "A plain transfer cannot carry Intents staging data." };
  }
  if (draft.kind === "intents-delivery" && draft.intents === null) {
    return { ok: false, error: "An Intents draft must record its current stage." };
  }
  if (draft.id !== draftId(draft.kind, draft.treasury, draft.reference)) {
    return {
      ok: false,
      error: "The draft id does not match its treasury, kind and reference.",
    };
  }
  return { ok: true, draft };
}

/** Human-readable one-line summary for a preview list. */
export function describeDraft(draft: ActionDraft): string {
  return `${draft.amount.display} ${draft.asset.symbol} to ${draft.recipient}`;
}