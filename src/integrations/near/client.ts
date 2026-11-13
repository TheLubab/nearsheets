import { JsonRpcProvider } from "near-api-js";
import { env, type AppEnv } from "../../config/env";
import type { NearNetwork } from "./network";
import { defaultRpcUrl } from "./network";

/**
 * NEAR RPC provider factory.
 *
 * Construction performs no query. A custom `VITE_NEAR_RPC_URL` applies to the
 * configured network; when the wallet switches networks, the public RPC for
 * that network is used rather than sending calls for one network to an endpoint
 * configured for another.
 */
export function createNearProvider(config: AppEnv = env, network?: NearNetwork, requestOptions?:ConstructorParameters<typeof JsonRpcProvider>[1]) {
  const selected = network ?? config.VITE_NEAR_NETWORK;
  const url =
    config.VITE_NEAR_RPC_URL && selected === config.VITE_NEAR_NETWORK
      ? config.VITE_NEAR_RPC_URL
      : defaultRpcUrl(selected);
  return new JsonRpcProvider({ url },requestOptions);
}