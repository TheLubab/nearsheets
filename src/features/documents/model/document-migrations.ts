import type { DocumentEnvelope } from "./document-envelope";
import { DOCUMENT_FORMAT, SCHEMA_VERSION } from "./document-envelope";
import type { DocumentValidationError } from "./document-schema";
import { validateDocument } from "./document-schema";

/**
 * Explicit, ordered document migrations.
 *
 * Rules for adding a migration:
 * - A migration receives the *unvalidated* raw value and returns the next
 *   shape. It must not mutate its input.
 * - Register exactly one migration per consecutive version step.
 * - Never edit or delete a released migration; write a new one instead.
 * - Migrations must be pure and must not touch the network or storage.
 */
export interface DocumentMigration {
  /** Envelope version this migration produces. */
  toVersion: number;
  migrate(document: Record<string, unknown>): Record<string, unknown>;
}

export const documentMigrations: readonly DocumentMigration[] = [
  {
    toVersion: 2,
    /**
     * Version 2 adds the local submission journal.
     *
     * An older document has no record of submissions, so it starts with an
     * empty journal. Inventing entries would claim payments were proposed that
     * were never recorded.
     */
    migrate: (document) => ({ ...document, submissions: {} }),
  },
];

export type MigrationResult =
  | { ok: true; document: DocumentEnvelope; migratedFrom: number | null }
  | { ok: false; error: DocumentValidationError };

const fail = (
  code: DocumentValidationError["code"],
  message: string,
): MigrationResult => ({ ok: false, error: { code, message } });

/**
 * Brings an untrusted value up to the supported schema version and validates
 * it. The input is never mutated, so the caller still holds the original
 * representation if migration fails.
 */
export function migrateDocument(
  value: unknown,
  migrations: readonly DocumentMigration[] = documentMigrations,
  supportedVersion: number = SCHEMA_VERSION,
): MigrationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("not-an-object", "The file does not contain a document.");
  }

  // Check the format marker before the version: unrelated JSON usually has no
  // `schemaVersion`, and "not a Trezu Sheets document" is the useful message.
  if ((value as { format?: unknown }).format !== DOCUMENT_FORMAT) {
    return fail(
      "not-a-trezu-document",
      "This is not a Trezu Sheets document. Use Import to load a Trezu Sheets .json file.",
    );
  }

  const initial = (value as { schemaVersion?: unknown }).schemaVersion;
  if (typeof initial !== "number" || !Number.isInteger(initial) || initial < 0) {
    return fail("invalid-document", "The document is missing a valid schema version.");
  }
  if (initial > supportedVersion) {
    return fail(
      "unsupported-future-version",
      `This document uses format version ${initial}, but this application supports up to version ${supportedVersion}. Update Trezu Sheets instead of importing it here.`,
    );
  }

  let current: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  let version = initial;
  const applied: number[] = [];

  while (version < supportedVersion) {
    const step = migrations.find((candidate) => candidate.toVersion === version + 1);
    if (!step) {
      return fail(
        "invalid-document",
        `No migration exists from document version ${version} to ${version + 1}.`,
      );
    }
    current = { ...step.migrate(current), schemaVersion: version + 1 };
    version += 1;
    applied.push(version);
  }

  const validated = validateDocument(current, supportedVersion);
  if (!validated.ok) {
    return validated;
  }

  return {
    ok: true,
    document: validated.document,
    migratedFrom: applied.length > 0 ? initial : null,
  };
}