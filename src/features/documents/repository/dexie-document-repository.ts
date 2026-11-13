import Dexie, { type EntityTable } from "dexie";
import type {
  DocumentEnvelope,
  DocumentSummary,
} from "../model/document-envelope";
import { toDocumentSummary } from "../model/document-envelope";
import { migrateDocument } from "../model/document-migrations";
import type { DocumentRepository } from "./document-repository";

/**
 * IndexedDB (Dexie) draft store.
 *
 * The stored row is the full envelope, so a reload is a lossless read of the
 * exact document that was saved. `schemaVersion` and `updatedAt` are duplicated
 * as top-level columns for indexing and diagnostics.
 *
 * Dexie's own database version is separate from the document envelope version:
 * the former describes this table layout, the latter describes the document
 * contract. Changing the envelope alone does not require a Dexie upgrade.
 */
interface DocumentRow extends DocumentEnvelope {
  /** Envelope version, duplicated for indexing. */
  schemaVersion: number;
  /** ISO timestamp, duplicated for sorting. */
  updatedAt: string;
}

const DATABASE_NAME = "near-sheets";
const LEGACY_DATABASE_NAME = "trezu-sheets";
const LEGACY_IMPORT_KEY = "legacy-store-imported";

export function createDocumentDatabase(name: string = DATABASE_NAME): Dexie & {
  documents: EntityTable<DocumentRow, "documentId">;
  metadata: EntityTable<{ key: string }, "key">;
} {
  const database = new Dexie(name) as Dexie & {
    documents: EntityTable<DocumentRow, "documentId">;
    metadata: EntityTable<{ key: string }, "key">;
  };
  database.version(1).stores({
    documents: "documentId, updatedAt",
  });
  database.version(2).stores({ metadata: "key" });
  return database;
}

export class DexieDocumentRepository implements DocumentRepository {
  private ready: Promise<void> | undefined;
  constructor(private readonly database = createDocumentDatabase()) {}

  private ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.importLegacyStore().catch((cause) => {
        this.ready = undefined;
        throw cause;
      });
    }
    return this.ready;
  }

  /** Copy once, atomically. Keep the old database as a recovery source. */
  private async importLegacyStore() {
    if (this.database.name !== DATABASE_NAME || await this.database.metadata.get(LEGACY_IMPORT_KEY)) return;
    let rows: DocumentRow[] = [];
    if (await Dexie.exists(LEGACY_DATABASE_NAME)) {
      // Open the existing schema dynamically; never upgrade the backup database.
      const legacy = new Dexie(LEGACY_DATABASE_NAME);
      try {
        await legacy.open();
        rows = await legacy.table<DocumentRow>("documents").toArray();
      } finally {
        legacy.close();
      }
    }
    await this.database.transaction("rw", this.database.documents, this.database.metadata, async () => {
      if (await this.database.metadata.get(LEGACY_IMPORT_KEY)) return;
      for (const row of rows) {
        // A workbook already saved under the new name always takes precedence.
        if (!await this.database.documents.get(row.documentId)) await this.database.documents.add(row);
      }
      // This also prevents deleted workbooks from reappearing on a later startup.
      await this.database.metadata.put({ key: LEGACY_IMPORT_KEY });
    });
  }

  async list(): Promise<DocumentSummary[]> {
    await this.ensureReady();
    const rows = await this.database.documents.orderBy("updatedAt").reverse().toArray();
    return rows.map(toDocumentSummary);
  }

  async get(documentId: string): Promise<DocumentEnvelope | null> {
    await this.ensureReady();
    const row = await this.database.documents.get(documentId);
    return row ? this.toEnvelope(row) : null;
  }

  async getMostRecent(): Promise<DocumentEnvelope | null> {
    await this.ensureReady();
    const row = await this.database.documents.orderBy("updatedAt").reverse().first();
    return row ? this.toEnvelope(row) : null;
  }

  async save(document: DocumentEnvelope): Promise<void> {
    await this.ensureReady();
    const row: DocumentRow = {
      ...structuredClone(document),
      schemaVersion: document.schemaVersion,
      updatedAt: document.updatedAt,
    };
    await this.database.documents.put(row);
  }

  async insert(document: DocumentEnvelope): Promise<boolean> {
    await this.ensureReady();
    try {
      await this.database.documents.add(structuredClone(document));
      return true;
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'ConstraintError') return false;
      throw cause;
    }
  }

  async remove(documentId: string): Promise<void> {
    await this.ensureReady();
    await this.database.documents.delete(documentId);
  }

  close(): void {
    this.database.close();
  }

  /**
   * Stored data is re-validated on read. A row written by an older version is
   * migrated; a row from a newer version is reported as an error rather than
   * being partially loaded.
   */
  private toEnvelope(row: DocumentRow): DocumentEnvelope {
    const { documentId, ...candidate } = row;
    const result = migrateDocument({ ...candidate, documentId });
    if (!result.ok) {
      throw new Error(
        `Stored document ${documentId} could not be read: ${result.error.message}`,
      );
    }
    return result.document;
  }
}
