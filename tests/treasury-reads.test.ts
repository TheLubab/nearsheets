import { describe, expect, it } from "vitest";
import {
  describeRoleKind,
  describeThreshold,
  evaluatePermission,
  formatNanosecondPeriod,
  formatNearBaseUnits,
  parseTreasuryBalances,
  parseTreasuryPolicy,
  parseTreasuryProposals,
  roleMembership,
  rolesForAccount,
} from "../src/features/treasury/model/treasury-reads";

const POLICY = {
  roles: [
    {
      name: "all",
      kind: { Everyone: {} },
      permissions: ["*:AddProposal"],
      vote_policy: {},
    },
    {
      name: "council",
      kind: { Group: ["alice.near", "bob.near"] },
      permissions: [
        "*:AddProposal",
        "*:VoteApprove",
        "*:VoteReject",
        "*:Finalize",
      ],
      vote_policy: {},
    },
    {
      name: "stakers",
      kind: { Member: "1000000000000000000000000" },
      permissions: ["transfer:*"],
      vote_policy: {},
    },
  ],
  default_vote_policy: {
    weight_kind: "RoleWeight",
    quorum: "0",
    threshold: { Ratio: [1, 2] },
  },
  proposal_bond: "1000000000000000000000000",
  proposal_period: "604800000000000",
  bounty_bond: "1000000000000000000000000",
  bounty_forgiveness_period: "86400000000000",
};

describe("treasury policy parsing", () => {
  it("reads a contract policy and ignores fields the UI does not show", () => {
    const parsed = parseTreasuryPolicy(POLICY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.value.roles.map((role) => role.name)).toEqual([
      "all",
      "council",
      "stakers",
    ]);
    expect(parsed.value.proposalBondBaseUnits).toBe("1000000000000000000000000");
    expect(parsed.value.defaultVotePolicy.threshold).toEqual({
      type: "ratio",
      numerator: 1,
      denominator: 2,
    });
  });

  it("rejects a malformed policy instead of filling in defaults", () => {
    const parsed = parseTreasuryPolicy({
      roles: [{ name: "", kind: { Everyone: {} }, permissions: [] }],
      default_vote_policy: POLICY.default_vote_policy,
      proposal_bond: "1",
      proposal_period: "1",
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects a threshold shape it does not understand", () => {
    const parsed = parseTreasuryPolicy({
      ...POLICY,
      default_vote_policy: {
        ...POLICY.default_vote_policy,
        threshold: { Ratio: "1/2" },
      },
    });
    expect(parsed.ok).toBe(false);
  });

  it("requires integer base-unit strings, not numbers", () => {
    const parsed = parseTreasuryPolicy({
      ...POLICY,
      proposal_bond: 1000000000000000000000000,
    });
    expect(parsed.ok).toBe(false);
  });
});

describe("role membership and permissions", () => {
  const policy = parseTreasuryPolicy(POLICY);
  if (!policy.ok) {
    throw new Error(policy.error);
  }

  it("treats a group role as decided and a token role as undecided", () => {
    const [everyone, council, stakers] = policy.value.roles;
    expect(roleMembership(everyone!, "anyone.near")).toBe("member");
    expect(roleMembership(council!, "alice.near")).toBe("member");
    expect(roleMembership(council!, "carol.near")).toBe("not-member");
    expect(roleMembership(stakers!, "alice.near")).toBe("unknown");
  });

  it("allows an action through a wildcard permission", () => {
    const check = evaluatePermission(policy.value, "alice.near", "transfer", "VoteApprove");
    expect(check.allowed).toBe(true);
    expect(check.roles).toContain("council");
  });

  it("does not grant an action nobody is allowed to take", () => {
    const check = evaluatePermission(policy.value, "carol.near", "transfer", "VoteApprove");
    expect(check).toBeTruthy();
    // `all` only has AddProposal, and stakers requires a balance not read here.
    expect(check.allowed).toBe(false);
    expect(check.roles).toEqual([]);
    expect(check.unknownRoles).toEqual(["stakers"]);
  });

  it("distinguishes a definite denial from an undecided token role", () => {
    // `transfer:*` on the token role does not match a config action, so this is
    // a real denial rather than "maybe, once a balance is read".
    const check = evaluatePermission(policy.value, "alice.near", "config", "RemoveProposal");
    expect(check.allowed).toBe(false);
    expect(check.roles).toEqual([]);
    expect(check.unknownRoles).toEqual([]);
  });

  it("reports roles and undecided roles for an account", () => {
    expect(rolesForAccount(policy.value, "bob.near")).toEqual({
      roles: ["all", "council"],
      unknownRoles: ["stakers"],
    });
  });
});

describe("formatting helpers", () => {
  it("formats yoctoNEAR exactly", () => {
    expect(formatNearBaseUnits("1000000000000000000000000")).toBe("1");
    expect(formatNearBaseUnits("1500000000000000000000000")).toBe("1.5");
    expect(formatNearBaseUnits("0")).toBe("0");
  });

  it("formats proposal periods in the largest exact unit", () => {
    expect(formatNanosecondPeriod("604800000000000")).toBe("7 days");
    expect(formatNanosecondPeriod("86400000000000")).toBe("1 day");
    expect(formatNanosecondPeriod("3600000000000")).toBe("1 hour");
    expect(formatNanosecondPeriod("60000000000")).toBe("1 minute");
    expect(formatNanosecondPeriod("1500000000")).toBe("1 second");
  });

  it("describes roles and thresholds for humans", () => {
    expect(describeRoleKind({ type: "everyone" })).toBe("Everyone");
    expect(describeRoleKind({ type: "group", members: ["a", "b"] })).toBe("Group of 2");
    expect(describeRoleKind({ type: "member", minimumBaseUnits: "1000000000000000000000000" })).toBe(
      "Token holders ≥ 1",
    );
    expect(describeThreshold({ type: "ratio", numerator: 1, denominator: 2 })).toBe("1/2 (50%)");
    expect(describeThreshold({ type: "weight", baseUnits: "5" })).toBe("5 weight");
  });
});

describe("proposal parsing", () => {
  const base = {
    id: 3,
    proposer: "alice.near",
    status: "InProgress",
    submission_time: "1700000000000000000",
  };

  it("converts a nanosecond submission time into an ISO timestamp", () => {
    const parsed = parseTreasuryProposals([
      {
        ...base,
        description: "Pay design",
        kind: {
          Transfer: {
            token_id: "",
            receiver_id: "sara.near",
            amount: "30000000000000000000000000",
            msg: null,
          },
        },
      },
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.value[0]?.submittedAt).toBe("2023-11-14T22:13:20.000Z");
    expect(parsed.value[0]?.kind).toBe("transfer");
    expect(parsed.value[0]?.transfer).toEqual({
      tokenId: null,
      receiverId: "sara.near",
      amountBaseUnits: "30000000000000000000000000",
    });
  });

  it("maps untranslated proposal kinds to their policy label", () => {
    const parsed = parseTreasuryProposals([
      { ...base, kind: { ChangePolicyUpdateParameters: {} } },
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value[0]?.kind).toBe("policy_update_parameters");
      expect(parsed.value[0]?.transfer).toBeNull();
    }
  });

  it("keeps the fungible token id, which distinguishes an FT transfer from NEAR", () => {
    const parsed = parseTreasuryProposals([
      {
        ...base,
        kind: {
          Transfer: {
            token_id: "usdc.near",
            receiver_id: "sara.near",
            amount: "2500000",
          },
        },
      },
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value[0]?.transfer?.tokenId).toBe("usdc.near");
    }
  });

  it("rejects an unknown status rather than displaying it as valid", () => {
    expect(parseTreasuryProposals([{ ...base, status: "Pending" }]).ok).toBe(false);
  });

  it("rejects a non-integer transfer amount", () => {
    const parsed = parseTreasuryProposals([
      {
        ...base,
        kind: {
          Transfer: { token_id: "", receiver_id: "sara.near", amount: "1.5" },
        },
      },
    ]);
    expect(parsed.ok).toBe(false);
  });
});

describe("balance parsing", () => {
  it("derives a display amount from exact base units", () => {
    const parsed = parseTreasuryBalances([
      { assetId: "near", symbol: "NEAR", decimals: 24, baseUnits: "1500000000000000000000000" },
      { assetId: "usdc", symbol: "USDC", decimals: 6, baseUnits: "2500000" },
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value[0]?.display).toBe("1.5");
      expect(parsed.value[1]?.display).toBe("2.5");
    }
  });

  it("derives long amounts without losing digits", () => {
    const parsed = parseTreasuryBalances([
      { assetId: "big", symbol: "BIG", decimals: 2, baseUnits: "1500000000000000000000000" },
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value[0]?.display).toBe("15000000000000000000000");
    }
  });

  it("rejects a precision that is not a whole number", () => {
    const invalid = parseTreasuryBalances([
      { assetId: "odd", symbol: "ODD", decimals: 24.5, baseUnits: "1" },
    ]);
    expect(invalid.ok).toBe(false);
  });
});