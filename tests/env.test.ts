import { describe, expect, it } from "vitest";
import { DEFAULT_INTENTS_API_URL, readEnv } from "../src/config/env";

describe("public environment configuration", () => {
  it("uses the public Intents provider when no URL is supplied", () => {
    const env = readEnv({ VITE_INTENTS_API_URL: "" });
    expect(env.VITE_NEAR_NETWORK).toBe("testnet");
    expect(env.VITE_INTENTS_API_URL).toBe(DEFAULT_INTENTS_API_URL);
  });

  it("accepts configured optional services", () => {
    const env = readEnv({
      VITE_INTENTS_API_URL: "https://intents.example.test",
      VITE_AUTH_API_URL: "https://auth.example.test",
      VITE_WALLET_MANIFEST_URL: "https://wallets.example.test/manifest.json",
    });
    expect(env.VITE_INTENTS_API_URL).toBe("https://intents.example.test");
    expect(env.VITE_AUTH_API_URL).toBe("https://auth.example.test");
    expect(env.VITE_WALLET_MANIFEST_URL).toBe("https://wallets.example.test/manifest.json");
  });

  it("allows explicitly disabling the default Intents provider", () => {
    const env = readEnv({ VITE_INTENTS_API_URL: "none" });
    expect(env.VITE_INTENTS_API_URL).toBeUndefined();
  });

  it("enables Vercel Analytics automatically by default", () => {
    expect(readEnv({}).VITE_VERCEL_ANALYTICS_MODE).toBe("auto");
  });

  it("allows forcing or disabling Vercel Analytics", () => {
    expect(readEnv({ VITE_VERCEL_ANALYTICS_MODE: "production" }).VITE_VERCEL_ANALYTICS_MODE).toBe("production");
    expect(readEnv({ VITE_VERCEL_ANALYTICS_MODE: "none" }).VITE_VERCEL_ANALYTICS_MODE).toBeUndefined();
  });

  it.each([
    { VITE_NEAR_NETWORK: "wrong-network" },
    { VITE_NEAR_RPC_URL: "not-a-url" },
    { VITE_WALLET_MANIFEST_URL: "javascript:alert(1)" },
    { VITE_AUTH_API_URL: "not-a-url" },
    { VITE_INTENTS_API_URL: "off" },
    { VITE_VERCEL_ANALYTICS_MODE: "sometimes" },
  ])("rejects invalid supplied configuration", (values) => {
    expect(() => readEnv(values)).toThrow("Invalid environment configuration");
  });
});
