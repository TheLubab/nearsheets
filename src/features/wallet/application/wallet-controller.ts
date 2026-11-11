import type { NearNetwork } from "../../../integrations/near/network";
import type {
  WalletConnection,
  WalletGateway,
  WalletTransaction,
} from "../../../integrations/wallet/gateway";
import { WalletCancelledError } from "../../../integrations/wallet/gateway";

/**
 * Wallet session controller.
 *
 * Framework-free so connection state, cancellation recovery and network changes
 * are testable without a browser extension. React subscribes to it; the
 * controller never writes to a document or a treasury.
 *
 * Rules:
 * - Nothing connects on construction. `connect()` is only called from an
 *   explicit UI action.
 * - A cancelled selector is a recoverable state, not an error banner.
 * - Changing the network disconnects first, then replaces the gateway, because
 *   a session authorized on one network is not valid on the other.
 */

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting";

export interface WalletState {
  status: WalletStatus;
  network: NearNetwork;
  connection: WalletConnection | null;
  /** Message for a failed connection attempt; cleared by any new attempt. */
  error: string | null;
  /** Set when the user cancelled the last attempt, so the UI can explain it. */
  cancelled: boolean;
}

export interface WalletControllerOptions {
  /** Gateway for the initial network. */
  createGateway: (network: NearNetwork) => WalletGateway;
  initialNetwork: NearNetwork;
}

export type Unsubscribe = () => void;

export interface WalletController {
  getState(): WalletState;
  subscribe(listener: () => void): Unsubscribe;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setNetwork(network: NearNetwork): Promise<void>;
  /**
   * Signs and sends one transaction through the connected session.
   *
   * Deliberately not a state machine: a declined signature must not look like a
   * lost connection. Rejections propagate unchanged so the caller can tell a
   * cancellation (nothing sent) from a real failure.
   */
  signAndSendTransaction(transaction: WalletTransaction): Promise<unknown>;
  /** Clears the recoverable cancellation notice. */
  dismissCancelled(): void;
  dispose(): void;
}

export function createWalletController(
  options: WalletControllerOptions,
): WalletController {
  let network = options.initialNetwork;
  let gateway: WalletGateway = options.createGateway(network);
  let state: WalletState = {
    status: "disconnected",
    network,
    connection: null,
    error: null,
    cancelled: false,
  };
  let disposed = false;
  let detachSignOut: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const publish = (partial: Partial<WalletState>) => {
    state = { ...state, ...partial };
    for (const listener of listeners) {
      listener();
    }
  };

  const attach = () => {
    detachSignOut?.();
    detachSignOut = gateway.onSignOut(() => {
      publish({
        status: "disconnected",
        connection: null,
        error: null,
        cancelled: false,
      });
    });
  };

  attach();

  const connect = async (): Promise<void> => {
    if (disposed || state.status === "connecting" || state.status === "connected") {
      return;
    }
    publish({ status: "connecting", error: null, cancelled: false });
    try {
      const connection = await gateway.connect();
      if (disposed) {
        return;
      }
      publish({ status: "connected", connection, error: null });
    } catch (cause) {
      if (disposed) {
        return;
      }
      if (cause instanceof WalletCancelledError) {
        // Closing the wallet selector is a normal decision: return to the
        // disconnected state so the user can simply try again.
        publish({
          status: "disconnected",
          connection: null,
          error: null,
          cancelled: true,
        });
        return;
      }
      publish({
        status: "disconnected",
        connection: null,
        error:
          cause instanceof Error
            ? cause.message
            : "The wallet could not be connected.",
      });
    }
  };

  const disconnect = async (): Promise<void> => {
    if (disposed || state.status === "disconnected") {
      return;
    }
    publish({ status: "disconnecting", error: null, cancelled: false });
    try {
      await gateway.disconnect();
      if (disposed) {
        return;
      }
      publish({ status: "disconnected", connection: null });
    } catch (cause) {
      // The local session is untrustworthy after a failed sign-out, so report
      // it and drop it rather than pretending the wallet is still connected.
      publish({
        status: "disconnected",
        connection: null,
        error:
          cause instanceof Error
            ? `Signing out failed: ${cause.message}`
            : "Signing out failed.",
      });
    }
  };

  const setNetwork = async (next: NearNetwork): Promise<void> => {
    if (disposed || next === network) {
      return;
    }
    await disconnect();
    if (disposed) {
      return;
    }
    detachSignOut?.();
    detachSignOut = null;
    gateway.dispose();
    network = next;
    gateway = options.createGateway(network);
    attach();
    publish({
      network,
      status: "disconnected",
      connection: null,
      error: null,
      cancelled: false,
    });
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect,
    disconnect,
    setNetwork,
    signAndSendTransaction: async (transaction) => {
      if (disposed || state.status !== "connected" || !state.connection) {
        throw new Error("Connect a wallet before submitting a proposal.");
      }
      return gateway.signAndSendTransaction(transaction);
    },
    dismissCancelled: () => {
      if (state.cancelled) {
        publish({ cancelled: false });
      }
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      detachSignOut?.();
      detachSignOut = null;
      gateway.dispose();
      listeners.clear();
    },
  };
}