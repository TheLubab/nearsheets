import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const httpUrl = z.url().refine(
  (value) => /^https?:\/\//i.test(value),
  "Expected an HTTP(S) URL",
);

/** Public 1Click endpoint used when no provider URL is supplied. */
export const DEFAULT_INTENTS_API_URL = "https://1click.chaindefuser.com";
const intentsApiUrl = z
  .union([httpUrl, z.literal("none")])
  .optional()
  .transform((value) => value === "none" ? undefined : value ?? DEFAULT_INTENTS_API_URL);

/**
 * Vercel Web Analytics is enabled by default. It only reports when served by
 * Vercel; elsewhere its script is unavailable. Disable it with `none`.
 */
const analyticsMode = z
  .union([z.literal("auto"), z.literal("production"), z.literal("development"), z.literal("none")])
  .default("auto")
  .transform((value) => value === "none" ? undefined : value);

export function readEnv(runtimeEnv: Record<string, string | number | boolean | undefined>) {
  return createEnv({
    clientPrefix: "VITE_",
    client: {
      // Network and optional authoritative RPC override.
      VITE_NEAR_NETWORK: z.enum(["mainnet", "testnet"]).default("testnet"),
      VITE_NEAR_RPC_URL: httpUrl.optional(),

      // Public services have built-in defaults and an explicit "none" opt-out.
      VITE_INTENTS_API_URL: intentsApiUrl,
      VITE_VERCEL_ANALYTICS_MODE: analyticsMode,

      // Optional integrations; no separate service is required for normal use.
      VITE_WALLET_MANIFEST_URL: httpUrl.optional(),
      VITE_AUTH_API_URL: httpUrl.optional(),
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
