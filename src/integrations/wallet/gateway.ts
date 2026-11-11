import { env, type AppEnv } from "../../config/env";
import type { NearNetwork } from "../near/network";
import { createWalletConnector } from "./connector";

/**
 * Application-facing wallet boundary.
 *
 * `WalletController` depends on this interface rather than on NEAR Connect
 * directly, so wallet behavior (cancellation, recovery, network switching) can
 * be tested without an iframe, a manifest download or a browser extension.
 *
 * Nothing here runs at import time. The connector SDK is imported inside
 * `connect`, and creating the gateway does not fetch a manifest, connect or
 * sign anything.
 */

export class WalletCancelledError extends Error {
  constructor(message = "Wallet connection was cancelled.") {
    super(message);
    this.name = "WalletCancelledError";
  }
}

export interface WalletConnection {
  accountId: string;
  /** Only set when the wallet reports it; never derived from the account id. */
  publicKey: string | null;
  walletId: string;
  walletName: string;
}

export interface WalletGateway {
  readonly network: NearNetwork;
  /** Resolves with the signed-in account; rejects with `WalletCancelledError` when the user closes the selector. */
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  /** Emits when the wallet ends the session on its own. Returns an unsubscribe function. */
  onSignOut(listener: () => void): () => void;
  /** Releases listeners. Does not sign out, so a network switch can disconnect explicitly first. */
  dispose(): void;
}

export interface CreateWalletGatewayOptions {
  network: NearNetwork;
  config?: AppEnv;
}

/**
 * Wallet rejections are user decisions, not failures that should look like
 * errors. The pattern is deliberately narrow: NEAR Connect rejects a dismissed
 * selector with `User rejected`, while a manifest or network failure must keep
 * its own message.
 */
const CANCELLATION_PATTERN = /user rejected|rejected by user|cancell?ed|popup clos|user clos|denied/i;

function asWalletError(cause: unknown): Error {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  if (CANCELLATION_PATTERN.test(error.message)) {
    return new WalletCancelledError(error.message);
  }
  return error;
}

type Connector = Awaited<ReturnType<typeof createWalletConnector>>;
type ConnectorWallet = Awaited<ReturnType<Connector["connect"]>>;

export function createConnectorWalletGateway(
  options: CreateWalletGatewayOptions,
): WalletGateway {
  const config = options.config ?? env;
  const signOutListeners = new Set<() => void>();
  let connector: Connector | null = null;
  let connectorPromise: Promise<Connector> | null = null;
  let wallet: ConnectorWallet | null = null;
  let disposed = false;

  const handleSignOut = () => {
    wallet = null;
    for (const listener of signOutListeners) {
      listener();
    }
  };

  const getConnector = (): Promise<Connector> => {
    if (disposed) {
      return Promise.reject(new Error("The wallet connection has been closed."));
    }
    connectorPromise ??= createWalletConnector(config, options.network).then(
      (created) => {
        created.on("wallet:signOut", handleSignOut);
        connector = created;
        return created;
      },
    );
    return connectorPromise;
  };

  return {
    network: options.network,

    async connect(): Promise<WalletConnection> {
      try {
        const active = await getConnector();
        const connected = await active.connect();
        const accounts = await connected.getAccounts();
        const account = accounts[0];
        if (!account) {
          throw new Error("The wallet connected but reported no account.");
        }
        wallet = connected;
        return {
          accountId: account.accountId,
          publicKey: account.publicKey ?? null,
          walletId: connected.manifest.id,
          walletName: connected.manifest.name,
        };
      } catch (cause) {
        throw asWalletError(cause);
      }
    },

    async disconnect(): Promise<void> {
      const active = connector;
      if (!active) {
        wallet = null;
        return;
      }
      await active.disconnect(wallet ?? undefined);
      wallet = null;
    },

    onSignOut(listener) {
      signOutListeners.add(listener);
      return () => {
        signOutListeners.delete(listener);
      };
    },

    dispose() {
      disposed = true;
      connector?.off("wallet:signOut", handleSignOut);
      connector = null;
      connectorPromise = null;
      wallet = null;
      signOutListeners.clear();
    },
  };
}