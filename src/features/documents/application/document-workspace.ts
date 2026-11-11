import { LocaleType } from "@univerjs/core";
import { STARTER_SHEET_IDS, createStarterWorkbook } from "../../spreadsheet/model/starter-workbook";
import type { WorkbookSnapshot } from "../../spreadsheet/model/workbook-snapshot";
import type { WorkbookSession } from "../../spreadsheet/univer/create-workbook-session";
import type { DocumentEnvelope, TreasuryMetadata } from "../model/document-envelope";
import {
  createBlankDocument,
  createDocumentEnvelope,
  renameDocument,
} from "../model/document-envelope";
import type { DocumentRepository } from "../repository/document-repository";
import type { SaveStatus } from "../session/document-persistence";
import { createDocumentPersistence } from "../session/document-persistence";
import type { DocumentPersistence } from "../session/document-persistence";
import {
  csvFileNameForSheet,
  asImportedCopy,
  parseDocumentJson,
  serializeDocument,
} from "../interchange/json";
import {
  csvFromSnapshot,
  sheetNameFromFileName,
  workbookSnapshotFromCsv,
} from "../interchange/csv";

/**
 * A blank one-sheet workbook used when the user creates a new document.
 * It is built structurally so creating a document never requires a mounted
 * editor; the editor adopts the snapshot on its next mount.
 */
export function createBlankWorkbook(name = "Untitled budget"): WorkbookSnapshot {
  const sheetId = `sheet-${globalThis.crypto.randomUUID()}`;
  return {
    id: `workbook-${globalThis.crypto.randomUUID()}`,
    name,
    locale: LocaleType.EN_US,
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: "Sheet1",
        rowCount: 100,
        columnCount: 26,
      },
    },
  };
}

/** Fixed id for the generated first document, so a raced startup cannot duplicate it. */
export const STARTER_DOCUMENT_ID = "trezu-starter-document";

/** The first document this application ever creates. */
export function createStarterDocument(
  treasury: TreasuryMetadata,
  now?: Date,
  documentId: string = STARTER_DOCUMENT_ID,
): DocumentEnvelope {
  const workbook = createStarterWorkbook();
  // The starter workbook is intentionally partial; fill in the structural
  // fields the envelope and editor require.
  const snapshot: WorkbookSnapshot = {
    ...workbook,
    id: workbook.id ?? `workbook-${globalThis.crypto.randomUUID()}`,
    name: workbook.name ?? "Community budget",
    sheets: workbook.sheets ?? {},
    sheetOrder: workbook.sheetOrder ?? [STARTER_SHEET_IDS.budget, STARTER_SHEET_IDS.summary],
  };
  return createDocumentEnvelope({
    documentId,
    title: "Community budget",
    workbook: snapshot,
    treasury,
    now,
  });
}

export type WorkspaceStatus = "loading" | "ready" | "error";

export interface WorkspaceState {
  status: WorkspaceStatus;
  /** The open document, or `null` while loading or after a fatal error. */
  document: DocumentEnvelope | null;
  saveStatus: SaveStatus;
  savedAt: string | null;
  saveError: string | null;
  /** Result of the last explicit action (import, export, new document). */
  notice: { kind: "info" | "error"; message: string } | null;
}

export interface DocumentWorkspaceOptions {
  repository: DocumentRepository;
  treasury: TreasuryMetadata;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

export type Unsubscribe = () => void;

/**
 * Framework-free document controller.
 *
 * It owns which document is open, the autosave bridge for the attached editor,
 * and explicit import/export actions. React only renders its state and calls
 * these methods, so persistence never lives inside a component.
 */
export interface DocumentWorkspace {
  getState(): WorkspaceState;
  subscribe(listener: () => void): Unsubscribe;
  /** Loads the most recent document or creates the first one if empty. */
  start(): Promise<void>;
  /**
   * Attaches a mounted editor. `documentId` is the document that editor was
   * mounted for; a late callback from a replaced editor is ignored.
   * Returns a detach function for teardown.
   */
  attachSession(session: WorkbookSession, documentId: string): () => void;
  /** Flushes unsaved edits before the editor is replaced or unloaded. */
  flush(): Promise<void>;
  createNewDocument(): Promise<void>;
  rename(title: string): Promise<void>;
  importJson(text: string): Promise<void>;
  importCsv(text: string, fileName: string): Promise<void>;
  /** Serializes the current document after flushing pending edits; no file I/O. */
  exportJson(): Promise<string | null>;
  /** Serializes one sheet's values after flushing pending edits; no file I/O. */
  exportCsv(sheetId?: string): Promise<{ fileName: string; csv: string } | null>;
  /** Clears the transient notice after the UI has shown it. */
  dismissNotice(): void;
  /** Reports an error that occurred outside the workspace (for example while reading a file). */
  reportError(message: string): void;
  dispose(): void;
}

const initialState: WorkspaceState = {
  status: "loading",
  document: null,
  saveStatus: "saved",
  savedAt: null,
  saveError: null,
  notice: null,
};

export function createDocumentWorkspace(
  options: DocumentWorkspaceOptions,
): DocumentWorkspace {
  const { repository, treasury } = options;
  const now = options.now ?? (() => new Date());

  let state: WorkspaceState = { ...initialState };
  const listeners = new Set<() => void>();
  let session: WorkbookSession | null = null;
  let persistence: DocumentPersistence | null = null;
  let disposed = false;
  let startPromise: Promise<void> | null = null;

  const publish = (next: Partial<WorkspaceState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) {
      listener();
    }
  };

  const setDocument = (document: DocumentEnvelope) => {
    publish({
      status: "ready",
      document,
      saveStatus: "saved",
      savedAt: document.updatedAt,
      saveError: null,
    });
  };

  const noticeError = (message: string) => publish({ notice: { kind: "error", message } });

  const OPEN_SETTLE_ERROR =
    "The latest edits could not be saved, so the current document was kept open.";

  /**
   * Flushes pending edits before replacing the open document. Returns `false`
   * when the flush failed; the caller must then abort instead of dropping edits.
   */
  const settleBeforeSwitch = async (): Promise<boolean> => {
    if (!persistence) {
      return true;
    }
    await persistence.saveNow();
    if (persistence.getState().status === "error") {
      noticeError(OPEN_SETTLE_ERROR);
      return false;
    }
    return true;
  };

  const openDocument = (document: DocumentEnvelope) => {
    detachSession();
    setDocument(document);
  };

  const detachSession = () => {
    persistence?.dispose();
    persistence = null;
    session = null;
  };

  /**
   * Returns the document including edits that are still inside the autosave
   * debounce window. `null` means the latest edits could not be captured, so an
   * export must not pretend to be current.
   */
  const settlePendingEdits = async (): Promise<DocumentEnvelope | null> => {
    if (!persistence) {
      return state.document;
    }
    await persistence.saveNow();
    if (persistence.getState().status === "error") {
      noticeError(
        "Your latest edits could not be captured, so nothing was exported. Fix the save error and try again.",
      );
      return null;
    }
    return persistence.getDocument();
  };

  const start = async (): Promise<void> => {
    // Idempotent: React Strict Mode runs the mount effect twice, and starting
    // twice must not create two starter documents.
    startPromise ??= (async () => {
      try {
        const mostRecent = await repository.getMostRecent();
        if (disposed) {
          return;
        }
        if (mostRecent) {
          setDocument(mostRecent);
          return;
        }
        const starter = createStarterDocument(treasury, now());
        await repository.save(starter);
        if (disposed) {
          return;
        }
        setDocument(starter);
      } catch (cause) {
        if (disposed) {
          return;
        }
        publish({
          status: "error",
          document: null,
          notice: {
            kind: "error",
            message:
              cause instanceof Error
                ? cause.message
                : "Local documents could not be opened.",
          },
        });
      }
    })();
    return startPromise;
  };

  const attachSession = (
    nextSession: WorkbookSession,
    documentId: string,
  ): (() => void) => {
    const current = state.document;
    // A late readiness callback from an editor that has already been replaced
    // must not attach autosave to the new document — and must not detach the
    // session that is currently live.
    if (!current || current.documentId !== documentId) {
      return () => undefined;
    }
    detachSession();
    session = nextSession;

    persistence = createDocumentPersistence({
      session: nextSession,
      repository,
      document: current,
      now,
      onStateChange: (saveState) => {
        if (state.document?.documentId !== documentId) {
          return;
        }
        publish({
          saveStatus: saveState.status,
          savedAt: saveState.savedAt,
          saveError: saveState.error,
        });
      },
    });

    return () => {
      if (session === nextSession) {
        detachSession();
      }
    };
  };

  const newDocument = async () => {
    const document = createBlankDocument(createBlankWorkbook(), treasury, { now: now() });
    try {
      // Persist pending edits to the old document before replacing it.
      if (!(await settleBeforeSwitch())) {
        return;
      }
      await repository.save(document);
      openDocument(document);
      publish({ notice: { kind: "info", message: "Created a new document." } });
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "The new document could not be saved.",
      );
    }
  };

  const rename = async (title: string) => {
    const current = state.document;
    if (!current) {
      return;
    }
    try {
      // Fold any pending edits into the document before changing its metadata.
      // If they cannot be captured, do not rename a stale document.
      const base = await settlePendingEdits();
      if (!base) {
        return;
      }
      const renamed = renameDocument(base, title, now());
      await repository.save(renamed);
      // Rebuild persistence around the renamed envelope so later saves keep
      // the new title; otherwise autosave would write the old one back.
      const activeSession = session;
      detachSession();
      setDocument(renamed);
      if (activeSession) {
        attachSession(activeSession, renamed.documentId);
      }
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "The document could not be renamed.",
      );
    }
  };

  const importJson = async (text: string) => {
    const result = parseDocumentJson(text);
    if (!result.ok) {
      // The current document and its stored copy are untouched.
      noticeError(result.error.message);
      return;
    }

    const imported = asImportedCopy(result.document, { now: now() });
    try {
      if (!(await settleBeforeSwitch())) {
        return;
      }
      // Validate and migrate fully before writing, so a rejected import cannot
      // overwrite a recoverable original.
      await repository.save(imported);
      openDocument(imported);
      publish({
        notice: {
          kind: "info",
          message:
            result.migratedFrom === null
              ? "Imported document."
              : `Imported document (migrated from version ${result.migratedFrom}).`,
        },
      });
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "The imported document could not be saved.",
      );
    }
  };

  const importCsv = async (text: string, fileName: string) => {
    const sheetName = sheetNameFromFileName(fileName);
    let snapshot: WorkbookSnapshot;
    try {
      snapshot = workbookSnapshotFromCsv(text, { sheetName });
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "The CSV file could not be read.",
      );
      return;
    }

    const document = createDocumentEnvelope({
      title: sheetName,
      workbook: snapshot,
      treasury,
      now: now(),
    });
    try {
      if (!(await settleBeforeSwitch())) {
        return;
      }
      await repository.save(document);
      openDocument(document);
      publish({
        notice: {
          kind: "info",
          message: "Imported CSV as a new document. Formulas and formatting are not part of CSV.",
        },
      });
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "The imported document could not be saved.",
      );
    }
  };

  const exportJson = async (): Promise<string | null> => {
    const current = await settlePendingEdits();
    return current ? serializeDocument(current) : null;
  };

  const exportCsv = async (
    sheetId?: string,
  ): Promise<{ fileName: string; csv: string } | null> => {
    const current = await settlePendingEdits();
    if (!current) {
      return null;
    }
    // Default to the sheet the user is looking at, falling back to the first.
    const activeSheetId = session?.getWorkbook()?.getActiveSheet()?.getSheetId();
    const targetSheetId = sheetId ?? activeSheetId ?? current.workbook.sheetOrder[0];
    const sheetName = targetSheetId
      ? current.workbook.sheets[targetSheetId]?.name
      : undefined;
    try {
      const csv = csvFromSnapshot(current.workbook, { sheetId: targetSheetId });
      return {
        fileName: csvFileNameForSheet(current.title, sheetName),
        csv,
      };
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "There is nothing to export as CSV.",
      );
      return null;
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    attachSession,
    flush: async () => {
      await persistence?.saveNow();
    },
    createNewDocument: newDocument,
    rename,
    importJson,
    importCsv,
    exportJson,
    exportCsv,
    dismissNotice: () => {
      if (state.notice) {
        publish({ notice: null });
      }
    },
    reportError: (message: string) => noticeError(message),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      listeners.clear();
      detachSession();
    },
  };
}