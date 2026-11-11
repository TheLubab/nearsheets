import { WalletCancelledError } from "../../../integrations/wallet/gateway";
import type { WalletController } from "../../wallet/application/wallet-controller";
import type { ActionDraft } from "../model/action-draft";
import type {
  ProposalCall,
  SubmissionRecord,
} from "../model/proposal-submissions";
import {
  buildTransferProposalCall,
  checkSubmission,
  parseProposalId,
  parseTransactionOutcome,
  proposalMatchesDraft,
  submissionBlocker,
  withAttemptStarted,
  withNotSubmitted,
  withOutcome,
  withReconciledAbsence,
  withReconciledProposal,
} from "../model/proposal-submissions";
import type {
  TreasuryPolicy,
  TreasuryProposal,
  TreasuryTarget,
} from "../model/treasury-reads";

/**
 * Proposal submission orchestration.
 *
 * This is the only module that turns a draft into a signed transaction, and it
 * does so only when a user explicitly asks. Everything it needs is injected, so
 * the whole flow is testable without a browser, a wallet or a chain.
 *
 * Ordering is deliberate: the attempt is journaled *before* signing, so a
 * wallet that hangs, a closed tab or an unknown result leaves a record that
 * blocks a blind retry. Only a definite failure or a definite "never signed"
 * reopens submission.
 */

export interface ProposalSubmitterOptions {
  /** The one signing path; typically the wallet controller. */
  sign(transaction: ProposalCall): Promise<unknown>;
  /** Fresh proposals for reconciling an unclear outcome. */
  readProposals(
    target: TreasuryTarget,
  ): Promise<{ proposals: TreasuryProposal[]; lastProposalId: number }>;
  /**
   * The contract's next proposal id, read immediately before signing.
   *
   * Captured here rather than passed in so the floor always reflects the chain
   * at the moment of the attempt; a stale count would hide a real submission.
   */
  readLastProposalId(target: TreasuryTarget): Promise<number>;
  now?: () => Date;
}

export type SubmitProposalResult =
  | { ok: true; record: SubmissionRecord; transactionHash: string | null }
  | {
      ok: false;
      record: SubmissionRecord | null;
      error: string;
      /** True when the user declined in the wallet: nothing was sent. */
      cancelled?: boolean;
    };

export interface SubmitProposalInput {
  draft: ActionDraft;
  treasury: TreasuryTarget;
  policy: TreasuryPolicy;
  accountId: string | null;
  /** Previous journal entry for this payment, if any. */
  record: SubmissionRecord | null;
}

export interface SubmissionOutcomeReport {
  record: SubmissionRecord;
  /** Reconciliation result when the wallet's answer was unclear. */
  reconciled: "found" | "absent" | "not-attempted";
  proposals: TreasuryProposal[];
}

export interface ProposalSubmitter {
  submit(input: SubmitProposalInput): Promise<SubmitProposalResult>;
  /**
   * Reconciles an unclear attempt against the treasury's proposals.
   *
   * Used both after an unclear wallet answer and when the user presses
   * "Reconcile" on a record that was left in flight.
   */
  reconcile(input: {
    draft: ActionDraft;
    treasury: TreasuryTarget;
    record: SubmissionRecord;
  }): Promise<SubmissionOutcomeReport>;
}

/**
 * True only when the wallet told us nothing was sent.
 *
 * The gateway translates a dismissed selector or a rejected signature into
 * `WalletCancelledError`; every other error is treated as possibly-delivered,
 * because guessing "it probably failed" is what turns a retry into a duplicate.
 */
function isDefiniteRefusal(cause: unknown): boolean {
  return cause instanceof WalletCancelledError;
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string" && cause.length > 0) {
    return cause;
  }
  return "The wallet did not complete the transaction.";
}

export function createProposalSubmitter(
  options: ProposalSubmitterOptions,
): ProposalSubmitter {
  const now = options.now ?? (() => new Date());

  const findCandidate = (
    draft: ActionDraft,
    record: SubmissionRecord,
    proposals: TreasuryProposal[],
  ): TreasuryProposal | null => {
    // The proposal count observed *before* the attempt is the only reliable
    // lower bound. Block timestamps and the local clock are not comparable, so
    // they are deliberately not used to decide whether a proposal is ours.
    const floor = record.lastProposalIdBefore ?? 0;
    const candidates = proposals
      .filter((proposal) => proposal.id >= floor)
      .filter((proposal) => proposalMatchesDraft(proposal, draft))
      .sort((left, right) => left.id - right.id);
    return candidates[0] ?? null;
  };

  const reconcile: ProposalSubmitter["reconcile"] = async ({ draft, treasury, record }) => {
    const observed = await options.readProposals(treasury);
    const candidate = findCandidate(draft, record, observed.proposals);
    const at = now().toISOString();
    return {
      record: candidate
        ? withReconciledProposal(record, candidate, at)
        : withReconciledAbsence(record, at),
      reconciled: candidate ? "found" : "absent",
      proposals: observed.proposals,
    };
  };

  const submit: ProposalSubmitter["submit"] = async (input) => {
    const { draft, treasury, policy, accountId, record } = input;

    const blocking = submissionBlocker(record);
    if (blocking !== null) {
      return { ok: false, record, error: blocking };
    }

    const checks = checkSubmission(draft, policy, accountId);
    if (checks.blockers.length > 0) {
      return { ok: false, record, error: checks.blockers.join(" ") };
    }

    const built = buildTransferProposalCall(draft, treasury, policy);
    if (!built.ok) {
      return { ok: false, record, error: built.error };
    }

    // Read the proposal count *before* signing. It is the only safe lower bound
    // for reconciliation, so a failed read aborts instead of signing blind: a
    // proposal we cannot later recognise is worse than not submitting.
    let lastProposalIdBefore: number;
    try {
      lastProposalIdBefore = await options.readLastProposalId(treasury);
    } catch (cause) {
      return {
        ok: false,
        record,
        error: `The treasury's proposal count could not be read, so nothing was signed: ${describeCause(cause)}`,
      };
    }

    const started = withAttemptStarted(record, draft, treasury, {
      at: now().toISOString(),
      submittedBy: accountId,
      lastProposalIdBefore,
    });

    let raw: unknown;
    try {
      raw = await options.sign(built.call);
    } catch (cause) {
      const at = now().toISOString();
      const refused = isDefiniteRefusal(cause);
      const next = refused
        ? withNotSubmitted(started, { at, message: describeCause(cause) })
        : // An unclassified error might still have reached the chain.
          withOutcome(
            started,
            {
              kind: "unknown",
              transactionHash: null,
              returnValue: null,
              message: describeCause(cause),
            },
            { at },
          );
      return { ok: false, record: next, error: describeCause(cause), cancelled: refused };
    }

    const outcome = parseTransactionOutcome(raw);
    const at = now().toISOString();
    const next = withOutcome(started, outcome, {
      at,
      proposalId: parseProposalId(outcome.returnValue),
    });

    if (next.status === "submitted") {
      return { ok: true, record: next, transactionHash: outcome.transactionHash };
    }

    if (next.status === "failed") {
      return {
        ok: false,
        record: next,
        error: outcome.message ?? "The treasury rejected the proposal.",
      };
    }

    // Unclear result: reconcile immediately so the user is not left guessing.
    try {
      const reconciled = await reconcile({ draft, treasury, record: next });
      return reconciled.record.status === "submitted"
        ? {
            ok: true,
            record: reconciled.record,
            transactionHash: outcome.transactionHash,
          }
        : {
            ok: false,
            record: reconciled.record,
            error:
              reconciled.record.note ??
              "The result is unclear and no matching proposal exists yet.",
          };
    } catch (cause) {
      return {
        ok: false,
        record: next,
        error: `The wallet's result is unclear (${describeCause(cause)}). Reconcile before retrying.`,
      };
    }
  };

  return { submit, reconcile };
}

/* ------------------------------------------------------------------ */
/* React-facing glue                                                   */
/* ------------------------------------------------------------------ */

/**
 * Adapts the wallet controller to the submitter's signing port.
 *
 * Kept here rather than in the gateway so the gateway stays a thin SDK
 * boundary and the "must be connected, must be on the treasury's network" rules
 * live next to the published session state.
 */
export function signWithWallet(
  wallet: WalletController,
  expectedNetwork: string,
): (call: ProposalCall) => Promise<unknown> {
  return async (call: ProposalCall): Promise<unknown> => {
    const state = wallet.getState();
    if (state.status !== "connected" || !state.connection) {
      throw new Error("Connect a wallet before submitting a proposal.");
    }
    if (state.network !== expectedNetwork) {
      throw new Error(
        `Your wallet is on ${state.network}, but this treasury is on ${expectedNetwork}. Switch the wallet network before signing.`,
      );
    }
    return wallet.signAndSendTransaction({
      receiverId: call.treasury.accountId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: call.method,
            args: call.args,
            gas: call.gas,
            deposit: call.depositBaseUnits,
          },
        },
      ],
    });
  };
}