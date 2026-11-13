import type {
  DocumentEnvelope,
  DocumentSummary,
} from "../model/document-envelope";
import { toDocumentSummary } from "../model/document-envelope";

/**
 * Storage boundary for local documents.
 *
 * Everything above this interface (React components, the editor bridge) is
 * storage-agnostic. A future remote repository can implement the same contract
 * without changing the sheet UI. Implementations must reject rather than
 * silently swallow write failures: IndexedDB is a draft store, not a backup,
 * and the UI has to be able to say that a save did not happen.
 */
export interface DocumentRepository {
  /** Most recently updated first. */
  list(): Promise<DocumentSummary[]>;
  get(documentId: string): Promise<DocumentEnvelope | null>;
  /** Newest updated document, or `null` when the store is empty. */
  getMostRecent(): Promise<DocumentEnvelope | null>;
  /** Creates or replaces the document with the same `documentId`. */
  save(document: DocumentEnvelope): Promise<void>;
  /** Inserts a fresh identity; false means that identity already exists. */
  insert?(document: DocumentEnvelope): Promise<boolean>;
  remove(documentId: string): Promise<void>;
}

export class MemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, DocumentEnvelope>();
  private readonly inserting = new Set<string>();

  async insert(document: DocumentEnvelope): Promise<boolean> {
    const id = document.documentId;
    if (this.documents.has(id) || this.inserting.has(id)) return false;
    this.inserting.add(id);
    try { await this.save(document); return true; }
    finally { this.inserting.delete(id); }
  }

  async list(): Promise<DocumentSummary[]> {
    return [...this.documents.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toDocumentSummary);
  }

  async get(documentId: string): Promise<DocumentEnvelope | null> {
    return this.documents.get(documentId) ?? null;
  }

  async getMostRecent(): Promise<DocumentEnvelope | null> {
    const [mostRecent] = await this.list();
    return mostRecent ? this.get(mostRecent.documentId) : null;
  }

  async save(document: DocumentEnvelope): Promise<void> {
    // Clone through structured serialization so callers cannot mutate stored
    // state after saving, matching a real database boundary.
    this.documents.set(
      document.documentId,
      structuredClone(document) as DocumentEnvelope,
    );
  }

  async remove(documentId: string): Promise<void> {
    this.documents.delete(documentId);
  }
}
