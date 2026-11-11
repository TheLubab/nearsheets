import type { NearNetwork } from "../../../integrations/near/network";
import type {
  TreasuryReadSource,
} from "./treasury-reader";
import type { TreasuryReader } from "./treasury-reader";
import { createTreasuryReader } from "./treasury-reader";
import { createNearRpcTreasurySource } from "../../../integrations/trezu/treasury-rpc-source";
import type { NearViewClient } from "../../../integrations/trezu/treasury-rpc-source";
import {
  createDemoTreasurySource,
  isDemoTreasuryAccount,
} from "../../../integrations/trezu/demo-treasury-source";
import type { AppEnv } from "../../../config/env";

/**
 * Chooses the treasury read source.
 *
 * Direct NEAR RPC reads against the DAO contract are the only source for real
 * treasuries. The optional Trezu API URL is configuration for a later adapter:
 * a URL alone does not prove endpoint or payload compatibility, so it is not
 * turned into a reader. The UI reports that distinction instead of implying
 * the integration works.
 *
 * Demo data is available only in a development build and only for account ids
 * containing `demo`. It never silently replaces real reads: an account without
 * the marker still goes to RPC.
 */
export interface CreateTreasuryReaderOptions {
  network: NearNetwork;
  /** Tests inject a view client; production builds a provider lazily. */
  client?: NearViewClient;
  /** Checked per read so one reader can serve both demo and real accounts. */
  allowDemo?: boolean;
}

/**
 * A source that routes each read to demo data or RPC.
 *
 * Routing happens per call rather than per reader, because the account is part
 * of the request: a user may switch between a demo treasury and a real one
 * without rebuilding the reader or reconnecting a wallet.
 */
function routingSource(options: CreateTreasuryReaderOptions): TreasuryReadSource {
  const rpc = createNearRpcTreasurySource({
    network: options.network,
    client: options.client,
  });
  const demo = options.allowDemo ? createDemoTreasurySource() : null;

  const pick = (target: { accountId: string }): TreasuryReadSource => {
    if (demo && isDemoTreasuryAccount(target.accountId)) {
      return demo;
    }
    return rpc;
  };

  return {
    get label() {
      return options.allowDemo ? `${rpc.label} (demo data for "demo" accounts)` : rpc.label;
    },
    readPolicy: (target) => pick(target).readPolicy(target),
    readProposals: (target, page) => pick(target).readProposals(target, page),
    readLastProposalId: (target) => pick(target).readLastProposalId(target),
    readBalances: (target) => pick(target).readBalances(target),
    readProposal: (target, id) => pick(target).readProposal(target, id),
  };
}

export function createTreasuryReaderForNetwork(
  options: CreateTreasuryReaderOptions,
): TreasuryReader {
  return createTreasuryReader(routingSource(options));
}

export type IntegrationState =
  | "available"
  | "configured-no-adapter"
  | "not-configured";

export interface IntegrationStatus {
  key: "near-rpc" | "demo-data" | "wallet-manifest" | "trezu-api" | "intents-api";
  label: string;
  state: IntegrationState;
  detail: string;
}

/**
 * Reports integration readiness for display.
 *
 * A configured URL is reported as configured, never as enabled: without an
 * adapter it cannot serve reads or actions. Wallet support comes from the
 * connector's default manifest, which is not an optional integration.
 */
export function describeIntegrations(
  config: AppEnv,
  options: { demoData?: boolean } = {},
): IntegrationStatus[] {
  const statuses: IntegrationStatus[] = [
    {
      key: "near-rpc",
      label: "NEAR RPC",
      state: "available",
      detail: config.VITE_NEAR_RPC_URL
        ? "Custom RPC endpoint configured."
        : `Public ${config.VITE_NEAR_NETWORK} RPC.`,
    },
  ];

  if (options.demoData) {
    statuses.push({
      key: "demo-data",
      label: "Demo data",
      state: "available",
      detail: 'Development only: accounts containing "demo" show sample data.',
    });
  }

  statuses.push(
    {
      key: "wallet-manifest",
      label: "Wallet manifest",
      state: config.VITE_WALLET_MANIFEST_URL ? "available" : "not-configured",
      detail: config.VITE_WALLET_MANIFEST_URL
        ? "Hosted manifest configured; it replaces the default wallet list."
        : "Using the connector's default wallet list.",
    },
    {
      key: "trezu-api",
      label: "Trezu API",
      state: config.VITE_TREZU_API_URL ? "configured-no-adapter" : "not-configured",
      detail: config.VITE_TREZU_API_URL
        ? "URL configured, but no adapter is implemented, so it is not used."
        : "Not configured.",
    },
    {
      key: "intents-api",
      label: "NEAR Intents API",
      state: config.VITE_INTENTS_API_URL ? "configured-no-adapter" : "not-configured",
      detail: config.VITE_INTENTS_API_URL
        ? "URL configured, but no adapter is implemented, so it is not used."
        : "Not configured.",
    },
  );

  return statuses;
}