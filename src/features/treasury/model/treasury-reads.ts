import { z } from "zod";
import { amountFromBaseUnits } from "./exact-amount";

/**
 * Read-only treasury data.
 *
 * These are shapes the application reads, never actions it performs. Nothing in
 * this module signs, submits or contacts a network; adapters supply raw
 * contract-shaped JSON and the parsers below reject anything unexpected instead
 * of filling in guessed values.
 *
 * The policy types follow Sputnik DAO v2 `get_policy`. Proposal and balance
 * shapes are kept narrow: only fields the UI can display are modelled, so an
 * unknown future contract field cannot break a read.
 */

export type TreasuryNetwork = "mainnet" | "testnet";

/** A treasury the user asked to read. Unlike document metadata, the account is known. */
export interface TreasuryTarget {
  network: TreasuryNetwork;
  accountId: string;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function describeIssues(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "unexpected structure";
  }
  const path = issue.path.join(".");
  return `${path.length > 0 ? path : "value"}: ${issue.message}`;
}

/* ------------------------------------------------------------------ */
/* Policy                                                              */
/* ------------------------------------------------------------------ */

export type TreasuryRoleKind =
  | { type: "everyone" }
  | { type: "group"; members: string[] }
  | {
      type: "member";
      /** Minimum balance required, in the staking token's base units. */
      minimumBaseUnits: string;
    };

export interface TreasuryRole {
  name: string;
  kind: TreasuryRoleKind;
  /**
   * Permissions are `<proposal-label>:<action>` strings such as
   * `transfer:VoteApprove`. Wildcards (`transfer:*`, `*:VoteApprove`, `*:*`)
   * are preserved verbatim so matching follows the contract's own rules.
   */
  permissions: string[];
}

export type TreasuryThreshold =
  | { type: "ratio"; numerator: number; denominator: number }
  | { type: "weight"; baseUnits: string };

export interface TreasuryVotePolicy {
  weightKind: "TokenWeight" | "RoleWeight";
  quorumBaseUnits: string;
  threshold: TreasuryThreshold;
}

export interface TreasuryPolicy {
  roles: TreasuryRole[];
  defaultVotePolicy: TreasuryVotePolicy;
  /** Proposal bond in yoctoNEAR. */
  proposalBondBaseUnits: string;
  /** Proposal lifetime in nanoseconds. */
  proposalPeriodNs: string;
}

const roleKindSchema = z.union([
  z
    .strictObject({ Everyone: z.unknown() })
    .transform((): TreasuryRoleKind => ({ type: "everyone" })),
  z
    .strictObject({ Member: z.string().regex(/^\d+$/) })
    .transform(
      (value): TreasuryRoleKind => ({
        type: "member",
        minimumBaseUnits: value.Member,
      }),
    ),
  z
    .strictObject({ Group: z.array(z.string().min(1)) })
    .transform(
      (value): TreasuryRoleKind => ({ type: "group", members: value.Group }),
    ),
]);

const thresholdSchema = z.union([
  z
    .strictObject({ Ratio: z.tuple([z.number().int(), z.number().int()]) })
    .transform(
      (value): TreasuryThreshold => ({
        type: "ratio",
        numerator: value.Ratio[0],
        denominator: value.Ratio[1],
      }),
    ),
  z
    .strictObject({ Weight: z.string().regex(/^\d+$/) })
    .transform(
      (value): TreasuryThreshold => ({
        type: "weight",
        baseUnits: value.Weight,
      }),
    ),
]);

const votePolicySchema = z.object({
  weight_kind: z.enum(["TokenWeight", "RoleWeight"]),
  quorum: z.string().regex(/^\d+$/),
  threshold: thresholdSchema,
});

const roleSchema = z.object({
  name: z.string().min(1),
  kind: roleKindSchema,
  permissions: z.array(z.string().min(1)),
});

const policySchema = z
  .object({
    roles: z.array(roleSchema).min(1),
    default_vote_policy: votePolicySchema,
    proposal_bond: z.string().regex(/^\d+$/),
    proposal_period: z.string().regex(/^\d+$/),
  })
  .transform(
    (raw): TreasuryPolicy => ({
      roles: raw.roles,
      defaultVotePolicy: {
        weightKind: raw.default_vote_policy.weight_kind,
        quorumBaseUnits: raw.default_vote_policy.quorum,
        threshold: raw.default_vote_policy.threshold,
      },
      proposalBondBaseUnits: raw.proposal_bond,
      proposalPeriodNs: raw.proposal_period,
    }),
  );

/**
 * Validates a contract `get_policy` response.
 *
 * `bounty_bond` and other fields this UI does not display are ignored, so a
 * contract addition does not break the read.
 */
export function parseTreasuryPolicy(raw: unknown): ParseResult<TreasuryPolicy> {
  const parsed = policySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `Invalid treasury policy: ${describeIssues(parsed.error)}` };
  }
  return { ok: true, value: parsed.data };
}

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

export type RoleMembership = "member" | "not-member" | "unknown";

/**
 * Decides role membership.
 *
 * Token-weighted (`Member`) roles depend on a balance this application does not
 * read yet, so they report `unknown` instead of being treated as granted or
 * denied. Guessing would either hide a valid permission or promise one the DAO
 * will reject.
 */
export function roleMembership(role: TreasuryRole, accountId: string): RoleMembership {
  switch (role.kind.type) {
    case "everyone":
      return "member";
    case "group":
      return role.kind.members.includes(accountId) ? "member" : "not-member";
    case "member":
      return "unknown";
  }
}

export interface PermissionCheck {
  /** `true` only when a definitely-matching role grants the action. */
  allowed: boolean;
  /** Roles that definitely grant the action. */
  roles: string[];
  /** Roles that would decide it but whose membership cannot be read here. */
  unknownRoles: string[];
}

function permissionCandidates(kind: string, action: string): string[] {
  return [`${kind}:${action}`, `${kind}:*`, `*:${action}`, `*:*`];
}

/**
 * Evaluates one action against the DAO policy using the contract's wildcard
 * rules. This is a local calculation over already-read data; it never asks the
 * contract whether a vote will be accepted.
 */
export function evaluatePermission(
  policy: TreasuryPolicy,
  accountId: string,
  proposalKind: string,
  action: string,
): PermissionCheck {
  const candidates = new Set(permissionCandidates(proposalKind, action));
  const roles: string[] = [];
  const unknownRoles: string[] = [];

  for (const role of policy.roles) {
    const membership = roleMembership(role, accountId);
    if (membership === "not-member") {
      continue;
    }
    if (!role.permissions.some((permission) => candidates.has(permission.trim()))) {
      continue;
    }
    if (membership === "member") {
      roles.push(role.name);
    } else {
      unknownRoles.push(role.name);
    }
  }

  return { allowed: roles.length > 0, roles, unknownRoles };
}

/** Roles the account definitely belongs to, plus roles that cannot be decided. */
export function rolesForAccount(
  policy: TreasuryPolicy,
  accountId: string,
): { roles: string[]; unknownRoles: string[] } {
  const roles: string[] = [];
  const unknownRoles: string[] = [];
  for (const role of policy.roles) {
    const membership = roleMembership(role, accountId);
    if (membership === "member") {
      roles.push(role.name);
    } else if (membership === "unknown") {
      unknownRoles.push(role.name);
    }
  }
  return { roles, unknownRoles };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

/** `1` for `1000000000000000000000000` yoctoNEAR. */
export function formatNearBaseUnits(baseUnits: string): string {
  const amount = amountFromBaseUnits(baseUnits, 24);
  return amount ? amount.display : baseUnits;
}

/** Describes a nanosecond duration in days, hours or minutes when exact. */
export function formatNanosecondPeriod(ns: string): string {
  if (!/^\d+$/.test(ns)) {
    return ns;
  }
  const seconds = BigInt(ns) / 1_000_000_000n;
  const day = 86_400n;
  if (seconds % day === 0n) {
    const days = seconds / day;
    return `${days} day${days === 1n ? "" : "s"}`;
  }
  const hour = 3_600n;
  if (seconds % hour === 0n) {
    const hours = seconds / hour;
    return `${hours} hour${hours === 1n ? "" : "s"}`;
  }
  const minute = 60n;
  if (seconds % minute === 0n) {
    const minutes = seconds / minute;
    return `${minutes} minute${minutes === 1n ? "" : "s"}`;
  }
  return `${seconds} second${seconds === 1n ? "" : "s"}`;
}

export function describeThreshold(threshold: TreasuryThreshold): string {
  if (threshold.type === "ratio") {
    const { numerator, denominator } = threshold;
    if (denominator === 0) {
      return `${numerator}/${denominator}`;
    }
    const percent = (numerator / denominator) * 100;
    return `${numerator}/${denominator} (${Number.isInteger(percent) ? percent : percent.toFixed(1)}%)`;
  }
  return `${threshold.baseUnits} weight`;
}

export function describeRoleKind(kind: TreasuryRoleKind): string {
  switch (kind.type) {
    case "everyone":
      return "Everyone";
    case "group":
      return `Group of ${kind.members.length}`;
    case "member":
      return `Token holders ≥ ${formatNearBaseUnits(kind.minimumBaseUnits)}`;
  }
}

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

export const PROPOSAL_STATUSES = [
  "InProgress",
  "Approved",
  "Rejected",
  "Removed",
  "Expired",
  "Moved",
  "Failed",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** `kind.to_policy_label()` from Sputnik; used for permission matching. */
const PROPOSAL_KIND_LABELS: Record<string, string> = {
  ChangeConfig: "config",
  ChangePolicy: "policy",
  AddMemberToRole: "add_member_to_role",
  RemoveMemberFromRole: "remove_member_from_role",
  FunctionCall: "call",
  UpgradeSelf: "upgrade_self",
  UpgradeRemote: "upgrade_remote",
  Transfer: "transfer",
  SetStakingContract: "set_vote_token",
  AddBounty: "add_bounty",
  BountyDone: "bounty_done",
  Vote: "vote",
  FactoryInfoUpdate: "factory_info_update",
  ChangePolicyAddOrUpdateRole: "policy_add_or_update_role",
  ChangePolicyRemoveRole: "policy_remove_role",
  ChangePolicyUpdateDefaultVotePolicy: "policy_update_default_vote_policy",
  ChangePolicyUpdateParameters: "policy_update_parameters",
};

export const PROPOSAL_KIND_DISPLAY: Record<string, string> = {
  config: "Config change",
  policy: "Policy change",
  add_member_to_role: "Add member",
  remove_member_from_role: "Remove member",
  call: "Function call",
  upgrade_self: "Upgrade",
  upgrade_remote: "Upgrade remote",
  transfer: "Transfer",
  set_vote_token: "Set staking contract",
  add_bounty: "Add bounty",
  bounty_done: "Bounty done",
  vote: "Vote",
  factory_info_update: "Factory update",
  policy_add_or_update_role: "Add or update role",
  policy_remove_role: "Remove role",
  policy_update_default_vote_policy: "Update vote policy",
  policy_update_parameters: "Update parameters",
};

export interface TreasuryProposalTransfer {
  /** `null` means native NEAR. */
  tokenId: string | null;
  receiverId: string;
  amountBaseUnits: string;
}

export interface TreasuryProposal {
  id: number;
  proposer: string;
  description: string;
  status: ProposalStatus;
  /** ISO timestamp converted from the contract's nanosecond value. */
  submittedAt: string;
  /** Sputnik policy label, e.g. `transfer`. */
  kind: string;
  transfer: TreasuryProposalTransfer | null;
}

const MAX_DATE_MS = 8_640_000_000_000_000n;

const submissionTimeSchema = z
  .string()
  .regex(/^\d+$/)
  .refine((value) => BigInt(value) / 1_000_000n <= MAX_DATE_MS, {
    message: "timestamp is outside the representable date range",
  });

const transferKindSchema = z.strictObject({
  Transfer: z.object({
    token_id: z.string(),
    receiver_id: z.string().min(1),
    amount: z.string().regex(/^\d+$/),
    msg: z.string().nullable().optional(),
  }),
});

/**
 * A proposal kind is normally a single-key enum object. Two details matter:
 *
 * - `Transfer` must be validated as a transfer. Falling back to "unknown kind"
 *   on a malformed amount would hide a payment the user cannot verify.
 * - Unit variants such as `Vote` serialize as a plain string.
 */
const proposalKindSchema = z.union([
  z
    .string()
    .min(1)
    .transform((label) => ({ label: label.toLowerCase(), transfer: null })),
  z.record(z.string(), z.unknown()).transform((value, ctx) => {
    const key = Object.keys(value)[0];
    if (!key) {
      ctx.addIssue({ code: "custom", message: "proposal kind is empty" });
      return z.NEVER;
    }
    if (key === "Transfer") {
      const parsed = transferKindSchema.safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          message: `invalid transfer proposal: ${describeIssues(parsed.error)}`,
        });
        return z.NEVER;
      }
      return {
        label: "transfer",
        transfer: {
          tokenId: parsed.data.Transfer.token_id.length > 0 ? parsed.data.Transfer.token_id : null,
          receiverId: parsed.data.Transfer.receiver_id,
          amountBaseUnits: parsed.data.Transfer.amount,
        } satisfies TreasuryProposalTransfer,
      };
    }
    return {
      label: PROPOSAL_KIND_LABELS[key] ?? key.toLowerCase(),
      transfer: null,
    };
  }),
]);

const proposalSchema = z
  .object({
    id: z.number().int().nonnegative(),
    proposer: z.string().min(1),
    description: z.string().optional().default(""),
    status: z.enum(PROPOSAL_STATUSES),
    submission_time: submissionTimeSchema,
    kind: proposalKindSchema,
  })
  .transform(
    (raw): TreasuryProposal => ({
      id: raw.id,
      proposer: raw.proposer,
      description: raw.description,
      status: raw.status,
      submittedAt: new Date(
        Number(BigInt(raw.submission_time) / 1_000_000n),
      ).toISOString(),
      kind: raw.kind.label,
      transfer: raw.kind.transfer,
    }),
  );

/** Validates a `get_proposals` / `get_proposal` response body. */
export function parseTreasuryProposals(raw: unknown): ParseResult<TreasuryProposal[]> {
  const parsed = z.array(proposalSchema).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `Invalid proposals: ${describeIssues(parsed.error)}` };
  }
  return { ok: true, value: parsed.data };
}

/* ------------------------------------------------------------------ */
/* Balances                                                            */
/* ------------------------------------------------------------------ */

export interface TreasuryBalance {
  assetId: string;
  symbol: string;
  decimals: number;
  baseUnits: string;
  /** Exact display amount derived from the base units. */
  display: string;
  note: string | null;
}

const balanceSchema = z
  .object({
    assetId: z.string().min(1),
    symbol: z.string().min(1),
    decimals: z.number().int().min(0).max(24),
    baseUnits: z.string().regex(/^\d+$/),
    note: z.string().min(1).optional(),
  })
  .refine(
    (value) => amountFromBaseUnits(value.baseUnits, value.decimals) !== null,
    "balance is not representable at the declared precision",
  )
  .transform(
    (raw): TreasuryBalance => ({
      assetId: raw.assetId,
      symbol: raw.symbol,
      decimals: raw.decimals,
      baseUnits: raw.baseUnits,
      display: amountFromBaseUnits(raw.baseUnits, raw.decimals)?.display ?? raw.baseUnits,
      note: raw.note ?? null,
    }),
  );

export function parseTreasuryBalances(raw: unknown): ParseResult<TreasuryBalance[]> {
  const parsed = z.array(balanceSchema).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `Invalid balances: ${describeIssues(parsed.error)}` };
  }
  return { ok: true, value: parsed.data };
}