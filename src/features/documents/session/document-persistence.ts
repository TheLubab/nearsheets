import { CommandType } from "@univerjs/core";
import type { IDisposable } from "@univerjs/core";
import type { WorkbookSession } from "../../spreadsheet/univer/create-workbook-session";
import type { DocumentEnvelope } from "../model/document-envelope";
import { withWorkbookSnapshot } from "../model/document-envelope";
import type { DocumentRepository } from "../repository/document-repository";

export type SaveStatus = "saved" | "saving" | "error";

export interface DocumentSaveState {
  status: SaveStatus;
  /** ISO timestamp of the last successful save. */
  savedAt: string | null;
  /** Human-readable reason the last save failed. */
  error: string | null;
}

export interface DocumentPersistenceOptions {
  session: WorkbookSession;
  repository: DocumentRepository;
  /** The document that was loaded into this editor. Owned by the caller. */
  document: DocumentEnvelope;
  /** Delay after the last edit before an automatic save starts. */
  debounceMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
  /** Called after every state transition, including successful saves. */
  onStateChange?: (state: DocumentSaveState, document: DocumentEnvelope) => void;
}

/**
 * Autosave bridge between one mounted editor and the document repository.
 *
 * Rules:
 * - Edits mark the document dirty and start a debounced save.
 * - Saves are serialized: an edit that arrives during a save triggers exactly
 *   one follow-up save after it completes, never a parallel write.
 * - `document` is only replaced after the repository write succeeds, so a
 *   failed save leaves the last known-good envelope intact.
 * - Disposing cancels pending work and detaches the command listener.
 *
 * Selection changes and other operations are ignored: they do not change the
 * saved workbook.
 */
export interface DocumentPersistence {
  /** Saves immediately if there are unsaved changes. */
  saveNow(): Promise<void>;
  /** Current state; also delivered through `onStateChange`. */
  getState(): DocumentSaveState;
  /** The latest successfully saved envelope. */
  getDocument(): DocumentEnvelope;
  /** Marks the document dirty without waiting for an editor event. */
  markDirty(): void;
  dispose(): void;
}

function isPersistableCommand(type: CommandType | undefined): boolean {
  // OPERATIONs (selection, scroll, view state) are not part of the snapshot.
  return type !== CommandType.OPERATION;
}

export function createDocumentPersistence(
  options: DocumentPersistenceOptions,
): DocumentPersistence {
  const { session, repository, debounceMs = 800, now = () => new Date() } = options;
  const workbook = session.getWorkbook();

  let document = options.document;
  let state: DocumentSaveState = {
    status: "saved",
    savedAt: document.updatedAt,
    error: null,
  };
  let disposed = false;
  let dirty = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let rerunRequested = false;

  // Baseline of what is already persisted. Comparing serialized snapshots
  // prevents load-time recalculation or view-only commands from rewriting the
  // document (and bumping `updatedAt`) when nothing actually changed.
  let baselineSnapshot = JSON.stringify(session.saveSnapshot() ?? null);

  const emit = () => {
    options.onStateChange?.(state, document);
  };

  const setState = (next: DocumentSaveState) => {
    state = next;
    emit();
  };

  const clearTimer = () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  const runSave = async (): Promise<void> => {
    clearTimer();
    if (!dirty) {
      return;
    }
    if (inFlight) {
      rerunRequested = true;
      return inFlight;
    }

    dirty = false;
    setState({ status: "saving", savedAt: state.savedAt, error: null });

    // Assign inFlight before the body can finish synchronously (for example
    // when the snapshot has not changed). Otherwise a settled promise can be
    // left inFlight forever, preventing later edits from being captured.
    inFlight = Promise.resolve().then(async () => {
      try {
        // Snapshot only when actually saving; recalculating on every keystroke
        // would clone the whole workbook for nothing.
        const snapshot = session.saveSnapshot();
        if (!snapshot) {
          throw new Error("The spreadsheet is no longer available.");
        }
        const serialized = JSON.stringify(snapshot);
        if (serialized === baselineSnapshot) {
          // Nothing changed since the last successful save.
          if (!disposed) {
            setState({ status: "saved", savedAt: state.savedAt, error: null });
          }
          return;
        }
        const next = withWorkbookSnapshot(document, snapshot, now());
        await repository.save(next);
        document = next;
        baselineSnapshot = serialized;
        if (!disposed) {
          setState({ status: "saved", savedAt: next.updatedAt, error: null });
        }
        if (dirty) {
          rerunRequested = true;
        }
      } catch (cause) {
        dirty = true;
        const message =
          cause instanceof Error ? cause.message : "The document could not be saved.";
        if (!disposed) {
          setState({ status: "error", savedAt: state.savedAt, error: message });
        }
      } finally {
        inFlight = null;
      }

      if (rerunRequested && !disposed && dirty) {
        rerunRequested = false;
        await runSave();
      }
    });

    return inFlight;
  };

  const markDirty = () => {
    if (disposed) {
      return;
    }
    dirty = true;
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void runSave();
    }, debounceMs);
  };

  let commandListener: IDisposable | null = null;
  if (workbook) {
    commandListener = workbook.onCommandExecuted((command) => {
      if (isPersistableCommand(command.type)) {
        markDirty();
      }
    });
  }

  return {
    saveNow: async () => {
      if (disposed) {
        return;
      }
      dirty = true;
      await runSave();
    },
    getState: () => state,
    getDocument: () => document,
    markDirty,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      clearTimer();
      commandListener?.dispose();
      commandListener = null;
      // Do not save from teardown: React may be unmounting, and the parent
      // decides whether to flush before replacing the editor.
      dirty = false;
    },
  };
}
