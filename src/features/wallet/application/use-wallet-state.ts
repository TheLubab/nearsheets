import { useSyncExternalStore } from "react";
import type {
  WalletController,
  WalletState,
} from "./wallet-controller";

/** Subscribes a component to the wallet controller's stable published state. */
export function useWalletState(controller: WalletController): WalletState {
  return useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.getState(),
    () => controller.getState(),
  );
}