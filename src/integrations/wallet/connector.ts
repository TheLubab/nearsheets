import { env, type AppEnv } from "../../config/env";

// Call once from the browser wallet provider, not while evaluating a formula.
// Importing this module does not connect a wallet or initialize its SDK.
export async function createWalletConnector(config: AppEnv = env) {
  const { NearConnector } = await import("@hot-labs/near-connect");
  return new NearConnector({
    network: config.VITE_NEAR_NETWORK,
    autoConnect: false,
    ...(config.VITE_WALLET_MANIFEST_URL
      ? { manifest: config.VITE_WALLET_MANIFEST_URL }
      : {}),
  });
}
