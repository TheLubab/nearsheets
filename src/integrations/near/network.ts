/**
 * NEAR network identity shared by configuration, wallet and treasury reads.
 *
 * Defined once so the wallet integration and the treasury model cannot drift
 * into two subtly different unions.
 */
export type NearNetwork = "mainnet" | "testnet";

export const NEAR_NETWORKS: readonly NearNetwork[] = ["testnet", "mainnet"];

export function isNearNetwork(value: unknown): value is NearNetwork {
  return value === "mainnet" || value === "testnet";
}

/** Public default RPC for a network; construction does not perform a request. */
export function defaultRpcUrl(network: NearNetwork): string {
  return `https://rpc.${network}.near.org`;
}