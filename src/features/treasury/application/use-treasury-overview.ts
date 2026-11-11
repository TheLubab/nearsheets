import { useQuery } from "@tanstack/react-query";
import type { TreasuryReader } from "./treasury-reader";
import type {
  TreasuryBalance,
  TreasuryPolicy,
  TreasuryProposal,
  TreasuryTarget,
} from "../model/treasury-reads";

/**
 * Treasury reads for the UI.
 *
 * TanStack Query handles caching, in-flight deduplication and explicit refresh.
 * Reads are gated on a target the user selected: mounting the panel performs no
 * request, and nothing here retries a failing contract call automatically,
 * because a bad account id or wrong network produces the same error every time.
 *
 * The query keys include the network and account, so switching either cannot
 * show another treasury's data.
 */

export type TreasuryQueryState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

function toState<T>(query: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
}, enabled: boolean): TreasuryQueryState<T> {
  if (!enabled) {
    // A disabled query is "pending" forever; reporting that as loading would
    // claim a request that was never made.
    return { status: "idle" };
  }
  if (query.isPending) {
    return { status: "loading" };
  }
  if (query.isError) {
    return {
      status: "error",
      message:
        query.error instanceof Error
          ? query.error.message
          : "The treasury could not be read.",
    };
  }
  if (query.data === undefined) {
    return { status: "idle" };
  }
  return { status: "ready", data: query.data };
}

export interface TreasuryOverview {
  /** Name of the source serving these reads, e.g. `NEAR RPC`. */
  sourceLabel: string;
  policy: TreasuryQueryState<TreasuryPolicy>;
  proposals: TreasuryQueryState<{
    proposals: TreasuryProposal[];
    lastProposalId: number;
  }>;
  balances: TreasuryQueryState<TreasuryBalance[]>;
  /** Re-reads every section; a failed section can therefore retry on its own. */
  refresh(): void;
}

export function useTreasuryOverview(
  reader: TreasuryReader,
  target: TreasuryTarget | null,
): TreasuryOverview {
  const identity = target ? [target.network, target.accountId] : ["none"];
  const enabled = target !== null;

  const policy = useQuery({
    queryKey: ["treasury", "policy", ...identity],
    queryFn: () => reader.readPolicy(target!),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  const proposals = useQuery({
    queryKey: ["treasury", "proposals", ...identity],
    queryFn: () => reader.readProposals(target!),
    enabled,
    retry: false,
    staleTime: 30_000,
  });

  const balances = useQuery({
    queryKey: ["treasury", "balances", ...identity],
    queryFn: () => reader.readBalances(target!),
    enabled,
    retry: false,
    staleTime: 30_000,
  });

  return {
    sourceLabel: reader.sourceLabel,
    policy: toState(policy, enabled),
    proposals: toState(proposals, enabled),
    balances: toState(balances, enabled),
    refresh: () => {
      void policy.refetch();
      void proposals.refetch();
      void balances.refetch();
    },
  };
}