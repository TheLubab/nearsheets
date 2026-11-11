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

export interface DraftReviewProps {
  /**
   * Returns the live editor session. A function, not a session value, so the
   * panel does not capture a disposed editor across document switches.
   */
  getSession: () => WorkbookSession | null;
  treasury: TreasuryMetadata;
}

interface ReviewState {
  collected: CollectedDrafts | null;
  assets: Record<string, AssetLookupState | undefined>;
}

const EMPTY_REVIEW: ReviewState = { collected: null, assets: {} };

/**
 * Explicit review of payment rows as action drafts.
 *
 * This is a read-only check: it reads cell values and validates them. It never
 * writes to the sheet, signs or submits. Submission remains a later, separate
 * task, so the panel is deliberately labelled as a check rather than a send.
 *
 * App remounts this panel per document (`key={documentId}`), so switching
 * documents cannot leave another document's payments on screen and each panel
 * gets its own asset lookup.
 */
export function DraftReview({ getSession, treasury }: DraftReviewProps) {
  const [review, setReview] = useState<ReviewState>(EMPTY_REVIEW);
  const lookupRef = useRef<AssetLookup | null>(null);

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
      // Recording a lookup state is what surfaces loading/ready/error; the
      // draft amount itself is already validated.
      void lookup.get(assetId);
    }
  };

  const collected = review.collected;
  const drafts: ActionDraft[] = collected?.drafts ?? [];
  const issues: DraftIssue[] = collected?.issues ?? [];

  return (
    <section className="draft-review" aria-label="Payment drafts">
      <div className="draft-review__bar">
        <span className="draft-review__label">Payment drafts</span>
        <button type="button" onClick={check}>
          Check payments
        </button>
      </div>

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
    </section>
  );
}