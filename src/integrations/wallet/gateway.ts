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

/**
 * One contract call the wallet should sign.
 *
 * Kept as data so callers can be tested without a wallet, and so the only
 * signing path in the application is this explicit method.
 */
export interface WalletTransaction {
  receiverId: string;
  actions: Array<{
    type: "FunctionCall";
    params: {
      methodName: string;
      args: Record<string, unknown>;
      gas: string;
      deposit: string;
    };
  }>;
}

export interface WalletGateway {
  readonly network: NearNetwork;
  /** Resolves with the signed-in account; rejects with `WalletCancelledError` when the user closes the selector. */
  connect(walletId?: "trezu-wallet"): Promise<WalletConnection>;
  restore?(): Promise<WalletConnection|null>;
  disconnect(): Promise<void>;
  authorize?(payload:string): Promise<{accountId:string;authorization:string}>;
  /**
   * Asks the wallet to sign and send one transaction.
   *
   * Resolves with the wallet's raw `FinalExecutionOutcome`, which the caller
   * must interpret; rejects with `WalletCancelledError` when the user declines,
   * which means nothing reached the chain. This is the only signing path in the
   * app and is called exclusively from an explicit user action.
   */
  signAndSendTransaction(transaction: WalletTransaction): Promise<unknown>;
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

/** Only an explicit user refusal proves a signing request was not broadcast. */
function asSigningError(cause:unknown):Error {
  const error=cause instanceof Error?cause:new Error(String(cause));
  if(cause instanceof WalletCancelledError || /^(user rejected|rejected by user|user denied|user cancel(?:led|ed))\b/i.test(error.message)) return new WalletCancelledError(error.message);
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
  const connectorPromises = new Map<boolean, Promise<Connector>>();
  const connectors = new Map<Connector, () => void>();
  let wallet: ConnectorWallet | null = null;
  let disposed = false;

  const handleSignOut = () => {
    wallet = null;
    for (const listener of signOutListeners) {
      listener();
    }
  };

  const getConnector = (excludeTrezu = false): Promise<Connector> => {
    if (disposed) {
      return Promise.reject(new Error("The wallet connection has been closed."));
    }
    let promise = connectorPromises.get(excludeTrezu);
    if (!promise) {
      promise = createWalletConnector(config, options.network, excludeTrezu).then(
      (created) => {
        if (disposed) throw new Error('Wallet connection was closed.');
        const listener = () => { if (connector === created) handleSignOut(); };
        created.on("wallet:signOut", listener);
        connectors.set(created, listener);
        return created;
      },
      );
      connectorPromises.set(excludeTrezu, promise);
    }
    return promise;
  };

  return {
    network: options.network,
    async restore() {
      const active = await getConnector();
      try {
        const restored = await active.getConnectedWallet();
        if(disposed) return null;
        const account = restored.accounts[0];
        if (!account) return null;
        connector = active;
        wallet = restored.wallet;
        return {accountId:account.accountId,publicKey:account.publicKey ?? null,walletId:wallet.manifest.id,walletName:wallet.manifest.name};
      } catch { return null; }
    },

    async connect(walletId?: "trezu-wallet"): Promise<WalletConnection> {
      try {
        if (walletId === "trezu-wallet" && options.network !== "mainnet") throw new Error("Trezu Wallet is available on Mainnet only.");
        const active = await getConnector(!walletId);
        connector = active;
        const connected = await active.connect(walletId ? { walletId } : undefined);
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

    async authorize(payload:string) {
      if (!wallet?.resolveAuth) throw new Error('This wallet does not support ownership authorization.');
      return wallet.resolveAuth({network:options.network,purpose:'PROVE_OWNERSHIP',recipient:'NearSheets',payload});
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

    async signAndSendTransaction(transaction: WalletTransaction): Promise<unknown> {
      if (disposed) {
        throw new Error("The wallet connection has been closed.");
      }
      const active = wallet;
      if (!active) {
        // Never reconnect implicitly: a transaction must be authorized by the
        // session the user can see in the wallet panel.
        throw new Error("Connect a wallet before signing.");
      }
      try {
        return await active.signAndSendTransaction({
          receiverId: transaction.receiverId,
          actions: transaction.actions,
          network: options.network,
        });
      } catch (cause) {
        throw asSigningError(cause);
      }
    },

    onSignOut(listener) {
      signOutListeners.add(listener);
      return () => {
        signOutListeners.delete(listener);
      };
    },

    dispose() {
      disposed = true;
      for (const [instance, listener] of connectors) instance.off("wallet:signOut", listener);
      connectors.clear();
      connector = null;
      connectorPromises.clear();
      wallet = null;
      signOutListeners.clear();
    },
  };
}
