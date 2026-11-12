import type { Execution } from '../../table/execution';
import { getWorkbookTemplate } from '../../templates/catalog';
import { toast } from '../../../components/ui/toast';
import type { TemplateId } from '../../templates/catalog';
import { LocaleType } from "@univerjs/core";
import type { WorkbookSnapshot } from "../../spreadsheet/model/workbook-snapshot";
import type { WorkbookSession } from "../../spreadsheet/univer/create-workbook-session";
import type { DocumentEnvelope, TreasuryMetadata } from "../model/document-envelope";
import {
  createBlankDocument,
  createDocumentEnvelope,
  renameDocument,
  withSubmission,
  withTreasury,
  withWorkbookSnapshot,
} from "../model/document-envelope";
import type { SubmissionRecord } from "../../treasury/model/proposal-submissions";
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
export function createBlankWorkbook(name = "Untitled workbook"): WorkbookSnapshot {
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
export const STARTER_DOCUMENT_ID = "nearsheets-starter-document";

/** The first document this application ever creates. */
export function createStarterDocument(
  treasury: TreasuryMetadata,
  now?: Date,
  documentId: string = STARTER_DOCUMENT_ID,
): DocumentEnvelope {
  const workbook = createBlankWorkbook("Untitled workbook");
  return createDocumentEnvelope({
    documentId,
    title: "Untitled workbook",
    workbook,
    treasury,
    now,
  });
}

export type WorkspaceStatus = "loading" | "ready" | "error";

export interface WorkspaceState {
  status: WorkspaceStatus;
  /** True only after successful startup from an empty repository. */
  isNewWorkspace: boolean;
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
  /**
   * The attached editor, or `null` before it is ready. Exposed for read-only
   * features such as the payment draft review; writing still goes through the
   * editor's own commands.
   */
  getSession(): WorkbookSession | null;
  /** Flushes unsaved edits before the editor is replaced or unloaded. */
  flush(): Promise<void>;
  createNewDocument(): Promise<void>;
  createFromTemplate(id: TemplateId): Promise<boolean>;
  listDocuments(): ReturnType<DocumentRepository["list"]>;
  openSavedDocument(documentId: string): Promise<void>;
  rename(title: string): Promise<void>;
  /**
   * Records which treasury the open document belongs to.
   *
   * Selecting a treasury is metadata, not a connection: it changes draft
   * identities and which treasury the read panel targets, and never contacts a
   * network by itself.
   */
  setTreasury(treasury: TreasuryMetadata): Promise<void>;
  /**
   * Records a proposal-submission journal entry on the open document.
   *
   * The entry is what makes a retry safe, so it is persisted immediately rather
   * than waiting for the next autosave. It does not modify the workbook.
   */
  recordExecution(record: Execution,documentId?:string): Promise<void>;
  recordSubmission(record: SubmissionRecord): Promise<void>;
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
  isNewWorkspace: false,
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

  const noticeError = (message: string) => {
    toast.error(message);
    publish({ notice: { kind: "error", message } });
  };

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
    const base = persistence?.getDocument() ?? state.document;
    if (!base) return null;
    // Capture the live editor independently of IndexedDB availability.
    if (!session) return base;
    try {
      const snapshot = session.saveSnapshot();
      if (!snapshot) throw new Error("The current workbook cannot be captured.");
      return withWorkbookSnapshot(base, snapshot, now());
    } catch (cause) {
      noticeError(cause instanceof Error ? cause.message : "Snapshot failed.");
      return null;
    }
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
        publish({ isNewWorkspace: true });
      } catch (cause) {
        if (disposed) {
          return;
        }
        setDocument(createBlankDocument(createBlankWorkbook(),treasury,{now:now()}));
        publish({
          saveStatus: "error",
          saveError: cause instanceof Error ? cause.message : 'Storage unavailable.',
          notice: {
            kind: "error",
            message:
              cause instanceof Error
                ? `Storage unavailable: ${cause.message}. This workbook is in memory; export JSON to keep it.`
                : "Storage unavailable. This workbook is in memory; export JSON to keep it.",
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
      toast.success('Created a new spreadsheet.');
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "The new spreadsheet could not be saved.",
      );
    }
  };

  // Shared across both UI entry points, including clicks before React renders.
  let creatingTemplate = false;
  const createFromTemplate = async (id: TemplateId): Promise<boolean> => {
    if (creatingTemplate || disposed || state.status !== 'ready') return false;
    creatingTemplate = true;
    try {
      if (!(await settleBeforeSwitch())) return false;
      const template = getWorkbookTemplate(id);
      const document = createDocumentEnvelope({
        title: template.name, workbook: template.createWorkbook(), treasury, now: now(),
      });
      await repository.save(document);
      if (disposed) return false;
      // Capture edits made while the new document's persistence was in flight.
      if (!(await settleBeforeSwitch())) return false;
      openDocument(document);
      toast.success(`Created ${template.name}.`);
      return true;
    } catch (cause) {
      noticeError(cause instanceof Error ? cause.message : 'The template could not be saved.');
      return false;
    } finally {
      creatingTemplate = false;
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
      await replaceDocument(renameDocument(base, title, now()));
    } catch (cause) {
      noticeError(
        cause instanceof Error ? cause.message : "The spreadsheet could not be renamed.",
      );
    }
  };

  /**
   * Persists a metadata-only change and re-binds autosave to the new envelope.
   *
   * Without the re-bind, autosave would keep writing the old title or treasury
   * back over the change on the next edit.
   */
  const replaceDocument = async (next: DocumentEnvelope) => {
    await repository.save(next);
    const activeSession = session;
    detachSession();
    setDocument(next);
    if (activeSession) {
      attachSession(activeSession, next.documentId);
    }
  };

  const setTreasuryMetadata = async (next: TreasuryMetadata) => {
    const current = state.document;
    if (!current) {
      return;
    }
    if (
      current.treasury.network === next.network &&
      current.treasury.accountId === next.accountId
    ) {
      return;
    }
    try {
      const base = await settlePendingEdits();
      if (!base) {
        return;
      }
      await replaceDocument(withTreasury(base, next, now()));
    } catch (cause) {
      noticeError(
        cause instanceof Error
          ? cause.message
          : "The document treasury could not be updated.",
      );
    }
  };

  const recordSubmission = async (record: SubmissionRecord) => {
    const current = state.document;
    if (!current) {
      return;
    }
    try {
      // Fold pending sheet edits in first, so the metadata write cannot revert
      // a cell the user just typed into.
      const base = await settlePendingEdits();
      if (!base) {
        return;
      }
      await replaceDocument(withSubmission(base, record, now()));
    } catch (cause) {
      noticeError(
        cause instanceof Error
          ? cause.message
          : "The proposal record could not be saved.",
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
      toast.success(result.migratedFrom === null
        ? "Imported document."
        : `Imported document (migrated from version ${result.migratedFrom}).`);
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
      toast.success("Imported CSV as a new document. Formulas and formatting are not part of CSV.");
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
    getSession: () => session,
    flush: async () => {
      await persistence?.saveNow();
    },
    createNewDocument: newDocument,
    createFromTemplate,
    listDocuments: () => repository.list(),
    openSavedDocument: async (id) => {
      try {
        if (!(await settleBeforeSwitch())) return;
        const saved = await repository.get(id);
        if (!saved) throw new Error("This document is no longer available.");
        openDocument(saved);
        publish({ notice: null });
      } catch (cause) {
        noticeError(cause instanceof Error ? cause.message : "Could not open document.");
      }
    },
    rename,
    setTreasury: setTreasuryMetadata,
    recordSubmission,
    recordExecution: async (record,documentId) => {
      if(documentId && documentId !== state.document?.documentId) {
        const original = await repository.get(documentId);
        if(!original)throw new Error('The originating document is no longer available.');
        await repository.save({...original,executions:{...original.executions,[record.id]:record}});
        return;
      }
      const base = await settlePendingEdits();
      if (!base) throw new Error("The current workbook could not be captured.");
      await replaceDocument({...base, executions:{...base.executions,[record.id]:record}});
    },
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
