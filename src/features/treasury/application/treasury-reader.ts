import type {
  TreasuryBalance,
  TreasuryPolicy,
  TreasuryProposal,
  TreasuryTarget,
} from "../model/treasury-reads";
import {
  parseTreasuryBalances,
  parseTreasuryPolicy,
  parseTreasuryProposals,
} from "../model/treasury-reads";

/**
 * Treasury read port and parsing reader.
 *
 * The UI depends on `TreasuryReader`, not on an RPC client or an HTTP endpoint.
 * A source returns contract-shaped JSON; the reader validates it before any
 * value reaches React, so a malformed or unrelated response is an error rather
 * than a half-rendered treasury.
 *
 * Reads are read-only by construction: this port has no sign, submit or
 * transaction method.
 */

export interface ProposalPage {
  /** Inclusive index to start from. */
  fromIndex: number;
  limit: number;
}

/**
 * Raw read port implemented by the NEAR RPC adapter (and by test mocks).
 * Values are `unknown` on purpose: validation belongs to the reader.
 */
export interface TreasuryReadSource {
  /** Human-readable source name for the panel, e.g. `NEAR RPC`. */
  readonly label: string;
  readPolicy(target: TreasuryTarget): Promise<unknown>;
  readProposals(target: TreasuryTarget, page: ProposalPage): Promise<unknown>;
  readLastProposalId(target: TreasuryTarget): Promise<unknown>;
  readBalances(target: TreasuryTarget): Promise<unknown>;
}

export interface TreasurySnapshot {
  policy: TreasuryPolicy;
  proposals: TreasuryProposal[];
  lastProposalId: number;
  balances: TreasuryBalance[];
}

export interface TreasuryReader {
  readonly sourceLabel: string;
  readPolicy(target: TreasuryTarget): Promise<TreasuryPolicy>;
  readProposals(
    target: TreasuryTarget,
    limit?: number,
  ): Promise<{ proposals: TreasuryProposal[]; lastProposalId: number }>;
  readBalances(target: TreasuryTarget): Promise<TreasuryBalance[]>;
}

/** Default number of proposals shown; enough for review without a bulk fetch. */
export const DEFAULT_PROPOSAL_LIMIT = 20;

/** A failed read that already carries a message suitable for display. */
export class TreasuryReadError extends Error {
  readonly target: TreasuryTarget;

  constructor(target: TreasuryTarget, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TreasuryReadError";
    this.target = target;
  }
}

function describeFailure(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string" && cause.length > 0) {
    return cause;
  }
  return "The treasury could not be read.";
}

export function createTreasuryReader(source: TreasuryReadSource): TreasuryReader {
  const guarded = async <T>(
    target: TreasuryTarget,
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await run();
    } catch (cause) {
      throw new TreasuryReadError(
        target,
        `${operation} failed for ${target.accountId}: ${describeFailure(cause)}`,
        { cause },
      );
    }
  };

  const readPolicy = async (target: TreasuryTarget): Promise<TreasuryPolicy> => {
    const raw = await guarded(target, "Reading the policy", () =>
      source.readPolicy(target),
    );
    const parsed = parseTreasuryPolicy(raw);
    if (!parsed.ok) {
      throw new TreasuryReadError(target, parsed.error);
    }
    return parsed.value;
  };

  const readProposals = async (
    target: TreasuryTarget,
    limit: number = DEFAULT_PROPOSAL_LIMIT,
  ): Promise<{ proposals: TreasuryProposal[]; lastProposalId: number }> => {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));

    const rawLastId = await guarded(target, "Reading the proposal count", () =>
      source.readLastProposalId(target),
    );
    const lastProposalId = parseLastProposalId(rawLastId, target);

    const fromIndex = Math.max(0, lastProposalId - safeLimit);
    const raw = await guarded(target, "Reading proposals", () =>
      source.readProposals(target, { fromIndex, limit: safeLimit }),
    );
    const parsed = parseTreasuryProposals(raw);
    if (!parsed.ok) {
      throw new TreasuryReadError(target, parsed.error);
    }
    // Contract order is ascending by id; the panel shows newest first.
    return {
      proposals: [...parsed.value].sort((a, b) => b.id - a.id),
      lastProposalId,
    };
  };

  const readBalances = async (target: TreasuryTarget): Promise<TreasuryBalance[]> => {
    const raw = await guarded(target, "Reading balances", () =>
      source.readBalances(target),
    );
    const parsed = parseTreasuryBalances(raw);
    if (!parsed.ok) {
      throw new TreasuryReadError(target, parsed.error);
    }
    return parsed.value;
  };

  return {
    sourceLabel: source.label,
    readPolicy,
    readProposals,
    readBalances,
  };
}

function parseLastProposalId(raw: unknown, target: TreasuryTarget): number {
  const value =
    typeof raw === "string" && /^\d+$/.test(raw)
      ? Number(raw)
      : typeof raw === "number"
        ? raw
        : Number.NaN;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TreasuryReadError(
      target,
      "The contract returned an unexpected last proposal id.",
    );
  }
  return value;
}