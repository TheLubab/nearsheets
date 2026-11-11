import { useEffect, useRef, useState } from "react";
import type { WorkbookSession } from "../univer/create-workbook-session";
import { createWorkbookSession } from "../univer/create-workbook-session";
import { createStarterWorkbook } from "../model/starter-workbook";

type EditorStatus = "starting" | "ready" | "failed";

interface WorkbookEditorProps {
  /**
   * Called when the editor is ready. The session is the only supported way for
   * application code to read or write the workbook; it is disposed on unmount
   * and must not be retained by callers.
   */
  onSessionReady?: (session: WorkbookSession) => void;
}

/**
 * Owns the DOM node Univer mounts into and exactly one Univer instance.
 *
 * React Strict Mode mounts, cleans up and remounts this effect in development.
 * `createWorkbookSession` builds a fresh Univer instance per setup and its
 * `dispose` is idempotent, so the editor survives that double cycle without
 * leaking canvas listeners, timers or React roots.
 */
export function WorkbookEditor({ onSessionReady }: WorkbookEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<EditorStatus>("starting");
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without re-mounting Univer on every render.
  const onSessionReadyRef = useRef(onSessionReady);
  useEffect(() => {
    onSessionReadyRef.current = onSessionReady;
  }, [onSessionReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let active = true;
    let session: WorkbookSession | null = null;

    try {
      session = createWorkbookSession({
        container: host,
        initialWorkbook: createStarterWorkbook(),
        onReady: (readySession) => {
          if (!active) {
            return;
          }
          setStatus("ready");
          onSessionReadyRef.current?.(readySession);
        },
      });
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "The editor could not start.");
      return;
    }

    setStatus("starting");
    setError(null);
    // The lifecycle event resolves after the first paint; this also covers a
    // stage that was already reached during construction.
    void session.whenReady();

    return () => {
      active = false;
      session?.dispose();
    };
  }, []);

  return (
    <div className="workbook-editor">
      <div
        ref={hostRef}
        className="workbook-editor__host"
        // Univer manages everything inside this element.
        role="application"
        aria-label="Spreadsheet"
      />
      {status !== "ready" ? (
        <div className="workbook-editor__overlay" aria-live="polite">
          {status === "failed" ? (
            <p role="alert">{error ?? "The spreadsheet editor is unavailable."}</p>
          ) : (
            <p>Starting spreadsheet engine…</p>
          )}
        </div>
      ) : null}
    </div>
  );
}