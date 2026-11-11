import { env, type AppEnv } from "../../config/env";
import type { NearNetwork } from "../near/network";

/**
 * NEAR Connect connector factory.
 *
 * Importing this module does not connect a wallet or initialize its SDK. The
 * SDK is imported inside the factory, which the wallet gateway calls from an
 * explicit user action.
 */
export async function createWalletConnector(config: AppEnv = env, network?: NearNetwork) {
  const { NearConnector } = await import("@hot-labs/near-connect");
  return new NearConnector({
    network: network ?? config.VITE_NEAR_NETWORK,
    autoConnect: false,
    ...(config.VITE_WALLET_MANIFEST_URL
      ? { manifest: config.VITE_WALLET_MANIFEST_URL }
      : {}),
  });
}