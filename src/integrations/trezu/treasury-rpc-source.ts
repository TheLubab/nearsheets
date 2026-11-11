import type { NearNetwork } from "../near/network";
import { createNearProvider } from "../near/client";
import type {
  ProposalPage,
  TreasuryReadSource,
} from "../../features/treasury/application/treasury-reader";
import type { TreasuryTarget } from "../../features/treasury/model/treasury-reads";

/**
 * NEAR RPC implementation of treasury reads.
 *
 * It uses only view calls (`callFunction` / `viewAccount`), which cannot change
 * state. Construction performs no request; a read happens only when the panel
 * asks for it.
 */

/**
 * The subset of `JsonRpcProvider` this adapter needs.
 *
 * Declared structurally so tests can pass a plain mock and so the treasury code
 * does not depend on near-api-js types. `near-api-js` is used only in the
 * default factory below.
 */
export interface NearViewClient {
  /**
   * Returns the decoded JSON contract result. `unknown` because a view call's
   * payload is untrusted until the treasury parser validates it.
   */
  callFunction(params: {
    contractId: string;
    method: string;
    args: Record<string, unknown>;
  }): Promise<unknown>;
  viewAccount(params: { accountId: string }): Promise<{ amount: bigint }>;
}

export interface NearRpcTreasurySourceOptions {
  /** Defaults to a provider for `network`. */
  client?: NearViewClient;
  network: NearNetwork;
}

/** DAO method names, kept in one place so a typo is a visible constant change. */
const METHODS = {
  policy: "get_policy",
  proposals: "get_proposals",
  lastProposalId: "get_last_proposal_id",
} as const;

export function createNearRpcTreasurySource(
  options: NearRpcTreasurySourceOptions,
): TreasuryReadSource {
  const client: NearViewClient =
    options.client ??
    (createNearProvider(undefined, options.network) as unknown as NearViewClient);

  const call = async (
    target: TreasuryTarget,
    method: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> => {
    const result = await client.callFunction({
      contractId: target.accountId,
      method,
      args,
    });
    if (result === undefined || result === null) {
      throw new Error(`The contract returned no result for "${method}".`);
    }
    return result;
  };

  return {
    label: "NEAR RPC",

    readPolicy: (target) => call(target, METHODS.policy),

    readProposals: (target, page: ProposalPage) =>
      call(target, METHODS.proposals, {
        from_index: page.fromIndex,
        limit: page.limit,
      }),

    readLastProposalId: (target) => call(target, METHODS.lastProposalId),

    async readBalances(target): Promise<unknown> {
      const account = await client.viewAccount({ accountId: target.accountId });
      // Only the native balance is read. Token lists are not guessed: a
      // fungible-token balance needs its own contract and precision, which a
      // later adapter can add. `amount` is the total balance, so it includes
      // storage staked to the account.
      return [
        {
          assetId: "near",
          symbol: "NEAR",
          decimals: 24,
          baseUnits: account.amount.toString(),
          note: "Total account balance, including storage and locked amounts.",
        },
      ];
    },
  };
}