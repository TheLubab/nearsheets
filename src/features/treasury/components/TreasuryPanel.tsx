import { useState } from "react";
import type { ReactNode } from "react";
import type { TreasuryMetadata } from "../../documents/model/document-envelope";
import { NEAR_NETWORKS, type NearNetwork } from "../../../integrations/near/network";
import { checkNearAccountId } from "../model/near-account";
import {
  describeRoleKind,
  describeThreshold,
  evaluatePermission,
  formatNanosecondPeriod,
  formatNearBaseUnits,
  PROPOSAL_KIND_DISPLAY,
  rolesForAccount,
} from "../model/treasury-reads";
import type { TreasuryPolicy, TreasuryTarget } from "../model/treasury-reads";
import type { IntegrationStatus } from "../application/treasury-source";
import type { TreasuryOverview } from "../application/use-treasury-overview";

interface TreasuryPanelProps {
  /** Treasury recorded on the document. */
  treasury: TreasuryMetadata;
  /** Connected wallet account, or `null`; used only to describe permissions. */
  accountId: string | null;
  /** Network the connected wallet is on, when there is one. */
  walletNetwork: NearNetwork | null;
  overview: TreasuryOverview;
  statuses: IntegrationStatus[];
  onSelectTreasury: (target: TreasuryTarget) => void;
}

function targetFor(treasury: TreasuryMetadata): TreasuryTarget | null {
  if (!treasury.accountId) {
    return null;
  }
  return { network: treasury.network, accountId: treasury.accountId };
}

function PermissionSummary({
  policy,
  accountId,
}: {
  policy: TreasuryPolicy;
  accountId: string | null;
}) {
  if (!accountId) {
    return (
      <p className="treasury-panel__muted">
        Connect a wallet to see which actions its account can take. The policy
        below is read-only and does not depend on your account.
      </p>
    );
  }

  const { roles, unknownRoles } = rolesForAccount(policy, accountId);
  const checks = [
    { label: "Add transfer proposal", check: evaluatePermission(policy, accountId, "transfer", "AddProposal") },
    { label: "Approve transfer", check: evaluatePermission(policy, accountId, "transfer", "VoteApprove") },
    { label: "Reject transfer", check: evaluatePermission(policy, accountId, "transfer", "VoteReject") },
  ];

  return (
    <div className="treasury-panel__permissions">
      <p>
        <strong>Roles for {accountId}:</strong>{" "}
        {roles.length > 0 ? roles.join(", ") : "none"}
        {unknownRoles.length > 0
          ? ` — undecided: ${unknownRoles.join(", ")} (token-weighted, balance not read)`
          : ""}
      </p>
      <ul>
        {checks.map(({ label, check }) => (
          <li key={label}>
            {label}:{" "}
            {check.allowed
              ? `yes (${check.roles.join(", ")})`
              : check.unknownRoles.length > 0
                ? `unknown (${check.unknownRoles.join(", ")})`
                : "no"}
          </li>
        ))}
      </ul>
      <p className="treasury-panel__muted">
        Calculated from the policy and account id alone. The DAO remains the
        authority when a vote is submitted.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="treasury-panel__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/**
 * Read-only treasury overview.
 *
 * Reads target the treasury recorded on the document and are read-only view
 * calls. Typing in a cell never triggers a contract call; saving a treasury
 * does, because that is the user asking to see it.
 */
export function TreasuryPanel({
  treasury,
  accountId,
  walletNetwork,
  overview,
  statuses,
  onSelectTreasury,
}: TreasuryPanelProps) {
  const target = targetFor(treasury);
  const [draftAccount, setDraftAccount] = useState(treasury.accountId ?? "");
  const [draftNetwork, setDraftNetwork] = useState<NearNetwork>(treasury.network);
  const [inputError, setInputError] = useState<string | null>(null);

  const submitTarget = () => {
    const check = checkNearAccountId(draftAccount);
    if (!check.ok) {
      setInputError(check.reason ?? "Enter a valid NEAR account id.");
      return;
    }
    setInputError(null);
    onSelectTreasury({ network: draftNetwork, accountId: check.accountId });
  };

  const networkMismatch =
    target !== null && walletNetwork !== null && walletNetwork !== target.network;

  return (
    <section className="treasury-panel" aria-label="Treasury">
      <div className="treasury-panel__bar">
        <span className="draft-review__label">Treasury</span>
        <span className="treasury-panel__source">
          {target ? `Read via ${overview.sourceLabel}` : "No treasury selected"}
        </span>
        {target ? (
          <button type="button" onClick={() => overview.refresh()}>
            Refresh
          </button>
        ) : null}
      </div>

      <form
        className="treasury-panel__picker"
        onSubmit={(event) => {
          event.preventDefault();
          submitTarget();
        }}
      >
        <label>
          <span>Treasury account</span>
          <input
            value={draftAccount}
            placeholder="my-dao.sputnik-dao.near"
            onChange={(event) => setDraftAccount(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label>
          <span>Network</span>
          <select
            value={draftNetwork}
            onChange={(event) => setDraftNetwork(event.target.value as NearNetwork)}
          >
            {NEAR_NETWORKS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Save treasury</button>
      </form>
      {inputError ? (
        <p className="treasury-panel__error" role="alert">
          {inputError}
        </p>
      ) : null}
      {networkMismatch ? (
        <p className="treasury-panel__notice" role="status">
          Your wallet is on {walletNetwork} but this document&apos;s treasury is on{" "}
          {target.network}. Reads still target {target.network}; check the wallet
          network before signing anything.
        </p>
      ) : null}

      {!target ? (
        <p className="treasury-panel__muted">
          Enter the DAO account this document plans for. Nothing is contacted
          until a treasury is saved, and saving is metadata only.
        </p>
      ) : (
        <div className="treasury-panel__body">
          <Section title="Balances">
            {overview.balances.status === "loading" ? (
              <p className="treasury-panel__muted">Reading balances…</p>
            ) : overview.balances.status === "error" ? (
              <p className="treasury-panel__error" role="alert">
                {overview.balances.message}
              </p>
            ) : overview.balances.status === "ready" ? (
              <ul className="treasury-panel__list">
                {overview.balances.data.map((balance) => (
                  <li key={balance.assetId}>
                    <span className="treasury-panel__amount">
                      {balance.display} {balance.symbol}
                    </span>
                    {balance.note ? (
                      <span className="treasury-panel__muted">{balance.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Policy">
            {overview.policy.status === "loading" ? (
              <p className="treasury-panel__muted">Reading policy…</p>
            ) : overview.policy.status === "error" ? (
              <p className="treasury-panel__error" role="alert">
                {overview.policy.message}
              </p>
            ) : overview.policy.status === "ready" ? (
              <>
                <p>
                  Bond {formatNearBaseUnits(overview.policy.data.proposalBondBaseUnits)} NEAR ·
                  proposals last {formatNanosecondPeriod(overview.policy.data.proposalPeriodNs)} ·
                  default approval {describeThreshold(overview.policy.data.defaultVotePolicy.threshold)}{" "}
                  of {overview.policy.data.defaultVotePolicy.weightKind === "TokenWeight" ? "token weight" : "role weight"}
                </p>
                <ul className="treasury-panel__list">
                  {overview.policy.data.roles.map((role) => (
                    <li key={role.name}>
                      <span className="treasury-panel__role">{role.name}</span>
                      <span className="treasury-panel__muted">{describeRoleKind(role.kind)}</span>
                      <span className="treasury-panel__permissions-list">
                        {role.permissions.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
                <PermissionSummary policy={overview.policy.data} accountId={accountId} />
              </>
            ) : null}
          </Section>

          <Section title="Recent proposals">
            {overview.proposals.status === "loading" ? (
              <p className="treasury-panel__muted">Reading proposals…</p>
            ) : overview.proposals.status === "error" ? (
              <p className="treasury-panel__error" role="alert">
                {overview.proposals.message}
              </p>
            ) : overview.proposals.status === "ready" ? (
              overview.proposals.data.proposals.length === 0 ? (
                <p className="treasury-panel__muted">This treasury has no proposals yet.</p>
              ) : (
                <ul className="treasury-panel__list">
                  {overview.proposals.data.proposals.map((proposal) => (
                    <li key={proposal.id}>
                      <span className="treasury-panel__proposal-id">#{proposal.id}</span>
                      <span>{PROPOSAL_KIND_DISPLAY[proposal.kind] ?? proposal.kind}</span>
                      <span className={`treasury-panel__status treasury-panel__status--${proposal.status}`}>
                        {proposal.status}
                      </span>
                      <span className="treasury-panel__muted">
                        {proposal.description || "No description"}
                      </span>
                      <span className="treasury-panel__muted">
                        {new Date(proposal.submittedAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </Section>
        </div>
      )}

      <details className="treasury-panel__integrations">
        <summary>Integrations</summary>
        <ul>
          {statuses.map((status) => (
            <li key={status.key}>
              <span className="treasury-panel__role">{status.label}</span>
              <span className={`treasury-panel__integration treasury-panel__integration--${status.state}`}>
                {status.state === "available"
                  ? "available"
                  : status.state === "configured-no-adapter"
                    ? "configured, not wired"
                    : "not configured"}
              </span>
              <span className="treasury-panel__muted">{status.detail}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}