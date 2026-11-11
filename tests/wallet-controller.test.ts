import { describe, expect, it, vi } from "vitest";
import type {
  WalletConnection,
  WalletGateway,
} from "../src/integrations/wallet/gateway";
import { WalletCancelledError } from "../src/integrations/wallet/gateway";
import type { NearNetwork } from "../src/integrations/near/network";
import {
  createWalletController,
  type WalletController,
} from "../src/features/wallet/application/wallet-controller";

const CONNECTION: WalletConnection = {
  accountId: "alice.near",
  publicKey: "ed25519:abc",
  walletId: "meteor-wallet",
  walletName: "Meteor Wallet",
};

interface FakeGateway extends WalletGateway {
  signOutListeners: Set<() => void>;
  connectCalls: number;
  disconnected: boolean;
}

function fakeGateway(network: NearNetwork, connect: () => Promise<WalletConnection>): FakeGateway {
  const signOutListeners = new Set<() => void>();
  return {
    network,
    signOutListeners,
    connectCalls: 0,
    disconnected: false,
    async connect() {
      this.connectCalls += 1;
      return connect();
    },
    async disconnect() {
      this.disconnected = true;
    },
    onSignOut(listener) {
      signOutListeners.add(listener);
      return () => signOutListeners.delete(listener);
    },
    dispose() {
      signOutListeners.clear();
    },
  };
}

function controllerFor(gateway: FakeGateway): WalletController {
  return createWalletController({
    initialNetwork: "testnet",
    createGateway: () => gateway,
  });
}

describe("wallet controller", () => {
  it("starts disconnected without connecting anything", () => {
    const gateway = fakeGateway("testnet", async () => CONNECTION);
    const controller = controllerFor(gateway);
    expect(controller.getState()).toMatchObject({
      status: "disconnected",
      connection: null,
      error: null,
      network: "testnet",
    });
    expect(gateway.connectCalls).toBe(0);
  });

  it("records the connected account and wallet", async () => {
    const gateway = fakeGateway("testnet", async () => CONNECTION);
    const controller = controllerFor(gateway);
    await controller.connect();
    expect(controller.getState().status).toBe("connected");
    expect(controller.getState().connection).toEqual(CONNECTION);
  });

  it("treats a cancelled selector as recoverable, not an error", async () => {
    const gateway = fakeGateway("testnet", async () => {
      throw new WalletCancelledError();
    });
    const controller = controllerFor(gateway);

    await controller.connect();
    const cancelled = controller.getState();
    expect(cancelled.status).toBe("disconnected");
    expect(cancelled.error).toBeNull();
    expect(cancelled.cancelled).toBe(true);

    controller.dismissCancelled();
    expect(controller.getState().cancelled).toBe(false);

    // A second attempt is allowed and can succeed without a page reload.
    const retrying = fakeGateway("testnet", async () => CONNECTION);
    const second = createWalletController({
      initialNetwork: "testnet",
      createGateway: () => retrying,
    });
    await second.connect();
    expect(second.getState().status).toBe("connected");
  });

  it("shows a real connection failure as an error", async () => {
    const gateway = fakeGateway("testnet", async () => {
      throw new Error("Wallet manifest could not be loaded");
    });
    const controller = controllerFor(gateway);
    await controller.connect();
    expect(controller.getState()).toMatchObject({
      status: "disconnected",
      error: "Wallet manifest could not be loaded",
      cancelled: false,
    });
  });

  it("ignores a duplicate connect while one is in flight", async () => {
    let release: (value: WalletConnection) => void = () => undefined;
    const gateway = fakeGateway(
      "testnet",
      () =>
        new Promise<WalletConnection>((resolve) => {
          release = resolve;
        }),
    );
    const controller = controllerFor(gateway);
    const first = controller.connect();
    const second = controller.connect();
    expect(controller.getState().status).toBe("connecting");
    release(CONNECTION);
    await Promise.all([first, second]);
    expect(gateway.connectCalls).toBe(1);
    expect(controller.getState().status).toBe("connected");
  });

  it("returns to disconnected after an explicit sign-out", async () => {
    const gateway = fakeGateway("testnet", async () => CONNECTION);
    const controller = controllerFor(gateway);
    await controller.connect();
    await controller.disconnect();
    expect(gateway.disconnected).toBe(true);
    expect(controller.getState()).toMatchObject({
      status: "disconnected",
      connection: null,
    });
  });

  it("clears the session when the wallet signs out on its own", async () => {
    const gateway = fakeGateway("testnet", async () => CONNECTION);
    const controller = controllerFor(gateway);
    await controller.connect();
    for (const listener of gateway.signOutListeners) {
      listener();
    }
    expect(controller.getState().status).toBe("disconnected");
    expect(controller.getState().connection).toBeNull();
  });

  it("disconnects and replaces the gateway when the network changes", async () => {
    const testnetGateway = fakeGateway("testnet", async () => CONNECTION);
    const mainnetGateway = fakeGateway("mainnet", async () => ({
      ...CONNECTION,
      accountId: "alice.near",
    }));
    const gateways = new Map<NearNetwork, FakeGateway>([
      ["testnet", testnetGateway],
      ["mainnet", mainnetGateway],
    ]);
    const controller = createWalletController({
      initialNetwork: "testnet",
      createGateway: (network) => gateways.get(network)!,
    });

    await controller.connect();
    await controller.setNetwork("mainnet");

    expect(testnetGateway.disconnected).toBe(true);
    expect(controller.getState()).toMatchObject({
      status: "disconnected",
      connection: null,
      network: "mainnet",
    });
  });

  it("does not resurrect a disposed controller", async () => {
    let release: (value: WalletConnection) => void = () => undefined;
    const gateway = fakeGateway(
      "testnet",
      () =>
        new Promise<WalletConnection>((resolve) => {
          release = resolve;
        }),
    );
    const controller = controllerFor(gateway);
    const pending = controller.connect();
    controller.dispose();
    release(CONNECTION);
    await pending;
    expect(controller.getState().status).toBe("connecting");
  });

  it("notifies subscribers only for published changes", async () => {
    const gateway = fakeGateway("testnet", async () => CONNECTION);
    const controller = controllerFor(gateway);
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.connect();
    expect(listener).toHaveBeenCalled();
  });
});