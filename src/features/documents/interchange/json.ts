import type { WorkbookSnapshot } from "../../spreadsheet/model/workbook-snapshot";
import type { SubmissionRecord } from "../../treasury/model/proposal-submissions";
import type { DocumentEnvelope } from "../model/document-envelope";
import type { DocumentValidationError } from "../model/document-schema";
import { migrateDocument } from "../model/document-migrations";

/**
 * Native Trezu Sheets JSON is the lossless interchange format. It contains the
 * full document envelope, including the Univer snapshot, so formulas,
 * formatting, all sheets and plugin resources survive a round trip.
 *
 * Security note: the envelope has no fields for credentials, wallet secrets or
 * executable custom-function code. Export writes only known metadata and the
 * snapshot, so an unrelated property added in memory cannot leak into a file.
 */

/**
 * Copies a journal entry field by field.
 *
 * Export must not become a generic serializer: writing only known fields means
 * an extra property attached at runtime cannot travel into a file.
 */
function serializeSubmission(record: SubmissionRecord): SubmissionRecord {
  return {
    key: record.key,
    treasury: {
      network: record.treasury.network,
      accountId: record.treasury.accountId,
    },
    draftId: record.draftId,
    reference: record.reference,
    recipient: record.recipient,
    amountBaseUnits: record.amountBaseUnits,
    status: record.status,
    proposalId: record.proposalId,
    lastProposalIdBefore: record.lastProposalIdBefore,
    submittedBy: record.submittedBy,
    attempts: record.attempts.map((attempt) => ({
      at: attempt.at,
      transactionHash: attempt.transactionHash,
      outcome: attempt.outcome,
      message: attempt.message,
    })),
    updatedAt: record.updatedAt,
    note: record.note,
  };
}

/** Stable serialization order keeps exported files diff-friendly. */
export function serializeDocument(document: DocumentEnvelope): string {
  const payload = {
    format: document.format,
    schemaVersion: document.schemaVersion,
    documentId: document.documentId,
    title: document.title,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    engine: { univer: document.engine.univer },
    customFunctions: { catalogVersion: document.customFunctions.catalogVersion },
    treasury: {
      network: document.treasury.network,
      accountId: document.treasury.accountId,
    },
    submissions: Object.fromEntries(
      Object.entries(document.submissions).map(([key, record]) => [
        key,
        serializeSubmission(record),
      ]),
    ),
    workbook: document.workbook,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export type DocumentImportResult =
  | { ok: true; document: DocumentEnvelope; migratedFrom: number | null }
  | { ok: false; error: DocumentValidationError };

/** Parses and migrates native JSON. The source text is never mutated. */
export function parseDocumentJson(text: string): DocumentImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid-document",
        message: "The file is not valid JSON.",
      },
    };
  }

  const result = migrateDocument(parsed);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    document: result.document,
    migratedFrom: result.migratedFrom,
  };
}

/**
 * Marks a validated document as imported into this application: a new document
 * id is minted so an import cannot silently overwrite an existing local draft,
 * and timestamps record when it arrived.
 */
export function asImportedCopy(
  document: DocumentEnvelope,
  options: { documentId?: string; now?: Date } = {},
): DocumentEnvelope {
  const timestamp = (options.now ?? new Date()).toISOString();
  return {
    ...document,
    documentId: options.documentId ?? globalThis.crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** A safe, descriptive file name for a document export. */
export function documentFileName(title: string, extension: "json" | "csv"): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\uffff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base.length > 0 ? base : "trezu-budget"}.${extension}`;
}

/** Builds a CSV export of one sheet using this document's title. */
export function csvFileNameForSheet(
  title: string,
  sheetName: string | undefined,
): string {
  return documentFileName(sheetName ? `${title} ${sheetName}` : title, "csv");
}

export type { WorkbookSnapshot };