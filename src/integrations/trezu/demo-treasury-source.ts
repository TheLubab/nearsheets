import type {
  ProposalPage,
  TreasuryReadSource,
} from "../../features/treasury/application/treasury-reader";
import type { TreasuryTarget } from "../../features/treasury/model/treasury-reads";

/**
 * Deterministic treasury data for offline review and tests.
 *
 * It is never the default source: showing invented balances for a real DAO
 * would be worse than showing an error. The UI only offers it in a development
 * build, behind an explicit switch, and it refuses accounts that do not carry
 * the `demo` marker.
 *
 * It performs no network I/O and never signs or submits anything.
 */

const DEMO_MARKER = "demo";

export function isDemoTreasuryAccount(accountId: string): boolean {
  return accountId.toLowerCase().includes(DEMO_MARKER);
}

const DEMO_POLICY = {
  roles: [
    {
      name: "all",
      kind: { Everyone: {} },
      permissions: ["*:AddProposal"],
      vote_policy: {},
    },
    {
      name: "council",
      kind: { Group: ["demo-council-1.testnet", "demo-council-2.testnet"] },
      permissions: [
        "*:AddProposal",
        "*:VoteApprove",
        "*:VoteReject",
        "*:VoteRemove",
        "*:Finalize",
      ],
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
};

const NS_PER_SECOND = 1_000_000_000n;

function submissionTime(daysAgo: number): string {
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  return (nowSeconds * NS_PER_SECOND - BigInt(daysAgo) * 86_400n * NS_PER_SECOND)
    .toString();
}

function demoProposals(): unknown[] {
  return [
    {
      id: 0,
      proposer: "demo-council-1.testnet",
      description: "Website refresh",
      status: "Approved",
      submission_time: submissionTime(21),
      kind: {
        Transfer: {
          token_id: "",
          receiver_id: "demo-webstudio.testnet",
          amount: "25000000000000000000000000",
          msg: null,
        },
      },
    },
    {
      id: 1,
      proposer: "demo-council-2.testnet",
      description: "Community meetup catering",
      status: "InProgress",
      submission_time: submissionTime(6),
      kind: {
        Transfer: {
          token_id: "",
          receiver_id: "demo-caterer.testnet",
          amount: "12500000000000000000000000",
          msg: null,
        },
      },
    },
    {
      id: 2,
      proposer: "demo-council-1.testnet",
      description: "Update the council threshold",
      status: "Rejected",
      submission_time: submissionTime(2),
      kind: { ChangePolicyUpdateParameters: {} },
    },
  ];
}

export function createDemoTreasurySource(): TreasuryReadSource {
  const requireDemo = (target: TreasuryTarget) => {
    if (!isDemoTreasuryAccount(target.accountId)) {
      throw new Error(
        `Demo data is only available for accounts containing "demo", not ${target.accountId}.`,
      );
    }
  };

  const proposals = demoProposals();

  return {
    label: "Demo data",

    async readPolicy(target) {
      requireDemo(target);
      return DEMO_POLICY;
    },

    async readProposals(target, page: ProposalPage) {
      requireDemo(target);
      return proposals.slice(page.fromIndex, page.fromIndex + page.limit);
    },

    async readLastProposalId(target) {
      requireDemo(target);
      return proposals.length;
    },

    async readProposal(target, id: number) {
      requireDemo(target);
      return proposals.find((proposal) => (proposal as { id: number }).id === id) ?? null;
    },

    async readBalances(target) {
      requireDemo(target);
      return [
        {
          assetId: "near",
          symbol: "NEAR",
          decimals: 24,
          baseUnits: "142500000000000000000000000",
          note: "Demo balance, not read from a chain.",
        },
        {
          assetId: "nep141:demo-usdc.testnet",
          symbol: "USDC",
          decimals: 6,
          baseUnits: "2450000000",
          note: "Demo fungible token balance.",
        },
      ];
    },
  };
}