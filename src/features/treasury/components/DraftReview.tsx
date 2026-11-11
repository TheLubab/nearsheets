import { useEffect, useRef, useState } from "react";
import type { TreasuryMetadata } from "../../documents/model/document-envelope";
import type { WorkbookSession } from "../../spreadsheet/univer/create-workbook-session";
import type { ActionDraft, DraftIssue } from "../model/action-draft";
import { describeDraft } from "../model/action-draft";
import type { CollectedDrafts } from "../application/collect-drafts";
import { collectDraftsFromSession } from "../application/collect-drafts";
import type { AssetLookup, AssetLookupState } from "../formulas/asset-lookup";
import {
  createAssetLookup,
  createStaticAssetSource,
} from "../formulas/asset-lookup";
import type { ProposalActions } from "../application/use-proposal-actions";
import type {
  TreasuryPolicy,
  TreasuryProposal,
} from "../model/treasury-reads";
import type { SubmissionRecord } from "../model/proposal-submissions";
import { canSubmit, submissionEligibility } from "../model/proposal-submissions";
import { formatNearBaseUnits } from "../model/treasury-reads";

export interface DraftReviewProps {
  /**
   * Returns the live editor session. A function, not a session value, so the
   * panel does not capture a disposed editor across document switches.
   */
  getSession: () => WorkbookSession | null;
  treasury: TreasuryMetadata;
  /** Policy of the saved treasury, or `null` while it has not been read. */
  policy: TreasuryPolicy | null;
  actions: ProposalActions;
}

interface ReviewState {
  collected: CollectedDrafts | null;
  assets: Record<string, AssetLookupState | undefined>;
}

const EMPTY_REVIEW: ReviewState = { collected: null, assets: {} };

function recordStatusLabel(record: SubmissionRecord): string {
  switch (record.status) {
    case "submitted":
      return `Proposal #${record.proposalId}`;
    case "submitting":
      return "Submitting…";
    case "unknown":
      return "Result unknown";
    case "failed":
      return "Failed";
    case "not-submitted":
      return "Not submitted";
  }
}

/**
 * Payment drafts, with a deliberate two-step submission.
 *
 * Checking reads cell values and validates them. Preparing shows exactly what
 * would be proposed; only the explicit Confirm button asks the wallet to sign.
 * Recalculation, opening the document or checking again never submits.
 */
export function DraftReview({
  getSession,
  treasury,
  policy,
  actions,
}: DraftReviewProps) {
  const [review, setReview] = useState<ReviewState>(EMPTY_REVIEW);
  const lookupRef = useRef<AssetLookup | null>(null);
  const { state } = actions;

  // One lookup per panel lifetime, disposed with it. The static source knows
  // only native NEAR, so an unknown asset shows "unknown" instead of a guessed
  // precision and no network call is made.
  useEffect(() => {
    const lookup = createAssetLookup({ source: createStaticAssetSource() });
    lookupRef.current = lookup;
    const unsubscribe = lookup.subscribe((assetId) => {
      setReview((previous) => ({
        ...previous,
        assets: { ...previous.assets, [assetId]: lookup.stateFor(assetId) ?? undefined },
      }));
    });
    return () => {
      unsubscribe();
      lookup.dispose();
      lookupRef.current = null;
    };
  }, []);

  const check = () => {
    const collected = collectDraftsFromSession(getSession(), treasury);
    const assetIds = new Set(collected.drafts.map((draft) => draft.asset.assetId));
    setReview({ collected, assets: {} });
    const lookup = lookupRef.current;
    if (!lookup) {
      return;
    }
    for (const assetId of assetIds) {
      void lookup.get(assetId);
    }
  };

  const collected = review.collected;
  const drafts: ActionDraft[] = collected?.drafts ?? [];
  const issues: DraftIssue[] = collected?.issues ?? [];

  const preview = state.preview?.draft.id
    ? drafts.find((draft) => draft.id === state.preview?.draft.id) ?? state.preview?.draft
    : null;

  return (
    <section className="draft-review" aria-label="Payment drafts">
      <div className="draft-review__bar">
        <span className="draft-review__label">Payment drafts</span>
        <button type="button" onClick={check}>
          Check payments
        </button>
      </div>

      {state.notice ? (
        <p
          className={
            state.notice.kind === "info"
              ? "draft-review__notice"
              : state.notice.kind === "cancelled"
                ? "draft-review__hint"
                : "draft-review__problem"
          }
          role={state.notice.kind === "error" ? "alert" : "status"}
        >
          {state.notice.message}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={actions.dismissNotice}
            className="draft-review__dismiss"
          >
            ×
          </button>
        </p>
      ) : null}

      {collected === null ? (
        <p className="draft-review__hint">
          Check reads the Payments sheet and validates each row. It does not
          submit anything.
        </p>
      ) : collected.problem ? (
        <p className="draft-review__problem" role="status">
          {collected.problem}
        </p>
      ) : (
        <div className="draft-review__body">
          <p className="draft-review__count" role="status">
            {drafts.length} valid draft{drafts.length === 1 ? "" : "s"}
            {issues.length > 0
              ? `, ${issues.length} problem${issues.length === 1 ? "" : "s"}`
              : ""}
            {` across ${collected.rowCount} payment row${collected.rowCount === 1 ? "" : "s"}.`}
          </p>

          {drafts.length > 0 ? (
            <ul className="draft-review__list">
              {drafts.map((draft) => {
                const assetState = review.assets[draft.asset.assetId];
                const record = actions.recordFor(draft);
                const eligibility = submissionEligibility(record);
                const busy = state.busyDraftId === draft.id;
                const submitDisabled =
                  busy || policy === null || !canSubmit(eligibility);

                return (
                  <li key={draft.id}>
                    <span className="draft-review__ref">{draft.reference}</span>
                    <span>{describeDraft(draft)}</span>
                    <span className="draft-review__kind">
                      {draft.kind === "near-transfer" ? "Transfer" : "Intents"}
                    </span>
                    {assetState?.status === "loading" ? (
                      <span className="draft-review__asset">Checking asset…</span>
                    ) : assetState?.status === "error" ? (
                      <span className="draft-review__asset draft-review__asset--error">
                        {assetState.error}
                      </span>
                    ) : null}

                    {record ? (
                      <span
                        className={`draft-review__record draft-review__record--${eligibility}`}
                        title={record.note ?? undefined}
                      >
                        {recordStatusLabel(record)}
                      </span>
                    ) : null}

                    <span className="draft-review__row-actions">
                      {eligibility === "needs-reconcile" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void actions.reconcileSubmission(draft)}
                        >
                          {busy ? "Reconciling…" : "Reconcile"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={submitDisabled}
                          onClick={() => {
                            if (policy) {
                              actions.beginSubmission(draft, policy);
                            }
                          }}
                          title={
                            policy === null
                              ? "The treasury policy has not been read yet."
                              : undefined
                          }
                        >
                          {eligibility === "retry" ? "Prepare retry" : "Prepare proposal"}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {issues.length > 0 ? (
            <ul className="draft-review__issues">
              {issues.map((issue, index) => (
                <li key={`${issue.field}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {state.preview && preview ? (
        <SubmissionConfirmation
          actions={actions}
          preview={state.preview}
          busy={state.busyDraftId === preview.id}
        />
      ) : null}
    </section>
  );
}

function SubmissionConfirmation({
  actions,
  preview,
  busy,
}: {
  actions: ProposalActions;
  preview: NonNullable<ProposalActions["state"]["preview"]>;
  busy: boolean;
}) {
  const blocked = preview.blockers.length > 0;
  return (
    <div className="proposal-confirm" role="dialog" aria-label="Confirm proposal">
      <h3>Confirm proposal</h3>
      <dl>
        <dt>Treasury</dt>
        <dd>
          {preview.treasury.accountId} ({preview.treasury.network})
        </dd>
        <dt>Description</dt>
        <dd>{preview.description}</dd>
        <dt>Recipient</dt>
        <dd>{preview.draft.recipient}</dd>
        <dt>Amount</dt>
        <dd>
          {preview.draft.amount.display} {preview.draft.asset.symbol}
        </dd>
        <dt>Proposal bond</dt>
        <dd>
          {formatNearBaseUnits(preview.bondBaseUnits)} NEAR (attached to the
          contract call)
        </dd>
        <dt>Signing account</dt>
        <dd>{preview.accountId ?? "No wallet connected"}</dd>
        <dt>Reference</dt>
        <dd>{preview.draft.reference}</dd>
      </dl>

      {preview.warnings.map((warning) => (
        <p key={warning} className="proposal-confirm__warning">
          {warning}
        </p>
      ))}
      {preview.blockers.map((blocker) => (
        <p key={blocker} className="proposal-confirm__blocker" role="alert">
          {blocker}
        </p>
      ))}

      <p className="proposal-confirm__hint">
        This creates one DAO proposal. It does not approve it, and the payment is
        not complete until the DAO executes the approved proposal.
      </p>

      <div className="proposal-confirm__actions">
        <button type="button" onClick={actions.cancelPreview} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void actions.confirmSubmission()}
          disabled={busy || blocked}
        >
          {busy ? "Waiting for wallet…" : "Sign and submit"}
        </button>
      </div>
    </div>
  );
}

/** Approve/reject controls for one proposal in the treasury panel. */
export function ProposalVoteActions({
  proposal,
  policy,
  actions,
}: {
  proposal: TreasuryProposal;
  policy: TreasuryPolicy;
  actions: ProposalActions;
}) {
  const preview =
    actions.state.votePreview?.proposalId === proposal.id
      ? actions.state.votePreview
      : null;
  const busy = actions.state.busyProposalId === proposal.id;

  if (proposal.status !== "InProgress") {
    return null;
  }

  return (
    <span className="treasury-panel__votes">
      <button
        type="button"
        disabled={busy}
        onClick={() => actions.beginVote(proposal, "VoteApprove", policy)}
      >
        Approve
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => actions.beginVote(proposal, "VoteReject", policy)}
      >
        Reject
      </button>
      {preview ? (
        <span className="treasury-panel__vote-confirm">
          {preview.description}?{" "}
          {preview.blockers.length > 0 ? (
            <span className="treasury-panel__error">{preview.blockers.join(" ")}</span>
          ) : null}
          {preview.warnings.map((warning) => (
            <span key={warning} className="treasury-panel__muted">
              {warning}
            </span>
          ))}
          <button
            type="button"
            onClick={() => void actions.confirmVote(proposal)}
            disabled={busy || preview.blockers.length > 0}
          >
            {busy ? "Waiting for wallet…" : "Sign vote"}
          </button>
          <button type="button" onClick={actions.cancelPreview} disabled={busy}>
            Cancel
          </button>
        </span>
      ) : null}
    </span>
  );
}