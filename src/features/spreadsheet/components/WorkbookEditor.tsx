import type { ExecutionJournal } from '../../table/execution';
import { useEffect, useRef, useState } from "react";
import { WorkspaceLoading } from '../../../app/WorkspaceLoading';
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
  onStartupError?: (error: string, documentId: string) => void;
  /** A welcome/template dialog or parent loading screen already covers the editor. */
  loadingCovered?: boolean;
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
  onStartupError,
  loadingCovered = false,
}: WorkbookEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<EditorStatus>("starting");
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback and snapshot without remounting on every render.
  const onSessionReadyRef = useRef(onSessionReady);
  const onStartupErrorRef = useRef(onStartupError);
  useEffect(() => {
    onSessionReadyRef.current = onSessionReady;
    onStartupErrorRef.current = onStartupError;
  }, [onSessionReady, onStartupError]);

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

    setStatus('starting');
    setError(null);
    const fail = (cause: unknown) => {
      if (!active) return;
      const message = cause instanceof Error ? cause.message : 'The editor could not start.';
      setStatus('failed');
      setError(message);
      onStartupErrorRef.current?.(message, documentId);
    };

    try {
      session = createWorkbookSession({
        container: host,
        executions,
        initialWorkbook: initialWorkbookRef.current,
        onReady: (readySession) => {
          if (!active) {
            return;
          }
          onSessionReadyRef.current?.(readySession, documentId);
          setStatus("ready");
        },
      });
    } catch (cause) {
      fail(cause);
      return;
    }

    // The lifecycle event resolves after the first paint; this also covers a
    // stage that was already reached during construction. A rejection (for
    // example from the ready callback) becomes an actionable failure.
    void session.whenReady().catch(fail);

    return () => {
      active = false;
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
        inert={status !== 'ready'}
        style={status !== 'ready' ? { visibility: 'hidden' } : undefined}
      />
      {!loadingCovered && <WorkspaceLoading active={status !== 'ready'} error={status === 'failed' ? error : null}/>}
    </div>
  );
}
