import { describe, expect, it } from "vitest";
import {
  createTreasuryReader,
  TreasuryReadError,
} from "../src/features/treasury/application/treasury-reader";
import type { TreasuryReadSource } from "../src/features/treasury/application/treasury-reader";
import type { TreasuryTarget } from "../src/features/treasury/model/treasury-reads";

const target: TreasuryTarget = { network: "testnet", accountId: "dao.testnet" };

const POLICY = {
  roles: [
    { name: "all", kind: { Everyone: {} }, permissions: ["*:AddProposal"], vote_policy: {} },
  ],
  default_vote_policy: {
    weight_kind: "RoleWeight",
    quorum: "0",
    threshold: { Ratio: [1, 2] },
  },
  proposal_bond: "1000000000000000000000000",
  proposal_period: "604800000000000",
};

function proposal(id: number, status = "InProgress") {
  return {
    id,
    proposer: "alice.near",
    description: `Proposal ${id}`,
    status,
    submission_time: "1700000000000000000",
    kind: { Vote: {} },
  };
}

function source(overrides: Partial<TreasuryReadSource> = {}): TreasuryReadSource {
  return {
    label: "Test source",
    readPolicy: async () => POLICY,
    readProposals: async () => [proposal(0), proposal(1)],
    readLastProposalId: async () => 3,
    readBalances: async () => [
      { assetId: "near", symbol: "NEAR", decimals: 24, baseUnits: "1000000000000000000000000" },
    ],
    readProposal: async () => null,
    ...overrides,
  };
}

describe("treasury reader", () => {
  it("validates contract-shaped policy, proposals and balances", async () => {
    const reader = createTreasuryReader(source());
    const policy = await reader.readPolicy(target);
    expect(policy.roles[0]?.name).toBe("all");

    const balances = await reader.readBalances(target);
    expect(balances[0]?.display).toBe("1");

    const proposals = await reader.readProposals(target);
    expect(proposals.lastProposalId).toBe(3);
  });

  it("sorts proposals newest first", async () => {
    const calls: Array<{ fromIndex: number; limit: number }> = [];
    const reader = createTreasuryReader(
      source({
        readProposals: async (_target, page) => {
          calls.push(page);
          return [proposal(0), proposal(1), proposal(2)];
        },
      }),
    );
    const result = await reader.readProposals(target, 3);
    expect(result.proposals.map((entry) => entry.id)).toEqual([2, 1, 0]);
    expect(calls[0]).toEqual({ fromIndex: 0, limit: 3 });
  });

  it("reads the most recent page instead of the first proposals ever made", async () => {
    const calls: Array<{ fromIndex: number; limit: number }> = [];
    const reader = createTreasuryReader(
      source({
        readLastProposalId: async () => 42,
        readProposals: async (_target, page) => {
          calls.push(page);
          return [];
        },
      }),
    );
    await reader.readProposals(target, 10);
    expect(calls[0]).toEqual({ fromIndex: 32, limit: 10 });
  });

  it("clamps an absurd limit so one panel cannot request the whole history", async () => {
    const calls: Array<{ fromIndex: number; limit: number }> = [];
    const reader = createTreasuryReader(
      source({
        readLastProposalId: async () => 1000,
        readProposals: async (_target, page) => {
          calls.push(page);
          return [];
        },
      }),
    );
    await reader.readProposals(target, 100_000);
    expect(calls[0]?.limit).toBe(100);
  });

  it("reports a failed read with the treasury identity", async () => {
    const reader = createTreasuryReader(
      source({
        readPolicy: async () => {
          throw new Error("Account does not exist");
        },
      }),
    );
    await expect(reader.readPolicy(target)).rejects.toThrow(TreasuryReadError);
    await expect(reader.readPolicy(target)).rejects.toThrow(
      /Reading the policy failed for dao\.testnet: Account does not exist/,
    );
  });

  it("turns an unexpected payload into an error instead of a partial treasury", async () => {
    const reader = createTreasuryReader(
      source({ readPolicy: async () => ({ roles: "nope" }) }),
    );
    await expect(reader.readPolicy(target)).rejects.toThrow(/Invalid treasury policy/);
  });

  it("rejects an unexpected last proposal id", async () => {
    const reader = createTreasuryReader(
      source({ readLastProposalId: async () => "many" }),
    );
    await expect(reader.readProposals(target)).rejects.toThrow(
      /unexpected last proposal id/,
    );
  });

  it("exposes the source label rather than claiming an integration is enabled", () => {
    expect(createTreasuryReader(source()).sourceLabel).toBe("Test source");
  });
});