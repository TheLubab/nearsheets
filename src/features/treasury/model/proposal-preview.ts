import type { SubmissionRecord, VoteAction } from "../model/proposal-submissions";
import type { ActionDraft } from "../model/action-draft";
import type { TreasuryPolicy, TreasuryTarget } from "../model/treasury-reads";

/**
 * Preview states for the explicit submission step.
 *
 * A preview is data. Nothing here signs, and closing the preview changes
 * nothing, so a mistaken click cannot cost a bond.
 */
export interface SubmissionPreview {
  draft: ActionDraft;
  treasury: TreasuryTarget;
  policy: TreasuryPolicy;
  accountId: string | null;
  /** Exact bond the contract will require, in yoctoNEAR. */
  bondBaseUnits: string;
  description: string;
  blockers: string[];
  warnings: string[];
  record: SubmissionRecord | null;
}

export interface VotePreview {
  proposalId: number;
  action: VoteAction;
  treasury: TreasuryTarget;
  accountId: string | null;
  description: string;
  blockers: string[];
  warnings: string[];
}

/** Result banner shown after an explicit action. */
export interface ProposalNotice {
  kind: "info" | "error" | "cancelled";
  message: string;
}