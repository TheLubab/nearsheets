import { describe, expect, it, vi } from "vitest";
import {
  createDemoTreasurySource,
  isDemoTreasuryAccount,
} from "../src/integrations/sputnik/demo-treasury-source";
import { createTreasuryReader } from "../src/features/treasury/application/treasury-reader";
import {
  createTreasuryReaderForNetwork,
  describeIntegrations,
} from "../src/features/treasury/application/treasury-source";
import { readEnv } from "../src/config/env";
import type { NearViewClient } from "../src/integrations/sputnik/treasury-rpc-source";

/**
 * The read path with demo data.
 *
 * Demo data stands in for a contract so pagination, ordering, validation and
 * the routing between demo and real accounts can be checked without a network.
 */
describe("demo treasury source", () => {
  const reader = createTreasuryReader(createDemoTreasurySource());
  const target = { network: "testnet" as const, accountId: "demo-dao.testnet" };

  it("returns a policy the panel can render", async () => {
    const policy = await reader.readPolicy(target);
    expect(policy.roles.map((role) => role.name)).toEqual(["all", "council"]);
    expect(policy.defaultVotePolicy.weightKind).toBe("RoleWeight");
  });

  it("returns proposals newest first", async () => {
    const result = await reader.readProposals(target, 2);
    expect(result.lastProposalId).toBe(3);
    expect(result.proposals.map((proposal) => proposal.id)).toEqual([2, 1]);
  });

  it("returns native and fungible balances with exact display values", async () => {
    const balances = await reader.readBalances(target);
    expect(balances.map((balance) => balance.assetId)).toEqual([
      "near",
      "nep141:demo-usdc.testnet",
    ]);
    expect(balances[0]?.display).toBe("142.5");
    expect(balances[1]?.display).toBe("2450");
  });

  it("uses sample data only because the sample source was explicitly selected", async () => {
    await expect(
      reader.readPolicy({ network: "testnet", accountId: "real-dao.testnet" }),
    ).resolves.toHaveProperty("roles");
  });

  it("identifies demo accounts by a visible marker", () => {
    expect(isDemoTreasuryAccount("demo-dao.testnet")).toBe(true);
    expect(isDemoTreasuryAccount("my.sputnik-dao.near")).toBe(false);
  });
});

describe("routing between demo and real reads", () => {
  function clientThatRecords(calls: string[]): NearViewClient {
    return {
      async callFunction(params) {
        calls.push(params.contractId);
        if (params.method === "get_last_proposal_id") {
          return 5;
        }
        if (params.method === "get_proposals") {
          return [];
        }
        return {
          roles: [{ name: "all", kind: { Everyone: {} }, permissions: [], vote_policy: {} }],
          default_vote_policy: {
            weight_kind: "RoleWeight",
            quorum: "0",
            threshold: { Ratio: [1, 2] },
          },
          proposal_bond: "1",
          proposal_period: "1",
        };
      },
      async viewAccount() {
        return { amount: 0n };
      },
    };
  }

  it("uses explicitly selected sample source for every account", async () => {
    const calls: string[] = [];
    const reader = createTreasuryReaderForNetwork({
      network: "testnet",
      client: clientThatRecords(calls),
      allowDemo: true,
    });

    const demoPolicy = await reader.readPolicy({
      network: "testnet",
      accountId: "demo-dao.testnet",
    });
    expect(demoPolicy.roles.map((role) => role.name)).toEqual(["all", "council"]);
    expect(calls).toEqual([]);

    await reader.readProposals({ network: "testnet", accountId: "real.testnet" });
    expect(calls).toEqual([]);
  });

  it("never serves demo data when it is not enabled", async () => {
    const calls: string[] = [];
    const reader = createTreasuryReaderForNetwork({
      network: "testnet",
      client: clientThatRecords(calls),
      allowDemo: false,
    });
    // A demo-looking account still goes to RPC, so production cannot show
    // invented balances.
    await reader.readProposals({ network: "testnet", accountId: "demo-dao.testnet" });
    expect(calls).toEqual(["demo-dao.testnet", "demo-dao.testnet"]);
  });
});

describe("integration readiness reporting", () => {
  it("reports configuration without claiming an adapter exists", () => {
    const configured = readEnv({
      VITE_TREZU_API_URL: "https://trezu.example.test",
      VITE_INTENTS_API_URL: "https://intents.example.test",
    });
    const byKey = Object.fromEntries(
      describeIntegrations(configured).map((status) => [status.key, status]),
    );

    expect(byKey["near-rpc"]?.state).toBe("available");
    expect(byKey["trezu-api"]?.state).toBe("configured-no-adapter");
    expect(byKey["intents-api"]?.state).toBe("available");
  });

  it("keeps an unconfigured integration unavailable", () => {
    const byKey = Object.fromEntries(
      describeIntegrations(readEnv({})).map((status) => [status.key, status]),
    );

    expect(byKey["trezu-api"]?.state).toBe("not-configured");
    expect(byKey["intents-api"]?.state).toBe("not-configured");
    expect(byKey["wallet-manifest"]?.state).toBe("not-configured");
    // RPC reads work without optional services.
    expect(byKey["near-rpc"]?.state).toBe("available");
  });

  it("lists demo data as a development-only source", () => {
    const byKey = Object.fromEntries(
      describeIntegrations(readEnv({}), { demoData: true }).map((status) => [status.key, status]),
    );
    expect(byKey["demo-data"]?.state).toBe("available");

    const production = Object.fromEntries(
      describeIntegrations(readEnv({})).map((status) => [status.key, status]),
    );
    expect(production["demo-data"]).toBeUndefined();
  });

  it("performs no network read while describing integrations", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const reader = createTreasuryReaderForNetwork({ network: "testnet", allowDemo: true });
    describeIntegrations(readEnv({ VITE_TREZU_API_URL: "https://trezu.example.test" }), {
      demoData: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    // Constructing a reader also does not query.
    expect(reader.sourceLabel).toContain("sample");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});