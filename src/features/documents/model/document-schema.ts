import { executionSchema } from '../../table/execution';
import { z } from "zod";
import type { WorkbookSnapshot } from "../../spreadsheet/model/workbook-snapshot";
import { isWorkbookSnapshot } from "../../spreadsheet/model/workbook-snapshot";
import { validateSubmissionRecord } from "../../treasury/model/proposal-submissions";
import type { SubmissionRecord } from "../../treasury/model/proposal-submissions";
import {
  DOCUMENT_FORMAT,
  SCHEMA_VERSION,
  type DocumentEnvelope,
} from "./document-envelope";

/**
 * Envelope validation for imported and stored documents.
 *
 * The envelope's own fields are validated strictly. The Univer snapshot is
 * validated structurally instead of field-by-field: Univer adds snapshot
 * fields across releases, so a full schema would reject valid workbooks while
 * still failing to prove the snapshot is safe to load.
 */

const isoUtcTimestamp = z.iso.datetime();

const treasurySchema = z.object({
  network: z.enum(["mainnet", "testnet"]),
  accountId: z.string().min(1).nullable(),
});

/** Structural checks only; unknown snapshot fields are preserved untouched. */
const workbookSchema = z.custom<WorkbookSnapshot>(
  (value) => isWorkbookSnapshot(value),
  "Not a loadable workbook snapshot",
);

/**
 * Submission journal: each entry is validated, and its key must match its own
 * treasury and draft. A corrupt entry rejects the document rather than being
 * dropped, because a silently missing record would permit a duplicate payment.
 */
const submissionsSchema = z.record(z.string(), z.unknown()).transform(
  (entries, ctx): Record<string, SubmissionRecord> => {
    const result: Record<string, SubmissionRecord> = {};
    for (const [key, value] of Object.entries(entries)) {
      const validated = validateSubmissionRecord(value);
      if (!validated.ok) {
        ctx.addIssue({ code: "custom", path: [key], message: validated.error });
        return z.NEVER;
      }
      if (validated.record.key !== key) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "the submission key does not match its record",
        });
        return z.NEVER;
      }
      result[key] = validated.record;
    }
    return result;
  },
);

const envelopeSchema = z.object({
  format: z.literal(DOCUMENT_FORMAT),
  // Version is checked separately so a newer file gets a clear message.
  schemaVersion: z.number().int().nonnegative(),
  documentId: z.string().min(1),
  title: z.string().trim().min(1),
  createdAt: isoUtcTimestamp,
  updatedAt: isoUtcTimestamp,
  engine: z.object({
    univer: z.string().min(1),
  }),
  customFunctions: z.object({
    catalogVersion: z.number().int().nonnegative(),
  }),
  treasury: treasurySchema,
  submissions: submissionsSchema,
  executions: z.record(z.string(), executionSchema).superRefine((entries,ctx)=>{
    for(const [key,record] of Object.entries(entries)) if(key!==record.id)ctx.addIssue({code:'custom',path:[key],message:'Execution identity does not match its journal key.'});
  }),
  workbook: workbookSchema,
});

export type DocumentValidationResult =
  | { ok: true; document: DocumentEnvelope }
  | { ok: false; error: DocumentValidationError };

export type DocumentValidationErrorCode =
  | "not-an-object"
  | "not-a-trezu-document"
  | "unsupported-future-version"
  | "invalid-document";

export interface DocumentValidationError {
  code: DocumentValidationErrorCode;
  message: string;
}

const invalid = (
  code: DocumentValidationErrorCode,
  message: string,
): DocumentValidationResult => ({ ok: false, error: { code, message } });

/**
 * Validates an untrusted value as a document envelope at the current schema
 * version.
 *
 * A file from a newer schema is rejected before any field is trusted, so an
 * older application can never silently drop data it does not understand.
 */
export function validateDocument(
  value: unknown,
  supportedVersion: number = SCHEMA_VERSION,
): DocumentValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid("not-an-object", "The file does not contain a document.");
  }

  const format = (value as { format?: unknown }).format;
  if (format !== DOCUMENT_FORMAT) {
    return invalid(
      "not-a-trezu-document",
      "This is not a NearSheets document. Use Import to load a NearSheets .json file.",
    );
  }

  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version === "number" && Number.isInteger(version) && version > supportedVersion) {
    return invalid(
      "unsupported-future-version",
      `This document uses format version ${version}, but this application supports up to version ${supportedVersion}. Update NearSheets instead of importing it here.`,
    );
  }

  const parsed = envelopeSchema.safeParse(value);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const location = firstIssue?.path.join(".") || "document";
    const detail = firstIssue?.message ?? "The document structure is invalid.";
    return invalid("invalid-document", `Invalid document at ${location}: ${detail}`);
  }

  return { ok: true, document: parsed.data as DocumentEnvelope };
}

/** True when the error means the file is from a newer application version. */
export function isFutureVersionError(
  error: DocumentValidationError,
): boolean {
  return error.code === "unsupported-future-version";
}
