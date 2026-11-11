import { describe, expect, it } from "vitest";
import { readEnv } from "../src/config/env";

describe("public environment configuration", () => {
  it("allows local development without optional integrations", () => {
    const env = readEnv({ VITE_TREZU_API_URL: "", VITE_INTENTS_API_URL: "" });
    expect(env.VITE_NEAR_NETWORK).toBe("testnet");
    expect(env.VITE_TREZU_API_URL).toBeUndefined();
    expect(env.VITE_INTENTS_API_URL).toBeUndefined();
  });

  it("accepts configured optional services", () => {
    const env = readEnv({ VITE_INTENTS_API_URL: "https://intents.example.test" });
    expect(env.VITE_INTENTS_API_URL).toBe("https://intents.example.test");
  });

  it.each([
    { VITE_NEAR_NETWORK: "wrong-network" },
    { VITE_NEAR_RPC_URL: "not-a-url" },
    { VITE_WALLET_MANIFEST_URL: "javascript:alert(1)" },
  ])("rejects invalid supplied configuration", (values) => {
    expect(() => readEnv(values)).toThrow("Invalid environment configuration");
  });
});
