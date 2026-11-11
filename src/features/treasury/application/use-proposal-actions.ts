import { useCallback, useMemo, useState } from "react";
import type { TreasuryMetadata } from "../../documents/model/document-envelope";
import type { ActionDraft } from "../model/action-draft";
import { describeDraft } from "../model/action-draft";
import type { SubmissionRecord, VoteAction } from "../model/proposal-submissions";
import {
  buildTransferProposalCall,
  buildVoteCall,
  checkSubmission,
  describeProposal,
  parseTransactionOutcome,
  recordKeyForDraft,
  submissionBlocker,
} from "../model/proposal-submissions";
import type {
  ProposalNotice,
  SubmissionPreview,
  VotePreview,
} from "../model/proposal-preview";
import { createProposalSubmitter, signWithWallet } from "./proposal-submitter";
import type { TreasuryReader } from "./treasury-reader";
import type {
  TreasuryPolicy,
  TreasuryProposal,
  TreasuryTarget,
} from "../model/treasury-reads";
import { evaluatePermission } from "../model/treasury-reads";
import type { WalletController } from "../../wallet/application/wallet-controller";

/**
 * Proposal actions for the open document.
 *
 * All user-visible state for previewing, submitting and reconciling lives here
 * so the panels stay presentational. Nothing signs on mount or on render:
 * `beginSubmission`/`beginVote` only build a preview, and
 * `confirmSubmission`/`confirmVote` are the explicit paths that do.
 *
 * The submission journal is read from the document, not mirrored here. That
 * keeps one source of truth: a record is saved before the UI reports progress
 * and reloaded from the envelope afterwards.
 */

export interface ProposalActionsOptions {
  wallet: WalletController;
  reader: TreasuryReader;
  /** Treasury recorded on the document. */
  treasury: TreasuryMetadata;
  /** Submission journal from the current document envelope. */
  journal: Record<string, SubmissionRecord>;
  /** Persists a journal entry; rejects (via the workspace's notice) on failure. */
  recordSubmission(record: SubmissionRecord): Promise<void>;
  /** Called after a proposal is created or a vote is sent. */
  onProposalsChanged(): void;
}

export interface ProposalActionsState {
  preview: SubmissionPreview | null;
  votePreview: VotePreview | null;
  busyDraftId: string | null;
  busyProposalId: number | null;
  notice: ProposalNotice | null;
}

const INITIAL: ProposalActionsState = {
  preview: null,
  votePreview: null,
  busyDraftId: null,
  busyProposalId: null,
  notice: null,
};

function targetFor(treasury: TreasuryMetadata): TreasuryTarget | null {
  return treasury.accountId
    ? { network: treasury.network, accountId: treasury.accountId }
    : null;
}

export interface ProposalActions {
  state: ProposalActionsState;
  /** The saved record for a payment, if this document has one. */
  recordFor(draft: ActionDraft): SubmissionRecord | null;
  beginSubmission(draft: ActionDraft, policy: TreasuryPolicy): void;
  confirmSubmission(): Promise<void>;
  reconcileSubmission(draft: ActionDraft): Promise<void>;
  beginVote(proposal: TreasuryProposal, action: VoteAction, policy: TreasuryPolicy): void;
  confirmVote(proposal: TreasuryProposal): Promise<void>;
  cancelPreview(): void;
  dismissNotice(): void;
}

export function useProposalActions(
  options: ProposalActionsOptions,
): ProposalActions {
  const { wallet, reader, treasury, journal, recordSubmission, onProposalsChanged } =
    options;
  const [state, setState] = useState<ProposalActionsState>(INITIAL);

  const target = targetFor(treasury);

  const recordFor = useCallback(
    (draft: ActionDraft): SubmissionRecord | null => {
      if (!target) {
        return null;
      }
      return journal[recordKeyForDraft(draft, target)] ?? null;
    },
    [journal, target],
  );

  /**
   * One submitter per treasury network.
   *
   * Building it is side-effect free; it captures the network so a stale
   * instance can never sign for a treasury on a different chain.
   */
  const submitter = useMemo(
    () =>
      target
        ? createProposalSubmitter({
            sign: signWithWallet(wallet, target.network),
            readProposals: (readTarget) => reader.readProposals(readTarget),
            readLastProposalId: (readTarget) =>
              reader.readLastProposalId(readTarget),
          })
        : null,
    [reader, target?.network, wallet],
  );

  const dismissNotice = useCallback(() => {
    setState((previous) => ({ ...previous, notice: null }));
  }, []);

  const cancelPreview = useCallback(() => {
    setState((previous) => ({ ...previous, preview: null, votePreview: null }));
  }, []);

  const beginSubmission = useCallback(
    (draft: ActionDraft, policy: TreasuryPolicy) => {
      if (!target) {
        setState((previous) => ({
          ...previous,
          notice: {
            kind: "error",
            message: "Save this document's treasury before preparing a proposal.",
          },
        }));
        return;
      }
      const record = recordFor(draft);
      const checks = checkSubmission(
        draft,
        policy,
        wallet.getState().connection?.accountId ?? null,
      );
      const blocker = submissionBlocker(record);
      const built = buildTransferProposalCall(draft, target, policy);

      setState((previous) => ({
        ...previous,
        votePreview: null,
        notice: null,
        preview: {
          draft,
          treasury: target,
          policy,
          accountId: wallet.getState().connection?.accountId ?? null,
          bondBaseUnits: policy.proposalBondBaseUnits,
          description: built.ok ? describeProposal(draft) : describeDraft(draft),
          blockers: [
            ...checks.blockers,
            ...(blocker ? [blocker] : []),
            ...(built.ok ? [] : [built.error]),
          ],
          warnings: checks.warnings,
          record,
        },
      }));
    },
    [recordFor, target, wallet],
  );

  const confirmSubmission = useCallback(async () => {
    const preview = state.preview;
    if (!preview || !submitter || preview.blockers.length > 0) {
      return;
    }
    const { draft, policy } = preview;
    setState((previous) => ({
      ...previous,
      busyDraftId: draft.id,
      notice: null,
    }));

    const result = await submitter.submit({
      draft,
      treasury: preview.treasury,
      policy,
      accountId: wallet.getState().connection?.accountId ?? null,
      record: preview.record,
    });

    // Persist first, then report: a record that was not saved must not look
    // like a safe retry point.
    if (result.record) {
      await recordSubmission(result.record);
    }

    if (result.ok) {
      onProposalsChanged();
      setState((previous) => ({
        ...previous,
        busyDraftId: null,
        preview: null,
        notice: {
          kind: "info",
          message: `Proposal #${result.record.proposalId} created for ${draft.reference}. Approval is a separate step, and an approved proposal is not a completed payment.`,
        },
      }));
      return;
    }

    setState((previous) => ({
      ...previous,
      busyDraftId: null,
      preview: result.cancelled ? previous.preview : null,
      notice: {
        kind: result.cancelled ? "cancelled" : "error",
        message: result.cancelled
          ? "Signing was declined in the wallet. No proposal was created."
          : result.error,
      },
    }));
  }, [
    onProposalsChanged,
    recordSubmission,
    state.preview,
    submitter,
    wallet,
  ]);

  const reconcileSubmission = useCallback(
    async (draft: ActionDraft) => {
      const record = recordFor(draft);
      if (!target || !record || !submitter) {
        return;
      }
      setState((previous) => ({
        ...previous,
        busyDraftId: draft.id,
        notice: null,
      }));
      try {
        const report = await submitter.reconcile({
          draft,
          treasury: target,
          record,
        });
        await recordSubmission(report.record);
        const submitted = report.record.status === "submitted";
        setState((previous) => ({
          ...previous,
          busyDraftId: null,
          notice: {
            kind: submitted ? "info" : "error",
            message: submitted
              ? `Found proposal #${report.record.proposalId} for ${draft.reference}.`
              : `No matching proposal exists for ${draft.reference}, so it can be submitted again.`,
          },
        }));
        onProposalsChanged();
      } catch (cause) {
        setState((previous) => ({
          ...previous,
          busyDraftId: null,
          notice: {
            kind: "error",
            message:
              cause instanceof Error
                ? `Reconciliation failed: ${cause.message}`
                : "Reconciliation failed.",
          },
        }));
      }
    },
    [onProposalsChanged, recordFor, recordSubmission, submitter, target],
  );

  const beginVote = useCallback(
    (proposal: TreasuryProposal, action: VoteAction, policy: TreasuryPolicy) => {
      if (!target) {
        return;
      }
      const accountId = wallet.getState().connection?.accountId ?? null;
      const blockers: string[] = [];
      const warnings: string[] = [];

      if (!accountId) {
        blockers.push("Connect the wallet that will vote.");
      } else {
        const permission = evaluatePermission(policy, accountId, proposal.kind, action);
        if (!permission.allowed) {
          if (permission.unknownRoles.length > 0) {
            warnings.push(
              `Your ${action} permission depends on the token-weighted role(s) ${permission.unknownRoles.join(", ")}, whose balance is not read here. The DAO decides.`,
            );
          } else {
            blockers.push(
              `${accountId} has no role granting ${proposal.kind}:${action} in this treasury's policy.`,
            );
          }
        }
      }
      if (proposal.status !== "InProgress") {
        blockers.push(
          `Proposal #${proposal.id} is ${proposal.status}; the DAO only accepts votes while it is InProgress.`,
        );
      }
      if (proposal.kindJson === undefined || proposal.kindJson === null) {
        blockers.push(
          "The proposal kind was not read, so the contract would reject this vote.",
        );
      }

      setState((previous) => ({
        ...previous,
        preview: null,
        notice: null,
        votePreview: {
          proposalId: proposal.id,
          action,
          treasury: target,
          accountId,
          description: `${action === "VoteApprove" ? "Approve" : "Reject"} proposal #${proposal.id}`,
          blockers,
          warnings,
        },
      }));
    },
    [target, wallet],
  );

  const confirmVote = useCallback(
    async (proposal: TreasuryProposal) => {
      const preview = state.votePreview;
      if (!preview || !target || preview.blockers.length > 0) {
        return;
      }
      const built = buildVoteCall(target, proposal, preview.action);
      if (!built.ok) {
        setState((previous) => ({
          ...previous,
          votePreview: null,
          notice: { kind: "error", message: built.error },
        }));
        return;
      }

      setState((previous) => ({
        ...previous,
        busyProposalId: proposal.id,
        notice: null,
      }));

      let raw: unknown;
      try {
        raw = await wallet.signAndSendTransaction({
          receiverId: built.call.treasury.accountId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: built.call.method,
                args: built.call.args,
                gas: built.call.gas,
                deposit: built.call.depositBaseUnits,
              },
            },
          ],
        });
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "The vote was not sent.";
        setState((previous) => ({
          ...previous,
          busyProposalId: null,
          votePreview: null,
          notice: { kind: "cancelled", message },
        }));
        return;
      }

      const outcome = parseTransactionOutcome(raw);
      onProposalsChanged();
      setState((previous) => ({
        ...previous,
        busyProposalId: null,
        votePreview: null,
        notice:
          outcome.kind === "success"
            ? {
                kind: "info",
                message: `Vote sent for proposal #${proposal.id}. A vote is not a completed payment: refresh to read the DAO's status and the execution result.`,
              }
            : {
                kind: "error",
                message:
                  outcome.message ?? "The vote's result is unclear. Refresh the proposals.",
              },
      }));
    },
    [onProposalsChanged, state.votePreview, target, wallet],
  );

  return {
    state,
    recordFor,
    beginSubmission,
    confirmSubmission,
    reconcileSubmission,
    beginVote,
    confirmVote,
    cancelPreview,
    dismissNotice,
  };
}