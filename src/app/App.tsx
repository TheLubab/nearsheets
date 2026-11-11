import { useEffect, useRef, useState } from "react";
import { env } from "../config/env";
import { createDocumentWorkspace } from "../features/documents/application/document-workspace";
import { useWorkspaceState } from "../features/documents/application/use-workspace-state";
import { DocumentBar } from "../features/documents/components/DocumentBar";
import { DexieDocumentRepository } from "../features/documents/repository/dexie-document-repository";
import type { DocumentRepository } from "../features/documents/repository/document-repository";
import { WorkbookEditor } from "../features/spreadsheet/components/WorkbookEditor";
import type { WorkbookSession } from "../features/spreadsheet/univer/create-workbook-session";
import type { TreasuryMetadata } from "../features/documents/model/document-envelope";

/** Treasury context recorded with new documents. No treasury is connected yet. */
const treasury: TreasuryMetadata = {
  network: env.VITE_NEAR_NETWORK,
  accountId: null,
};

/**
 * Application shell.
 *
 * Document registration, autosave, and import/export live in the workspace
 * controller; React only renders its state. Local editing works without a
 * wallet or remote service.
 */
export function App() {
  const repositoryRef = useRef<DocumentRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = new DexieDocumentRepository();
  }

  const [workspace] = useState(() =>
    createDocumentWorkspace({
      repository: repositoryRef.current!,
      treasury,
    }),
  );
  const state = useWorkspaceState(workspace);
  const detachRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void workspace.start();
    // Deliberately not disposing the workspace here: React Strict Mode runs
    // this cleanup after the first development-only mount, and the workspace is
    // memoized for the lifetime of the app. Persistence is flushed instead.
    return () => {
      detachRef.current?.();
      detachRef.current = null;
      void workspace.flush();
    };
  }, [workspace]);

  // Autosave is debounced, so flush when the tab is hidden or unloaded.
  useEffect(() => {
    const flush = () => {
      void workspace.flush();
    };
    window.addEventListener("pagehide", flush);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [workspace]);

  const handleSessionReady = (session: WorkbookSession, documentId: string) => {
    detachRef.current?.();
    detachRef.current = workspace.attachSession(session, documentId);
  };

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__mark" aria-hidden="true" />
          <div>
            <h1>Trezu Sheets</h1>
            <p>Plan and reconcile community finances in a spreadsheet.</p>
          </div>
        </div>
        <span className="app-shell__badge" title="Selected NEAR network">
          NEAR {env.VITE_NEAR_NETWORK}
        </span>
      </header>

      <DocumentBar workspace={workspace} state={state} />

      <main className="app-shell__main">
        {state.status === "ready" && state.document ? (
          <WorkbookEditor
            key={state.document.documentId}
            documentId={state.document.documentId}
            initialWorkbook={state.document.workbook}
            onSessionReady={handleSessionReady}
          />
        ) : (
          <div className="workbook-status" aria-live="polite">
            {state.status === "error" ? (
              <p role="alert">
                Local documents could not be opened. {state.notice?.message ?? ""}
              </p>
            ) : (
              <p>Opening your documents…</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}