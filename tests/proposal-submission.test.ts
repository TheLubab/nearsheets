import { describe, expect, it, vi } from "vitest";
import type { ActionDraft } from "../src/features/treasury/model/action-draft";
import { draftId } from "../src/features/treasury/model/action-draft";
import {
  buildTransferProposalCall,
  buildVoteCall,
  checkSubmission,
  parseProposalId,
  parseTransactionOutcome,
  submissionBlocker,
  submissionEligibility,
  submissionKey,
  validateSubmissionRecord,
  withAttemptStarted,
  withNotSubmitted,
  withOutcome,
  withReconciledProposal,
} from "../src/features/treasury/model/proposal-submissions";
import type { SubmissionRecord } from "../src/features/treasury/model/proposal-submissions";
import {
  parseTreasuryPolicy,
  parseTreasuryProposals,
} from "../src/features/treasury/model/treasury-reads";
import { createProposalSubmitter } from "../src/features/treasury/application/proposal-submitter";
import { WalletCancelledError } from "../src/integrations/wallet/gateway";

const TREASURY = { network: "testnet" as const, accountId: "dao.testnet" };

const POLICY_RAW = {
  roles: [
    { name: "all", kind: { Everyone: {} }, permissions: ["*:AddProposal"], vote_policy: {} },
    {
      name: "council",
      kind: { Group: ["alice.testnet"] },
      permissions: ["*:*"],
      vote_policy: {},
    },
  ],
  default_vote_policy: {
    weight_kind: "RoleWeight",
    quorum: "0",
    threshold: { Ratio: [1, 2] },
  },
  proposal_bond: "1000000000000000000000000",
  proposal_period: "604800000000000",
};

function policy() {
  const parsed = parseTreasuryPolicy(POLICY_RAW);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

function draft(overrides: Partial<ActionDraft> = {}): ActionDraft {
  const base: ActionDraft = {
    id: draftId("near-transfer", TREASURY, "INV-1"),
    kind: "near-transfer",
    treasury: TREASURY,
    reference: "INV-1",
    asset: { assetId: "near", symbol: "NEAR", decimals: 24 },
    amount: { display: "30", baseUnits: "30000000000000000000000000", decimals: 24 },
    recipient: "sara.testnet",
    memo: "Design",
    intents: null,
  };
  return { ...base, ...overrides };
}

function proposal(id: number, amount = "30000000000000000000000000", submittedAt = "2026-11-11T10:00:00.000Z") {
  const parsed = parseTreasuryProposals([
    {
      id,
      proposer: "alice.testnet",
      description: "INV-1: 30 NEAR to sara.testnet",
      status: "InProgress",
      submission_time: String(BigInt(Date.parse(submittedAt)) * 1_000_000n),
      kind: {
        Transfer: {
          token_id: "",
          receiver_id: "sara.testnet",
          amount,
          msg: null,
        },
      },
    },
  ]);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value[0]!;
}

const SUCCESS = {
  transaction: { hash: "Hash123" },
  status: { SuccessValue: Buffer.from("7").toString("base64") },
};

describe("proposal call building", () => {
  it("attaches the policy bond exactly and proposes native NEAR", () => {
    const built = buildTransferProposalCall(draft(), TREASURY, policy());
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    // The contract asserts an exact bond, so it must not be re-derived.
    expect(built.call.depositBaseUnits).toBe("1000000000000000000000000");
    expect(built.call.method).toBe("add_proposal");
    expect(built.call.args).toMatchObject({
      proposal: {
        kind: {
          Transfer: {
            token_id: "",
            receiver_id: "sara.testnet",
            amount: "30000000000000000000000000",
            msg: null,
          },
        },
      },
    });
  });

  it("refuses an Intents draft instead of proposing a NEAR transfer", () => {
    const intents = draft({
      kind: "intents-delivery",
      asset: { assetId: "nep141:usdc.near", symbol: "USDC", decimals: 6 },
      intents: {
        stage: "planned",
        provider: null,
        quoteExpiresAt: null,
        quoteOriginBaseUnits: null,
        quoteDestinationBaseUnits: null,
        feeBaseUnits: null,
        refundAccountId: null,
      },
    });
    const built = buildTransferProposalCall(intents, TREASURY, policy());
    expect(built.ok).toBe(false);
  });

  it("refuses a draft belonging to another treasury", () => {
    const built = buildTransferProposalCall(
      draft(),
      { network: "testnet", accountId: "other.testnet" },
      policy(),
    );
    expect(built.ok).toBe(false);
  });

  it("echoes the contract's stored kind when voting", () => {
    const stored = proposal(3);
    const vote = buildVoteCall(TREASURY, stored, "VoteApprove");
    expect(vote.ok).toBe(true);
    if (!vote.ok) {
      return;
    }
    // `act_proposal` asserts the kind matches exactly (ERR_WRONG_KIND).
    expect(vote.call.args).toMatchObject({ id: 3, action: "VoteApprove" });
    expect((vote.call.args as { proposal: unknown }).proposal).toEqual({
      Transfer: {
        token_id: "",
        receiver_id: "sara.testnet",
        amount: "30000000000000000000000000",
        msg: null,
      },
    });
    expect(vote.call.depositBaseUnits).toBe("0");
  });

  it("will not vote on a proposal whose kind was not read", () => {
    const vote = buildVoteCall(
      TREASURY,
      { id: 3, kindJson: null },
      "VoteApprove",
    );
    expect(vote.ok).toBe(false);
  });
});

describe("transaction outcome parsing", () => {
  it("reads a proposal id from the decoded return value", () => {
    const outcome = parseTransactionOutcome(SUCCESS);
    expect(outcome.kind).toBe("success");
    expect(outcome.transactionHash).toBe("Hash123");
    expect(parseProposalId(outcome.returnValue)).toBe(7);
  });

  it("extracts a contract failure message", () => {
    const outcome = parseTransactionOutcome({
      transaction: { hash: "HashFail" },
      status: {
        Failure: {
          ActionError: {
            kind: { FunctionCallError: { ExecutionError: "ERR_PERMISSION_DENIED" } },
          },
        },
      },
    });
    expect(outcome.kind).toBe("failure");
    expect(outcome.message).toContain("ERR_PERMISSION_DENIED");
  });

  it("treats an unrecognised payload as unknown, not success", () => {
    expect(parseTransactionOutcome({ transaction: {} }).kind).toBe("unknown");
    expect(parseTransactionOutcome(undefined).kind).toBe("unknown");
    expect(parseTransactionOutcome({ status: {} }).kind).toBe("unknown");
  });

  it("rejects a non-numeric proposal id", () => {
    expect(parseProposalId("")).toBeNull();
    expect(parseProposalId("abc")).toBeNull();
    expect(parseProposalId('"12"')).toBe(12);
  });
});

describe("pre-flight checks and eligibility", () => {
  it("blocks submission without a connected account", () => {
    const checks = checkSubmission(draft(), policy(), null);
    expect(checks.blockers.join(" ")).toMatch(/Connect the wallet/);
  });

  it("blocks an account with no AddProposal permission", () => {
    const restricted = parseTreasuryPolicy({
      ...POLICY_RAW,
      roles: [
        { name: "all", kind: { Everyone: {} }, permissions: [], vote_policy: {} },
      ],
    });
    if (!restricted.ok) {
      throw new Error(restricted.error);
    }
    const checks = checkSubmission(draft(), restricted.value, "mallory.testnet");
    expect(checks.blockers.length).toBeGreaterThan(0);
  });

  it("warns instead of blocking when a token role could grant the action", () => {
    const tokenPolicy = parseTreasuryPolicy({
      ...POLICY_RAW,
      roles: [
        {
          name: "stakers",
          kind: { Member: "1000000000000000000000000" },
          permissions: ["transfer:AddProposal"],
          vote_policy: {},
        },
      ],
    });
    if (!tokenPolicy.ok) {
      throw new Error(tokenPolicy.error);
    }
    const checks = checkSubmission(draft(), tokenPolicy.value, "holder.testnet");
    expect(checks.blockers).toEqual([]);
    expect(checks.warnings.join(" ")).toMatch(/stakers/);
  });

  it("distinguishes a first attempt, a retry and an unclear attempt", () => {
    expect(submissionEligibility(null)).toBe("new");
    const base = withAttemptStarted(null, draft(), TREASURY, {
      at: "2026-11-11T10:00:00.000Z",
      submittedBy: "alice.testnet",
      lastProposalIdBefore: 3,
    });
    expect(submissionEligibility(base)).toBe("in-progress");
    expect(submissionBlocker(base)).toMatch(/already in flight/);

    const unclear = withOutcome(
      base,
      { kind: "unknown", transactionHash: null, returnValue: null, message: "timeout" },
      { at: "2026-11-11T10:01:00.000Z" },
    );
    expect(submissionEligibility(unclear)).toBe("needs-reconcile");
    expect(submissionBlocker(unclear)).toMatch(/Reconcile/);

    const refused = withNotSubmitted(unclear, {
      at: "2026-11-11T10:02:00.000Z",
      message: "User rejected",
    });
    expect(submissionEligibility(refused)).toBe("retry");
    expect(submissionBlocker(refused)).toBeNull();
  });

  it("does not treat a success without an id as submitted", () => {
    const base = withAttemptStarted(null, draft(), TREASURY, {
      at: "2026-11-11T10:00:00.000Z",
      submittedBy: "alice.testnet",
      lastProposalIdBefore: 3,
    });
    const record = withOutcome(
      base,
      { kind: "success", transactionHash: "h", returnValue: null, message: null },
      { at: "2026-11-11T10:01:00.000Z" },
    );
    expect(record.status).toBe("unknown");
    expect(record.proposalId).toBeNull();
  });
});

describe("proposal submitter", () => {
  function record(): SubmissionRecord {
    return {
      key: submissionKey(TREASURY, draft().id),
      treasury: TREASURY,
      draftId: draft().id,
      reference: "INV-1",
      recipient: "sara.testnet",
      amountBaseUnits: "30000000000000000000000000",
      status: "not-submitted",
      proposalId: null,
      lastProposalIdBefore: 3,
      submittedBy: "alice.testnet",
      attempts: [],
      updatedAt: "2026-11-11T10:00:00.000Z",
      note: null,
    };
  }

  function submitter(options: {
    sign: () => Promise<unknown>;
    proposals?: () => Promise<{ proposals: ReturnType<typeof proposal>[]; lastProposalId: number }>;
    lastProposalId?: number;
  }) {
    return createProposalSubmitter({
      sign: options.sign,
      readProposals:
        options.proposals ??
        (async () => ({ proposals: [], lastProposalId: 4 })),
      readLastProposalId: async () => options.lastProposalId ?? 3,
      now: () => new Date("2026-11-11T10:05:00.000Z"),
    });
  }

  it("records the proposal id from a successful call", async () => {
    const sign = vi.fn(async () => SUCCESS);
    const result = await submitter({ sign }).submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: null,
    });
    expect(result.ok).toBe(true);
    expect(sign).toHaveBeenCalledOnce();
    if (result.ok) {
      expect(result.record.status).toBe("submitted");
      expect(result.record.proposalId).toBe(7);
      expect(result.record.lastProposalIdBefore).toBe(3);
    }
  });

  it("refuses to submit a payment that already has a proposal", async () => {
    const sign = vi.fn(async () => SUCCESS);
    const existing = withReconciledProposal(
      record(),
      proposal(5),
      "2026-11-11T10:00:00.000Z",
    );
    const result = await submitter({ sign }).submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: existing,
    });
    expect(result.ok).toBe(false);
    // The critical invariant: a known submission is never signed again.
    expect(sign).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error).toMatch(/already has a submitted proposal/);
    }
  });

  it("does not retry an unclear attempt until it is reconciled", async () => {
    const sign = vi.fn(async () => SUCCESS);
    const unclear = {
      ...record(),
      status: "unknown" as const,
      attempts: [
        {
          at: "2026-11-11T09:00:00.000Z",
          transactionHash: null,
          outcome: "unknown" as const,
          message: "timeout",
        },
      ],
    };
    const result = await submitter({ sign }).submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: unclear,
    });
    expect(result.ok).toBe(false);
    expect(sign).not.toHaveBeenCalled();
  });

  it("keeps a wallet cancellation retryable", async () => {
    const sign = vi.fn(async () => {
      throw new WalletCancelledError("User rejected the transaction.");
    });
    const result = await submitter({ sign }).submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.record?.status).toBe("not-submitted");
      expect(submissionBlocker(result.record ?? null)).toBeNull();
    }
  });

  it("keeps an unclassified error unsafe to retry", async () => {
    const sign = vi.fn(async () => {
      throw new Error("Network request failed");
    });
    const result = await submitter({ sign }).submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.record?.status).toBe("unknown");
      expect(submissionBlocker(result.record ?? null)).toMatch(/Reconcile/);
    }
  });

  it("reconciles an unclear result against a proposal that now exists", async () => {
    const sign = vi.fn(async () => ({
      transaction: {},
      status: {},
    }));
    const result = await submitter({
      sign,
      proposals: async () => ({ proposals: [proposal(4)], lastProposalId: 5 }),
    }).submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.status).toBe("submitted");
      expect(result.record.proposalId).toBe(4);
    }
  });

  it("does not adopt a proposal below the recorded floor", async () => {
    const sign = vi.fn(async () => ({ transaction: {}, status: {} }));
    const result = await submitter({
      sign,
      proposals: async () => ({
        proposals: [proposal(2)],
        lastProposalId: 5,
      }),
    }).submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.record?.status).toBe("not-submitted");
    }
  });

  it("never signs when the proposal count cannot be read", async () => {
    const sign = vi.fn(async () => SUCCESS);
    const created = createProposalSubmitter({
      sign,
      readProposals: async () => ({ proposals: [], lastProposalId: 4 }),
      readLastProposalId: async () => {
        throw new Error("RPC unavailable");
      },
    });
    const result = await created.submit({
      draft: draft(),
      treasury: TREASURY,
      policy: policy(),
      accountId: "alice.testnet",
      record: null,
    });
    expect(result.ok).toBe(false);
    // Without a floor, reconciliation could not recognise the proposal later,
    // so nothing may be signed.
    expect(sign).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error).toMatch(/proposal count could not be read/);
    }
  });
});

describe("stored submission records", () => {
  it("accepts a well-formed record", () => {
    const key = submissionKey(TREASURY, draft().id);
    const validated = validateSubmissionRecord({
      key,
      treasury: TREASURY,
      draftId: draft().id,
      reference: "INV-1",
      recipient: "sara.testnet",
      amountBaseUnits: "1",
      status: "submitted",
      proposalId: 3,
      lastProposalIdBefore: 2,
      submittedBy: "alice.testnet",
      attempts: [],
      updatedAt: "2026-11-11T10:00:00.000Z",
      note: null,
    });
    expect(validated.ok).toBe(true);
  });

  it("rejects a submitted record that names no proposal", () => {
    const key = submissionKey(TREASURY, draft().id);
    const validated = validateSubmissionRecord({
      key,
      treasury: TREASURY,
      draftId: draft().id,
      reference: "INV-1",
      recipient: "sara.testnet",
      amountBaseUnits: "1",
      status: "submitted",
      proposalId: null,
      lastProposalIdBefore: 2,
      submittedBy: null,
      attempts: [],
      updatedAt: "2026-11-11T10:00:00.000Z",
      note: null,
    });
    expect(validated.ok).toBe(false);
  });

  it("rejects a record whose key was swapped to hide a duplicate", () => {
    const validated = validateSubmissionRecord({
      key: "testnet|other.testnet|draft_0000000000000000",
      treasury: TREASURY,
      draftId: draft().id,
      reference: "INV-1",
      recipient: "sara.testnet",
      amountBaseUnits: "1",
      status: "failed",
      proposalId: null,
      lastProposalIdBefore: null,
      submittedBy: null,
      attempts: [],
      updatedAt: "2026-11-11T10:00:00.000Z",
      note: null,
    });
    expect(validated.ok).toBe(false);
  });
});