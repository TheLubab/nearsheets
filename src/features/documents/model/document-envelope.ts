import type { WorkbookSnapshot } from "../../spreadsheet/model/workbook-snapshot";

/**
 * Format marker stored in every exported document. It lets the importer reject
 * unrelated JSON (for example a raw Univer snapshot) with a clear message
 * instead of half-loading it.
 */
export const DOCUMENT_FORMAT = "trezu-sheets";

/**
 * Current envelope schema version.
 *
 * Bump this whenever the envelope shape changes and register a migration in
 * `migrations.ts`. Never change the meaning of an existing field in place.
 */
export const SCHEMA_VERSION = 1;

/**
 * Version of the custom-function catalog the workbook was calculated with.
 *
 * The catalog itself lives in `src/features/treasury/formulas/custom-functions.ts`;
 * only its version is imported here, so document validation does not pull the
 * formula engine into storage and import code.
 */
import { FUNCTION_CATALOG_VERSION } from "../../treasury/model/function-catalog-version";
export { FUNCTION_CATALOG_VERSION };

/** Univer release this application pins; recorded for diagnostics. */
export const UNIVER_ENGINE_VERSION = "1.4.0";

/** Treasury/network context a document was authored in. */
export interface TreasuryMetadata {
  network: "mainnet" | "testnet";
  /** Selected treasury account, once one is chosen. */
  accountId: string | null;
}

export interface DocumentEngineMetadata {
  /** Univer version that produced the snapshot. */
  univer: string;
}

export interface DocumentFunctionMetadata {
  catalogVersion: number;
}

/**
 * A Trezu Sheets document: application metadata plus a lossless Univer
 * workbook snapshot.
 *
 * Identities are explicit. The document has a stable id independent of its
 * file name, and the snapshot keeps Univer's own workbook/sheet ids. Future
 * action metadata can therefore reference a stable document rather than a row
 * position.
 */
export interface DocumentEnvelope {
  format: typeof DOCUMENT_FORMAT;
  schemaVersion: number;
  documentId: string;
  title: string;
  /** ISO 8601 timestamps in UTC. */
  createdAt: string;
  updatedAt: string;
  engine: DocumentEngineMetadata;
  customFunctions: DocumentFunctionMetadata;
  treasury: TreasuryMetadata;
  workbook: WorkbookSnapshot;
}

export interface CreateDocumentEnvelopeOptions {
  /** Omit to mint a new id. */
  documentId?: string;
  title: string;
  workbook: WorkbookSnapshot;
  treasury: TreasuryMetadata;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

export function createDocumentEnvelope(
  options: CreateDocumentEnvelopeOptions,
): DocumentEnvelope {
  const timestamp = (options.now ?? new Date()).toISOString();
  return {
    format: DOCUMENT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    documentId: options.documentId ?? globalThis.crypto.randomUUID(),
    title: options.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    engine: { univer: UNIVER_ENGINE_VERSION },
    customFunctions: { catalogVersion: FUNCTION_CATALOG_VERSION },
    treasury: { ...options.treasury },
    workbook: options.workbook,
  };
}

/**
 * Returns a copy of `document` with a fresh snapshot and timestamp. The input
 * is not mutated, so a failed save cannot leave the caller's state half-updated.
 */
export function withWorkbookSnapshot(
  document: DocumentEnvelope,
  workbook: WorkbookSnapshot,
  now: Date = new Date(),
): DocumentEnvelope {
  return {
    ...document,
    workbook,
    updatedAt: now.toISOString(),
  };
}

export function renameDocument(
  document: DocumentEnvelope,
  title: string,
  now: Date = new Date(),
): DocumentEnvelope {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error("A document title cannot be empty.");
  }
  return {
    ...document,
    title: trimmed,
    updatedAt: now.toISOString(),
  };
}

/** Short, human-readable summary used by document pickers. */
export interface DocumentSummary {
  documentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function toDocumentSummary(document: DocumentEnvelope): DocumentSummary {
  return {
    documentId: document.documentId,
    title: document.title,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/**
 * Creates an untitled document around a blank workbook. The caller is expected
 * to pass a real blank snapshot from the editor so Univer owns the structure.
 */
export function createBlankDocument(
  workbook: WorkbookSnapshot,
  treasury: TreasuryMetadata,
  options: { title?: string; documentId?: string; now?: Date } = {},
): DocumentEnvelope {
  return createDocumentEnvelope({
    title: options.title ?? "Untitled budget",
    workbook,
    treasury,
    documentId: options.documentId,
    now: options.now,
  });
}