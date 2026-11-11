import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NearNetwork } from "../src/integrations/near/network";
import { readEnv } from "../src/config/env";
import {
  createConnectorWalletGateway,
  WalletCancelledError,
} from "../src/integrations/wallet/gateway";

/**
 * The real gateway, with its SDK swapped for a fake connector.
 *
 * This checks the integration boundary the UI depends on: how accounts are
 * mapped, how a closed or rejected selector is classified, and that disposing
 * does not leave listeners on the connector. No manifest is fetched and no
 * iframe is created.
 */

interface FakeAccount {
  accountId: string;
  publicKey?: string;
}

interface FakeConnector {
  network: NearNetwork;
  events: Map<string, Set<() => void>>;
  disconnect: ReturnType<typeof vi.fn>;
}

const connectorRef: { current: FakeConnector | null } = { current: null };
const behavior: {
  connect: () => Promise<void>;
  accounts: () => Promise<FakeAccount[]>;
} = {
  connect: async () => undefined,
  accounts: async () => [{ accountId: "alice.near", publicKey: "ed25519:key" }],
};

vi.mock("@hot-labs/near-connect", () => ({
  NearConnector: class {
    network: NearNetwork;
    events = new Map<string, Set<() => void>>();
    disconnect = vi.fn(async () => undefined);

    constructor(options: { network?: NearNetwork }) {
      this.network = options.network ?? "testnet";
      connectorRef.current = this as unknown as FakeConnector;
    }

    on(event: string, listener: () => void) {
      const set = this.events.get(event) ?? new Set();
      set.add(listener);
      this.events.set(event, set);
    }

    off(event: string, listener: () => void) {
      this.events.get(event)?.delete(listener);
    }

    emit(event: string) {
      for (const listener of this.events.get(event) ?? []) {
        listener();
      }
    }

    async connect() {
      await behavior.connect();
      return {
        manifest: { id: "meteor", name: "Meteor Wallet" },
        getAccounts: behavior.accounts,
      };
    }
  },
}));

const config = readEnv({ VITE_NEAR_NETWORK: "testnet" });

describe("connector wallet gateway", () => {
  beforeEach(() => {
    connectorRef.current = null;
    behavior.connect = async () => undefined;
    behavior.accounts = async () => [
      { accountId: "alice.near", publicKey: "ed25519:key" },
    ];
  });

  it("maps the connected account and wallet identity", async () => {
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    const connection = await gateway.connect();
    expect(connection).toEqual({
      accountId: "alice.near",
      publicKey: "ed25519:key",
      walletId: "meteor",
      walletName: "Meteor Wallet",
    });
    expect(connectorRef.current?.network).toBe("testnet");
  });

  it("passes the selected network rather than the configured default", async () => {
    const gateway = createConnectorWalletGateway({ network: "mainnet", config });
    await gateway.connect();
    expect(connectorRef.current?.network).toBe("mainnet");
  });

  it("classifies a closed wallet selector as a cancellation", async () => {
    behavior.connect = async () => {
      throw new Error("User rejected");
    };
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    await expect(gateway.connect()).rejects.toBeInstanceOf(WalletCancelledError);
  });

  it("keeps an actual failure as an error", async () => {
    behavior.connect = async () => {
      throw new Error("Failed to load manifest");
    };
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    await expect(gateway.connect()).rejects.toThrow("Failed to load manifest");
  });

  it("rejects a wallet that reports no account instead of inventing one", async () => {
    behavior.accounts = async () => [];
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    await expect(gateway.connect()).rejects.toThrow(/reported no account/);
  });

  it("omits a public key the wallet does not report", async () => {
    behavior.accounts = async () => [{ accountId: "alice.near" }];
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    const connection = await gateway.connect();
    expect(connection.publicKey).toBeNull();
  });

  it("forwards a wallet-initiated sign-out", async () => {
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    await gateway.connect();
    const listener = vi.fn();
    gateway.onSignOut(listener);
    connectorRef.current?.events.get("wallet:signOut")?.forEach((notify) => notify());
    expect(listener).toHaveBeenCalledOnce();
  });

  it("removes its listener when disposed", async () => {
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    await gateway.connect();
    gateway.dispose();
    expect(connectorRef.current?.events.get("wallet:signOut")?.size).toBe(0);
  });

  it("does not create a connector until a connection is requested", () => {
    createConnectorWalletGateway({ network: "testnet", config });
    expect(connectorRef.current).toBeNull();
  });
});