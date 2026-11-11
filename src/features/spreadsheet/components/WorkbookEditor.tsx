import type { ExecutionJournal } from '../../table/execution';
import { useEffect, useRef, useState } from "react";
import { loadingToast, TOAST_IDS } from "../../../components/ui/toast";
import type { WorkbookSnapshot } from "../model/workbook-snapshot";
import type { WorkbookSession } from "../univer/create-workbook-session";
import { createWorkbookSession } from "../univer/create-workbook-session";

type EditorStatus = "starting" | "ready" | "failed";

export interface WorkbookEditorProps {
  /**
   * Snapshot to open. Changing `documentId` remounts the editor with the new
   * snapshot; changing the snapshot object alone does not, because Univer is
   * the source of truth for the open workbook.
   */
  documentId: string;
  executions?: ExecutionJournal;
  initialWorkbook: WorkbookSnapshot;
  /**
   * Called when the editor is ready. `documentId` is the document this editor
   * was mounted for, so a late callback from a replaced editor is detectable.
   */
  onSessionReady?: (session: WorkbookSession, documentId: string) => void;
}

/**
 * Owns the DOM node Univer mounts into and exactly one Univer instance.
 *
 * React Strict Mode mounts, cleans up and remounts this effect in development.
 * `createWorkbookSession` builds a fresh Univer instance per setup and its
 * `dispose` is idempotent, so the editor survives that double cycle without
 * leaking canvas listeners, timers or React roots.
 */
export function WorkbookEditor({
  documentId,
  executions,
  initialWorkbook,
  onSessionReady,
}: WorkbookEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<EditorStatus>("starting");
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback and snapshot without remounting on every render.
  const onSessionReadyRef = useRef(onSessionReady);
  useEffect(() => {
    onSessionReadyRef.current = onSessionReady;
  }, [onSessionReady]);

  const initialWorkbookRef = useRef(initialWorkbook);
  useEffect(() => {
    initialWorkbookRef.current = initialWorkbook;
  }, [initialWorkbook]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let active = true;
    let session: WorkbookSession | null = null;

    // Startup progress is a toast, not a blocker over the grid. A short delay
    // means an instant start shows nothing instead of blinking.
    let finishStartupToast = loadingToast(
      TOAST_IDS.engine,
      "Starting spreadsheet engine…",
    );

    try {
      session = createWorkbookSession({
        container: host,
        executions,
        initialWorkbook: initialWorkbookRef.current,
        onReady: (readySession) => {
          if (!active) {
            return;
          }
          setStatus("ready");
          finishStartupToast();
          onSessionReadyRef.current?.(readySession, documentId);
        },
      });
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "The editor could not start.");
      // The failure stays on the canvas; a toast would only repeat it.
      finishStartupToast();
      return;
    }

    setStatus("starting");
    setError(null);
    // The lifecycle event resolves after the first paint; this also covers a
    // stage that was already reached during construction. A rejection (for
    // example from the ready callback) must not leave the loading toast up.
    void session.whenReady().catch((cause: unknown) => {
      if (!active) {
        return;
      }
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "The editor could not start.");
      finishStartupToast();
    });

    return () => {
      active = false;
      // A replaced editor must not leave its startup toast behind.
      finishStartupToast();
      session?.dispose();
    };
    // `documentId` is the identity of the open document. A new document must
    // build a new Univer instance; cell-level edits never change this key.
  }, [documentId]);

  return (
    <div className="workbook-editor">
      <div
        ref={hostRef}
        className="workbook-editor__host"
        // Univer manages everything inside this element.
        role="application"
        aria-label="Spreadsheet"
        aria-busy={status === "starting"}
      />
      {status === "failed" ? (
        <div className="workbook-editor__failure" role="alert">
          <p>{error ?? "The spreadsheet editor is unavailable."}</p>
        </div>
      ) : null}
    </div>
  );
}