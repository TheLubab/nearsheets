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
import { DraftReview } from "../features/treasury/components/DraftReview";
import { TreasuryPanel } from "../features/treasury/components/TreasuryPanel";
import { useTreasuryOverview } from "../features/treasury/application/use-treasury-overview";
import type { TreasuryTarget } from "../features/treasury/model/treasury-reads";
import { useWalletState } from "../features/wallet/application/use-wallet-state";
import { WalletPanel } from "../features/wallet/components/WalletPanel";
import { useIntegrations } from "./app-providers";

/** Treasury context recorded with new documents. No treasury is connected yet. */
const initialTreasury: TreasuryMetadata = {
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
      treasury: initialTreasury,
    }),
  );
  const state = useWorkspaceState(workspace);
  const detachRef = useRef<(() => void) | null>(null);
  const { wallet, readerFor, statuses } = useIntegrations();
  const walletState = useWalletState(wallet);

  const currentDocument = state.document;
  const documentTreasury = currentDocument?.treasury ?? initialTreasury;
  const reader = readerFor(documentTreasury.network);
  const treasuryTarget: TreasuryTarget | null = documentTreasury.accountId
    ? { network: documentTreasury.network, accountId: documentTreasury.accountId }
    : null;

  // `key` on the panel also resets the query cache to the same key, so one
  // document's treasury is never shown for another. Reads stay disabled until
  // the document has a treasury account.
  const overview = useTreasuryOverview(reader, treasuryTarget);

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
        <span
          className="app-shell__badge"
          title="Network of the open document's treasury"
        >
          NEAR {documentTreasury.network}
        </span>
      </header>

      <DocumentBar workspace={workspace} state={state} />

      <div className="app-shell__integrations">
        <WalletPanel wallet={wallet} state={walletState} />
      </div>

      <main className="app-shell__main">
        <div className="app-shell__workspace">
          {state.status === "ready" && currentDocument ? (
            <WorkbookEditor
              key={currentDocument.documentId}
              documentId={currentDocument.documentId}
              initialWorkbook={currentDocument.workbook}
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
          {state.status === "ready" && currentDocument ? (
            <DraftReview
              key={currentDocument.documentId}
              getSession={() => workspace.getSession()}
              treasury={currentDocument.treasury}
            />
          ) : null}
        </div>

        {state.status === "ready" && currentDocument ? (
          <aside className="app-shell__side">
            <TreasuryPanel
              key={currentDocument.documentId}
              treasury={currentDocument.treasury}
              accountId={walletState.connection?.accountId ?? null}
              walletNetwork={walletState.connection ? walletState.network : null}
              overview={overview}
              statuses={statuses}
              onSelectTreasury={(target) => {
                // Persist metadata only; the panel's own query reads afterwards.
                void workspace.setTreasury({
                  network: target.network,
                  accountId: target.accountId,
                });
              }}
            />
          </aside>
        ) : null}
      </main>
    </div>
  );
}