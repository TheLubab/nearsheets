import { z } from "zod";
import type { ActionDraft } from "./action-draft";
import { NATIVE_NEAR_ASSET } from "./action-draft";
import type {
  TreasuryPolicy,
  TreasuryProposal,
  TreasuryTarget,
} from "./treasury-reads";
import { evaluatePermission } from "./treasury-reads";

/**
 * Sputnik proposal submission.
 *
 * Everything here is a pure calculation over already-validated data: it builds
 * contract call arguments, interprets a wallet's transaction outcome and keeps
 * a local submission record. No function in this module signs, sends or reads a
 * network by itself.
 *
 * Two rules come from the contract and shape the whole module:
 *
 * - `add_proposal` asserts `attached_deposit == policy.proposal_bond`, so the
 *   bond must be read before a proposal is built, never assumed.
 * - `act_proposal` re-checks `proposal.kind == stored kind` (`ERR_WRONG_KIND`)
 *   and rejects unknown arguments, so a vote must echo the exact kind the
 *   contract returns from `get_proposals`.
 *
 * Governance approval is not payment completion: a successful `act_proposal`
 * only means the DAO executed the proposal; the transfer itself is confirmed by
 * the proposal's own status and execution receipts.
 */

export const PROPOSAL_METHODS = {
  addProposal: "add_proposal",
  actProposal: "act_proposal",
} as const;

/** 150 TGas: enough for `add_proposal` plus the bond transfer. */
export const ADD_PROPOSAL_GAS = "150000000000000";

/** 300 TGas, matching the documented `act_proposal` approval example. */
export const ACT_PROPOSAL_GAS = "300000000000000";

export type VoteAction = "VoteApprove" | "VoteReject";

export interface ProposalCall {
  treasury: TreasuryTarget;
  method: string;
  args: Record<string, unknown>;
  /** Attached deposit in yoctoNEAR, exactly as the contract expects it. */
  depositBaseUnits: string;
  gas: string;
}

export type TransactionOutcomeKind = "success" | "failure" | "unknown";

export interface TransactionOutcome {
  kind: TransactionOutcomeKind;
  transactionHash: string | null;
  /** Decoded UTF-8 return value when the transaction succeeded. */
  returnValue: string | null;
  message: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64Utf8(value: string): string | null {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Pulls the most useful message out of a NEAR failure status. */
function describeFailure(failure: Record<string, unknown>): string {
  for (const key of ["ActionError", "Failure"]) {
    const nested = failure[key];
    if (isRecord(nested)) {
      const inner = describeFailure(nested);
      if (inner.length > 0) {
        return inner;
      }
    }
  }
  if (isRecord(failure.ActionError) && isRecord(failure.ActionError.kind)) {
    const kind = failure.ActionError.kind;
    const functionCall = kind.FunctionCallError;
    if (isRecord(functionCall)) {
      const execution = functionCall.ExecutionError;
      if (typeof execution === "string") {
        return execution;
      }
      if ("HostError" in functionCall) {
        return JSON.stringify(functionCall.HostError).slice(0, 300);
      }
    }
    return JSON.stringify(kind).slice(0, 300);
  }
  const serialized = JSON.stringify(failure);
  return serialized.length > 300 ? `${serialized.slice(0, 300)}…` : serialized;
}

/**
 * Interprets a wallet's `FinalExecutionOutcome`.
 *
 * Anything that does not clearly say "executed successfully" or "executed with
 * failure" is `unknown`: the caller must reconcile against the chain before
 * retrying, because a retry would otherwise risk a duplicate proposal.
 */
export function parseTransactionOutcome(raw: unknown): TransactionOutcome {
  const transactionHash =
    isRecord(raw) && isRecord(raw.transaction) && typeof raw.transaction.hash === "string"
      ? raw.transaction.hash
      : null;

  if (!isRecord(raw)) {
    return {
      kind: "unknown",
      transactionHash,
      returnValue: null,
      message: "The wallet did not return a transaction outcome.",
    };
  }

  const status = raw.status;
  if (!isRecord(status)) {
    return {
      kind: "unknown",
      transactionHash,
      returnValue: null,
      message: "The transaction outcome has no status.",
    };
  }

  if (typeof status.SuccessValue === "string") {
    return {
      kind: "success",
      transactionHash,
      returnValue: decodeBase64Utf8(status.SuccessValue),
      message: null,
    };
  }

  if (typeof status.SuccessReceiptId === "string") {
    return {
      kind: "success",
      transactionHash,
      returnValue: null,
      message: null,
    };
  }

  if (isRecord(status.Failure)) {
    return {
      kind: "failure",
      transactionHash,
      returnValue: null,
      message: describeFailure(status.Failure),
    };
  }

  return {
    kind: "unknown",
    transactionHash,
    returnValue: null,
    message: "The transaction outcome is neither success nor failure.",
  };
}

/**
 * Reads the `u64` proposal id `add_proposal` returns.
 *
 * The contract returns a JSON number encoded as the call's `SuccessValue`, so
 * the decoded string is parsed strictly instead of being trusted as text.
 */
export function parseProposalId(returnValue: string | null): number | null {
  if (returnValue === null) {
    return null;
  }
  const text = returnValue.trim().replace(/^"|"$/g, "");
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/** Human-readable description stored on the proposal (also the FT memo). */
export function describeProposal(draft: ActionDraft): string {
  const summary = `${draft.amount.display} ${draft.asset.symbol} to ${draft.recipient}`;
  const memo = draft.memo.trim();
  return memo.length > 0
    ? `${draft.reference}: ${summary} — ${memo}`
    : `${draft.reference}: ${summary}`;
}

export type ProposalBuildResult =
  | { ok: true; call: ProposalCall; description: string }
  | { ok: false; error: string };

/**
 * Builds `add_proposal` for one native-NEAR transfer.
 *
 * Other assets are Intents drafts and need an execution route that does not
 * exist yet; refusing here is better than proposing a mismatched transfer.
 */
export function buildTransferProposalCall(
  draft: ActionDraft,
  treasury: TreasuryTarget,
  policy: TreasuryPolicy,
): ProposalBuildResult {
  if (draft.kind !== "near-transfer") {
    return {
      ok: false,
      error:
        "This draft is an Intents delivery. Routes, quotes and deposits are a separate step, so it cannot be submitted as a DAO transfer.",
    };
  }
  if (draft.asset.assetId !== NATIVE_NEAR_ASSET) {
    return {
      ok: false,
      error: "Only native NEAR transfers can be submitted as a DAO transfer right now.",
    };
  }
  if (draft.treasury.accountId !== treasury.accountId) {
    return {
      ok: false,
      error: "The draft belongs to a different treasury than the selected one.",
    };
  }
  if (!/^\d+$/.test(policy.proposalBondBaseUnits)) {
    return { ok: false, error: "The policy bond is not a valid base-unit amount." };
  }

  const description = describeProposal(draft);
  return {
    ok: true,
    description,
    call: {
      treasury,
      method: PROPOSAL_METHODS.addProposal,
      // `token_id: ""` is the contract's convention for native NEAR.
      args: {
        proposal: {
          description,
          kind: {
            Transfer: {
              token_id: "",
              receiver_id: draft.recipient,
              amount: draft.amount.baseUnits,
              msg: null,
            },
          },
        },
      },
      // The contract requires the bond to match exactly.
      depositBaseUnits: policy.proposalBondBaseUnits,
      gas: ADD_PROPOSAL_GAS,
    },
  };
}

/**
 * Builds `act_proposal`, echoing the proposal kind the contract stored.
 *
 * Without the kind the contract rejects the call, so a proposal whose raw kind
 * was not read cannot be voted on from here.
 */
export function buildVoteCall(
  treasury: TreasuryTarget,
  proposal: Pick<TreasuryProposal, "id" | "kindJson">,
  action: VoteAction,
): ProposalBuildResult {
  if (proposal.kindJson === undefined || proposal.kindJson === null) {
    return {
      ok: false,
      error: "The proposal kind was not read, so the contract would reject this vote.",
    };
  }
  return {
    ok: true,
    description: `${action} on proposal #${proposal.id}`,
    call: {
      treasury,
      method: PROPOSAL_METHODS.actProposal,
      args: {
        id: proposal.id,
        action,
        proposal: proposal.kindJson,
        memo: null,
      },
      depositBaseUnits: "0",
      gas: ACT_PROPOSAL_GAS,
    },
  };
}

export interface SubmissionChecks {
  /** Conditions that make submission pointless or wrong. */
  blockers: string[];
  /** Conditions the DAO may still decide differently. */
  warnings: string[];
}

/**
 * Local pre-flight checks.
 *
 * These are advisory except where the contract or our own data makes the call
 * impossible; the DAO remains the authority on permissions.
 */
export function checkSubmission(
  draft: ActionDraft,
  policy: TreasuryPolicy,
  accountId: string | null,
): SubmissionChecks {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (draft.kind !== "near-transfer") {
    blockers.push(
      "Intents deliveries cannot be submitted yet: they need a quote, a deposit address and a refund path.",
    );
  }
  if (draft.treasury.accountId === null) {
    blockers.push("Save the treasury this document belongs to before proposing a payment.");
  }
  if (!accountId) {
    blockers.push("Connect the wallet that will create this proposal.");
  } else if (policy.roles.length > 0) {
    const permission = evaluatePermission(policy, accountId, "transfer", "AddProposal");
    if (!permission.allowed) {
      if (permission.unknownRoles.length > 0) {
        warnings.push(
          `Your permission to add a transfer proposal depends on the token-weighted role(s) ${permission.unknownRoles.join(", ")}, whose balance is not read. The DAO decides.`,
        );
      } else {
        blockers.push(
          `${accountId} has no role granting transfer:AddProposal in this treasury's policy.`,
        );
      }
    }
  }
  if (policy.proposalBondBaseUnits === "0") {
    warnings.push("This treasury has a zero proposal bond; the DAO may still require one.");
  }

  return { blockers, warnings };
}

/* ------------------------------------------------------------------ */
/* Local submission journal                                            */
/* ------------------------------------------------------------------ */

/**
 * Local, per-payment submission state.
 *
 * A payment's identity is content-derived (`draftId`), so the journal keys on
 * the treasury plus that id. The record is what makes a retry safe: an attempt
 * that might have reached the chain stays `unknown` until it is reconciled
 * against the treasury, and only `failed` or `not-submitted` may be retried.
 */
export const SUBMISSION_STATUS = {
  submitting: "submitting",
  submitted: "submitted",
  failed: "failed",
  unknown: "unknown",
  notSubmitted: "not-submitted",
} as const;

export type SubmissionStatus =
  (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];

export interface SubmissionAttempt {
  at: string;
  transactionHash: string | null;
  outcome: TransactionOutcomeKind;
  message: string | null;
}

export interface SubmissionRecord {
  /** `${network}|${treasury}|${draftId}`. */
  key: string;
  treasury: TreasuryTarget;
  draftId: string;
  reference: string;
  recipient: string;
  amountBaseUnits: string;
  status: SubmissionStatus;
  proposalId: number | null;
  /** Proposal count observed before the first attempt, used to reconcile. */
  lastProposalIdBefore: number | null;
  /** Wallet account that signed; recorded for audit, not for authorization. */
  submittedBy: string | null;
  attempts: SubmissionAttempt[];
  updatedAt: string;
  note: string | null;
}

export function submissionKey(
  treasury: TreasuryTarget,
  draftId: string,
): string {
  return `${treasury.network}|${treasury.accountId}|${draftId}`;
}

export function recordKeyForDraft(
  draft: ActionDraft,
  treasury: TreasuryTarget,
): string {
  return submissionKey(treasury, draft.id);
}

export type SubmissionEligibility =
  | "new"
  | "retry"
  | "in-progress"
  | "already-submitted"
  | "needs-reconcile";

/** True when the payment can be submitted (first time or as a retry). */
export function canSubmit(eligibility: SubmissionEligibility): boolean {
  return eligibility === "new" || eligibility === "retry";
}

export function submissionEligibility(
  record: SubmissionRecord | null,
): SubmissionEligibility {
  if (!record) {
    return "new";
  }
  switch (record.status) {
    case SUBMISSION_STATUS.submitted:
      return "already-submitted";
    case SUBMISSION_STATUS.submitting:
      return "in-progress";
    case SUBMISSION_STATUS.unknown:
      return "needs-reconcile";
    case SUBMISSION_STATUS.failed:
    case SUBMISSION_STATUS.notSubmitted:
      return "retry";
  }
}

const ELIGIBILITY_BLOCKERS: Record<
  "in-progress" | "already-submitted" | "needs-reconcile",
  string
> = {
  "in-progress": "A submission for this payment is already in flight.",
  "already-submitted": "This payment already has a submitted proposal.",
  "needs-reconcile":
    "The last attempt's result is unknown. Reconcile it against the treasury before retrying, so a proposal is not created twice.",
};

/** A message explaining why this payment cannot be submitted now, if it cannot. */
export function submissionBlocker(record: SubmissionRecord | null): string | null {
  const eligibility = submissionEligibility(record);
  if (eligibility === "new" || eligibility === "retry") {
    return null;
  }
  const base = ELIGIBILITY_BLOCKERS[eligibility];
  return record?.proposalId !== null && record?.proposalId !== undefined
    ? `${base} Proposal #${record.proposalId}.`
    : base;
}

export interface AttemptContext {
  at: string;
  submittedBy: string | null;
  lastProposalIdBefore: number | null;
}

/** Marks the record as an in-flight attempt before anything is signed. */
export function withAttemptStarted(
  record: SubmissionRecord | null,
  draft: ActionDraft,
  treasury: TreasuryTarget,
  context: AttemptContext,
): SubmissionRecord {
  const base: SubmissionRecord = record ?? {
    key: submissionKey(treasury, draft.id),
    treasury,
    draftId: draft.id,
    reference: draft.reference,
    recipient: draft.recipient,
    amountBaseUnits: draft.amount.baseUnits,
    status: SUBMISSION_STATUS.submitting,
    proposalId: null,
    lastProposalIdBefore: context.lastProposalIdBefore,
    submittedBy: context.submittedBy,
    attempts: [],
    updatedAt: context.at,
    note: null,
  };
  return {
    ...base,
    status: SUBMISSION_STATUS.submitting,
    submittedBy: context.submittedBy ?? base.submittedBy,
    // Keep the earliest observation: it is the window reconciliation searches.
    lastProposalIdBefore: base.lastProposalIdBefore ?? context.lastProposalIdBefore,
    updatedAt: context.at,
    note: null,
  };
}

/**
 * Applies a wallet outcome to the record.
 *
 * A success without a readable proposal id is not treated as submitted: the
 * chain agrees a call was executed, but which proposal it created is unknown,
 * so reconciliation is still required.
 */
export function withOutcome(
  record: SubmissionRecord,
  outcome: TransactionOutcome,
  context: { at: string; proposalId?: number | null },
): SubmissionRecord {
  const attempt: SubmissionAttempt = {
    at: context.at,
    transactionHash: outcome.transactionHash,
    outcome: outcome.kind,
    message: outcome.message,
  };
  const attempts = [...record.attempts, attempt];

  if (outcome.kind === "success") {
    const proposalId =
      context.proposalId ?? parseProposalId(outcome.returnValue);
    if (proposalId === null) {
      return {
        ...record,
        status: SUBMISSION_STATUS.unknown,
        attempts,
        updatedAt: context.at,
        note: "The transaction succeeded, but no proposal id could be read. Reconcile before retrying.",
      };
    }
    return {
      ...record,
      status: SUBMISSION_STATUS.submitted,
      proposalId,
      attempts,
      updatedAt: context.at,
      note: null,
    };
  }

  if (outcome.kind === "failure") {
    return {
      ...record,
      status: SUBMISSION_STATUS.failed,
      attempts,
      updatedAt: context.at,
      note: outcome.message,
    };
  }

  return {
    ...record,
    status: SUBMISSION_STATUS.unknown,
    attempts,
    updatedAt: context.at,
    note:
      outcome.message ??
      "The wallet did not report a clear result. Reconcile before retrying.",
  };
}

/**
 * Records a rejection that definitely did not reach the chain (the wallet was
 * dismissed or refused to sign). Safe to retry without reconciliation.
 */
export function withNotSubmitted(
  record: SubmissionRecord,
  context: { at: string; message: string | null },
): SubmissionRecord {
  return {
    ...record,
    status: SUBMISSION_STATUS.notSubmitted,
    attempts: [
      ...record.attempts,
      {
        at: context.at,
        transactionHash: null,
        outcome: "unknown",
        message: context.message,
      },
    ],
    updatedAt: context.at,
    note: context.message,
  };
}

/** True when a stored proposal's transfer fields match the draft exactly. */
export function proposalMatchesDraft(
  proposal: TreasuryProposal,
  draft: ActionDraft,
): boolean {
  if (!proposal.transfer) {
    return false;
  }
  return (
    proposal.transfer.tokenId === null &&
    proposal.transfer.receiverId === draft.recipient &&
    proposal.transfer.amountBaseUnits === draft.amount.baseUnits
  );
}

/** Adopts an existing on-chain proposal as this payment's submission. */
export function withReconciledProposal(
  record: SubmissionRecord,
  proposal: TreasuryProposal,
  at: string,
): SubmissionRecord {
  return {
    ...record,
    status: SUBMISSION_STATUS.submitted,
    proposalId: proposal.id,
    updatedAt: at,
    note: `Reconciled with proposal #${proposal.id} (${proposal.status}).`,
  };
}

/** Marks an attempt as definitely absent from the chain, allowing a retry. */
export function withReconciledAbsence(
  record: SubmissionRecord,
  at: string,
): SubmissionRecord {
  return {
    ...record,
    status: SUBMISSION_STATUS.notSubmitted,
    updatedAt: at,
    note: "No matching proposal exists on the treasury, so this payment was not submitted.",
  };
}

/* ------------------------------------------------------------------ */
/* Stored shape                                                        */
/* ------------------------------------------------------------------ */

/**
 * Validation for submission records read from a document.
 *
 * Stored documents are untrusted on import: a record must not be able to claim
 * a payment was submitted when its own fields say otherwise.
 */
const baseUnitString = z.string().regex(/^\d+$/, "Expected integer base units");

export const submissionRecordSchema = z
  .object({
    key: z.string().min(1),
    treasury: z.object({
      network: z.enum(["mainnet", "testnet"]),
      accountId: z.string().min(1),
    }),
    draftId: z.string().regex(/^draft_[0-9a-f]{16}$/),
    reference: z.string().min(1),
    recipient: z.string().min(1),
    amountBaseUnits: baseUnitString,
    status: z.enum([
      "submitting",
      "submitted",
      "failed",
      "unknown",
      "not-submitted",
    ]),
    proposalId: z.number().int().nonnegative().nullable(),
    lastProposalIdBefore: z.number().int().nonnegative().nullable(),
    submittedBy: z.string().nullable(),
    attempts: z.array(
      z.object({
        at: z.iso.datetime(),
        transactionHash: z.string().nullable(),
        outcome: z.enum(["success", "failure", "unknown"]),
        message: z.string().nullable(),
      }),
    ),
    updatedAt: z.iso.datetime(),
    note: z.string().nullable(),
  })
  .refine(
    (record) => record.key === `${record.treasury.network}|${record.treasury.accountId}|${record.draftId}`,
    "submission key does not match its treasury and draft",
  )
  .refine(
    (record) => record.status !== "submitted" || record.proposalId !== null,
    "a submitted record must name its proposal",
  );

export function validateSubmissionRecord(
  value: unknown,
): { ok: true; record: SubmissionRecord } | { ok: false; error: string } {
  const parsed = submissionRecordSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Invalid submission record at ${issue?.path.join(".") || "record"}: ${
        issue?.message ?? "unexpected structure"
      }`,
    };
  }
  return { ok: true, record: parsed.data as SubmissionRecord };
}