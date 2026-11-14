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
  excludedWallets: string[];
  connectInput?: { walletId: string };
  events: Map<string, Set<() => void>>;
  disconnect: ReturnType<typeof vi.fn>;
}

const connectorRef: { current: FakeConnector | null } = { current: null };
const behavior: {
  connect: () => Promise<void>;
  accounts: () => Promise<FakeAccount[]>;
  sign: () => Promise<unknown>;
  authorize: (input:unknown) => Promise<{accountId:string;authorization:string}>;
} = {
  connect: async () => undefined,
  accounts: async () => [{ accountId: "alice.near", publicKey: "ed25519:key" }],
  sign:async()=>({}),
  authorize:async()=>({accountId:'alice.near',authorization:'blob'}),
};

vi.mock("@hot-labs/near-connect", () => ({
  NearConnector: class {
    network: NearNetwork;
    excludedWallets: string[];
    connectInput?: { walletId: string };
    events = new Map<string, Set<() => void>>();
    disconnect = vi.fn(async () => undefined);

    constructor(options: { network?: NearNetwork; excludedWallets?: string[] }) {
      this.network = options.network ?? "testnet";
      this.excludedWallets = options.excludedWallets ?? [];
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

    async connect(input?: { walletId: string }) {
      this.connectInput = input;
      await behavior.connect();
      return {
        manifest: { id: "meteor", name: "Meteor Wallet", icon: "https://example.com/meteor.png" },
        getAccounts: behavior.accounts,
        signAndSendTransaction:behavior.sign,
        resolveAuth:behavior.authorize,
      };
    }
  },
}));

const config = readEnv({ VITE_NEAR_NETWORK: "testnet" });

describe("connector wallet gateway", () => {
  it('uses NearSheets ownership authorization and does not classify transport cancellation as user refusal',async()=>{
    const authorize=vi.fn(async()=>({accountId:'alice.near',authorization:'NEP-641'}));
    behavior.authorize=authorize;
    behavior.sign=async()=>{throw new Error('RPC request cancelled after broadcast');};
    const gateway=createConnectorWalletGateway({network:'testnet',config});await gateway.connect();
    await expect(gateway.authorize!('server-payload')).resolves.toEqual({accountId:'alice.near',authorization:'NEP-641'});
    expect(authorize).toHaveBeenCalledWith({network:'testnet',purpose:'PROVE_OWNERSHIP',recipient:'NearSheets',payload:'server-payload'});
    try { await gateway.signAndSendTransaction({receiverId:'dao.testnet',actions:[]});throw new Error('Expected failure'); }
    catch(cause){expect(cause).not.toBeInstanceOf(WalletCancelledError);expect(String(cause)).toContain('after broadcast');}
    gateway.dispose();
  });
  beforeEach(() => {
    connectorRef.current = null;
    behavior.sign=async()=>({});
    behavior.authorize=async()=>({accountId:"alice.near",authorization:"blob"});
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
      walletIcon: "https://example.com/meteor.png",
    });
    expect(connectorRef.current?.network).toBe("testnet");
    expect(connectorRef.current?.excludedWallets).toEqual(expect.arrayContaining(["ledger", "ethereum-wallets", "wallet-connect", "passkey", "mynearwallet", "trezu-wallet"]));
  });

  it("connects Trezu directly on mainnet and keeps it out of the general selector", async () => {
    const gateway = createConnectorWalletGateway({ network: "mainnet", config });
    await gateway.connect("trezu-wallet");
    expect(connectorRef.current?.connectInput).toEqual({ walletId: "trezu-wallet" });
    expect(connectorRef.current?.excludedWallets).not.toContain("trezu-wallet");
    gateway.dispose();
  });

  it("rejects a Trezu connection on testnet", async () => {
    const gateway = createConnectorWalletGateway({ network: "testnet", config });
    await expect(gateway.connect("trezu-wallet")).rejects.toThrow("Mainnet only");
    expect(connectorRef.current).toBeNull();
    gateway.dispose();
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
