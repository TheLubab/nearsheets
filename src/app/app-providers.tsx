import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { env } from "../config/env";
import { cookieAuthApi,createServiceAuth } from '../features/auth/session';
import type { NearNetwork } from "../integrations/near/network";
import { createConnectorWalletGateway } from "../integrations/wallet/gateway";
import type { TreasuryReader } from "../features/treasury/application/treasury-reader";
import {
  createTreasuryReaderForNetwork,
  describeIntegrations,
} from "../features/treasury/application/treasury-source";
import type { IntegrationStatus } from "../features/treasury/application/treasury-source";
import {
  createWalletController,
  type WalletController,
} from "../features/wallet/application/wallet-controller";

/**
 * Shared integration providers.
 *
 * One wallet controller lives above the document UI. Treasury readers are
 * cached per network and created on first use; creating one makes no request,
 * and no wallet connects until the user asks.
 */
export interface Integrations {
  wallet: WalletController;
  auth: ReturnType<typeof createServiceAuth>;
  /**
   * Reader for a specific network.
   *
   * The reader follows the document's treasury network, not the wallet's
   * network: a document for a testnet DAO must not read mainnet just because a
   * wallet was connected to mainnet.
   */
  readerFor(network: NearNetwork): TreasuryReader;
  statuses: IntegrationStatus[];
}

const IntegrationsContext = createContext<Integrations | null>(null);

export function useIntegrations(): Integrations {
  const value = useContext(IntegrationsContext);
  if (!value) {
    throw new Error("Integrations are only available inside AppProviders.");
  }
  return value;
}

const READER_CACHE = new Map<NearNetwork, TreasuryReader>();

/**
 * Development-only demo data.
 *
 * Vite exposes `import.meta.env.DEV`; the fallback keeps isolated Node tests
 * working. Demo data is never enabled in a production build.
 */
export const DEMO_DATA_ENABLED: boolean =
  typeof import.meta.env !== "undefined" ? import.meta.env.DEV === true : false;

function readerFor(network: NearNetwork): TreasuryReader {
  const existing = READER_CACHE.get(network);
  if (existing) {
    return existing;
  }
  const reader = createTreasuryReaderForNetwork({
    network,
    allowDemo: false,
  });
  READER_CACHE.set(network, reader);
  return reader;
}

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Remote reads are explicit; a view call for a wrong treasury or
            // network does not fix itself by retrying.
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [wallet] = useState(() =>
    createWalletController({
      initialNetwork: env.VITE_NEAR_NETWORK,
      createGateway: (network) =>
        createConnectorWalletGateway({ network, config: env }),
    }),
  );

  const lifecycle = useRef(0);
  const [auth] = useState(() => createServiceAuth(env.VITE_AUTH_API_URL ? cookieAuthApi(env.VITE_AUTH_API_URL,
    async (payload,network) => {
      if (wallet.getState().network !== network) throw new Error('Wallet network changed.');
      return wallet.authorize(payload);
    }) : null));
  useEffect(() => {
    const mounted = ++lifecycle.current;
    void auth.restore();
    void wallet.restore();
    let previousIdentity = wallet.getState().connection?.accountId + ':' + wallet.getState().network;
    const detach = wallet.subscribe(() => {
      const state = wallet.getState(), service = auth.getState().session;
      const identity = state.connection?.accountId + ':' + state.network;
      if(identity !== previousIdentity && auth.getState().status === 'authenticating') void auth.logout();
      previousIdentity = identity;
      if (service && ((state.status === 'connected' && (service.accountId !== state.connection?.accountId || service.network !== state.network)) || state.status === 'disconnected')) void auth.logout();
    });
    return () => { detach();queueMicrotask(() => { if (lifecycle.current === mounted) {wallet.dispose();auth.dispose();} }); };
  }, [wallet,auth]);

  const integrations = useMemo<Integrations>(
    () => ({
      wallet,
      auth,
      readerFor,
      statuses: describeIntegrations(env, { demoData: DEMO_DATA_ENABLED }),
    }),
    [wallet,auth],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <IntegrationsContext.Provider value={integrations}>
        {children}
      </IntegrationsContext.Provider>
    </QueryClientProvider>
  );
}
