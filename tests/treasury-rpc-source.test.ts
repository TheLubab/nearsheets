import { describe, expect, it } from "vitest";
import { createNearRpcTreasurySource } from "../src/integrations/trezu/treasury-rpc-source";
import type { NearViewClient } from "../src/integrations/trezu/treasury-rpc-source";
import { createTreasuryReader } from "../src/features/treasury/application/treasury-reader";

const source = { label: "NEAR RPC" };

function clientWith(results: Record<string, unknown>): {
  client: NearViewClient;
  calls: Array<{ contractId: string; method: string; args: Record<string, unknown> }>;
} {
  const calls: Array<{ contractId: string; method: string; args: Record<string, unknown> }> = [];
  const client: NearViewClient = {
    async callFunction(params) {
      calls.push(params);
      if (!(params.method in results)) {
        throw new Error(`Unexpected method ${params.method}`);
      }
      const value = results[params.method];
      return value as object | undefined;
    },
    async viewAccount() {
      return { amount: 1500000000000000000000000n };
    },
  };
  return { client, calls };
}

describe("NEAR RPC treasury source", () => {
  it("reads the policy, proposals and native balance with view calls only", async () => {
    const { client, calls } = clientWith({
      get_policy: {
        roles: [{ name: "all", kind: { Everyone: {} }, permissions: ["*:AddProposal"], vote_policy: {} }],
        default_vote_policy: {
          weight_kind: "RoleWeight",
          quorum: "0",
          threshold: { Ratio: [1, 2] },
        },
        proposal_bond: "1000000000000000000000000",
        proposal_period: "604800000000000",
      },
      get_last_proposal_id: 0,
      get_proposals: [],
    });
    const reader = createTreasuryReader(
      createNearRpcTreasurySource({ network: "testnet", client }),
    );

    const policy = await reader.readPolicy({ network: "testnet", accountId: "dao.testnet" });
    expect(policy.roles).toHaveLength(1);

    const proposals = await reader.readProposals(
      { network: "testnet", accountId: "dao.testnet" },
      5,
    );
    expect(proposals).toEqual({ proposals: [], lastProposalId: 0 });

    const balances = await reader.readBalances({ network: "testnet", accountId: "dao.testnet" });
    expect(balances[0]).toMatchObject({ assetId: "near", display: "1.5" });

    // Only DAO view methods were called; there is no transaction or sign path.
    expect(calls.every((call) => call.contractId === "dao.testnet")).toBe(true);
    expect(calls.map((call) => call.method)).toEqual([
      "get_policy",
      "get_last_proposal_id",
      "get_proposals",
    ]);
    expect(calls[2]?.args).toEqual({ from_index: 0, limit: 5 });
  });

  it("fails clearly when the contract returns nothing", async () => {
    const client: NearViewClient = {
      async callFunction() {
        return undefined;
      },
      async viewAccount() {
        return { amount: 0n };
      },
    };
    const reader = createTreasuryReader(
      createNearRpcTreasurySource({ network: "testnet", client }),
    );
    await expect(
      reader.readPolicy({ network: "testnet", accountId: "missing.testnet" }),
    ).rejects.toThrow(/returned no result for "get_policy"/);
  });

  it("does not guess token balances beyond native NEAR", async () => {
    const { client } = clientWith({});
    const sourceAdapter = createNearRpcTreasurySource({ network: "mainnet", client });
    const balances = await sourceAdapter.readBalances({ network: "mainnet", accountId: "dao.near" });
    expect(Array.isArray(balances)).toBe(true);
    expect((balances as unknown[]).length).toBe(1);
    expect((balances as Array<{ assetId: string }>)[0]?.assetId).toBe("near");
  });

  it("labels itself as the RPC source", () => {
    const { client } = clientWith({});
    expect(
      createNearRpcTreasurySource({ network: "testnet", client }).label,
    ).toBe(source.label);
  });
});