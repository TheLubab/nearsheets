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

const DATABASE_NAME = "trezu-sheets";
const DATABASE_VERSION = 1;

export function createDocumentDatabase(name: string = DATABASE_NAME): Dexie & {
  documents: EntityTable<DocumentRow, "documentId">;
} {
  const database = new Dexie(name) as Dexie & {
    documents: EntityTable<DocumentRow, "documentId">;
  };
  database.version(DATABASE_VERSION).stores({
    documents: "documentId, updatedAt",
  });
  return database;
}

export class DexieDocumentRepository implements DocumentRepository {
  constructor(private readonly database = createDocumentDatabase()) {}

  async list(): Promise<DocumentSummary[]> {
    const rows = await this.database.documents.orderBy("updatedAt").reverse().toArray();
    return rows.map(toDocumentSummary);
  }

  async get(documentId: string): Promise<DocumentEnvelope | null> {
    const row = await this.database.documents.get(documentId);
    return row ? this.toEnvelope(row) : null;
  }

  async getMostRecent(): Promise<DocumentEnvelope | null> {
    const row = await this.database.documents.orderBy("updatedAt").reverse().first();
    return row ? this.toEnvelope(row) : null;
  }

  async save(document: DocumentEnvelope): Promise<void> {
    const row: DocumentRow = {
      ...structuredClone(document),
      schemaVersion: document.schemaVersion,
      updatedAt: document.updatedAt,
    };
    await this.database.documents.put(row);
  }

  async remove(documentId: string): Promise<void> {
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