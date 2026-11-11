import { JsonRpcProvider } from "near-api-js";
import { env, type AppEnv } from "../../config/env";

export function createNearProvider(config: AppEnv = env) {
  return new JsonRpcProvider({
    url: config.VITE_NEAR_RPC_URL ?? `https://rpc.${config.VITE_NEAR_NETWORK}.near.org`,
  });
}
