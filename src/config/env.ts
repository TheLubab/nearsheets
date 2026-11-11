import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const httpUrl = z.url().refine(
  (value) => /^https?:\/\//i.test(value),
  "Expected an HTTP(S) URL",
);

export function readEnv(runtimeEnv: Record<string, string | number | boolean | undefined>) {
  return createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_NEAR_NETWORK: z.enum(["mainnet", "testnet"]).default("testnet"),
      VITE_NEAR_RPC_URL: httpUrl.optional(),
      VITE_WALLET_MANIFEST_URL: httpUrl.optional(),
      VITE_AUTH_API_URL: httpUrl.optional(),
      VITE_TREZU_API_URL: httpUrl.optional(),
      VITE_INTENTS_API_URL: httpUrl.optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
    // Do not log configuration values when reporting validation failures.
    onValidationError: (issues) => {
      const names = issues.map((issue) => issue.path?.join(".") ?? "configuration");
      throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
    },
  });
}

export type AppEnv = ReturnType<typeof readEnv>;

// Vite supplies import.meta.env; the fallback supports isolated Node tests.
export const env = readEnv(import.meta.env ?? {});
