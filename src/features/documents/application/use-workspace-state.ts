import { useSyncExternalStore } from "react";
import type {
  DocumentWorkspace,
  WorkspaceState,
} from "./document-workspace";

/**
 * Subscribes a component to the document workspace.
 *
 * `getState` returns a stable object that only changes on publish, so
 * `useSyncExternalStore` sees a new reference exactly when something changed.
 */
export function useWorkspaceState(workspace: DocumentWorkspace): WorkspaceState {
  return useSyncExternalStore(
    (listener) => workspace.subscribe(listener),
    () => workspace.getState(),
    () => workspace.getState(),
  );
}