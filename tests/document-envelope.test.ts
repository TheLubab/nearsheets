import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FORMAT,
  SCHEMA_VERSION,
  createDocumentEnvelope,
  renameDocument,
  toDocumentSummary,
  withWorkbookSnapshot,
} from "../src/features/documents/model/document-envelope";
import {
  asImportedCopy,
  documentFileName,
  parseDocumentJson,
  serializeDocument,
} from "../src/features/documents/interchange/json";
import { migrateDocument } from "../src/features/documents/model/document-migrations";
import { validateDocument } from "../src/features/documents/model/document-schema";
import type { WorkbookSnapshot } from "../src/features/spreadsheet/model/workbook-snapshot";
import { createStarterWorkbook } from "./fixtures/legacy-workbook";

const fixedNow = new Date("2026-11-11T09:00:00.000Z");

function workbook(): WorkbookSnapshot {
  const starter = createStarterWorkbook();
  return {
    ...starter,
    id: starter.id ?? "workbook-test",
    name: starter.name ?? "Community budget",
    sheets: starter.sheets ?? {},
    sheetOrder: starter.sheetOrder ?? ["sheet-budget", "sheet-summary"],
  };
}

function document() {
  return createDocumentEnvelope({
    documentId: "doc-1",
    title: "Community budget",
    workbook: workbook(),
    treasury: { network: "testnet", accountId: null },
    now: fixedNow,
  });
}

describe("document envelope", () => {
  it("carries identity, version and treasury metadata", () => {
    const envelope = document();
    expect(envelope.format).toBe(DOCUMENT_FORMAT);
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.documentId).toBe("doc-1");
    expect(envelope.treasury).toEqual({ network: "testnet", accountId: null });
    expect(envelope.createdAt).toBe("2026-11-11T09:00:00.000Z");
    expect(envelope.engine.univer).toBe("1.4.0");
  });

  it("does not mutate the previous envelope when updating a snapshot", () => {
    const original = document();
    const updated = withWorkbookSnapshot(
      original,
      { ...original.workbook, name: "Renamed workbook" },
      new Date("2026-11-11T10:00:00.000Z"),
    );

    expect(original.workbook.name).toBe("Community budget");
    expect(updated.workbook.name).toBe("Renamed workbook");
    expect(updated.updatedAt).toBe("2026-11-11T10:00:00.000Z");
    expect(updated.createdAt).toBe(original.createdAt);
  });

  it("rejects an empty title on rename", () => {
    expect(() => renameDocument(document(), "   ")).toThrow();
  });

  it("summarizes without exposing the workbook", () => {
    const summary = toDocumentSummary(document());
    expect(summary).toEqual({
      documentId: "doc-1",
      title: "Community budget",
      createdAt: "2026-11-11T09:00:00.000Z",
      updatedAt: "2026-11-11T09:00:00.000Z",
    });
  });
});

describe("native JSON round trip", () => {
  it("preserves formulas, styles, sheets and metadata", () => {
    const original = document();
    const restored = parseDocumentJson(serializeDocument(original));

    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(restored.document.treasury).toEqual(original.treasury);
    expect(restored.document.workbook.sheetOrder).toEqual([
      "sheet-budget",
      "sheet-summary",
      "sheet-payments",
    ]);
    // Formulas stay formulas, not baked values.
    expect(
      restored.document.workbook.sheets["sheet-budget"]?.cellData?.[7]?.[2]?.f,
    ).toBe("=SUM(C4:C6)");
    // Formatting survives.
    expect(restored.document.workbook.styles?.currency?.n?.pattern).toBe("#,##0.00");
    expect(restored.document.workbook.sheets["sheet-budget"]?.mergeData).toHaveLength(1);
  });

  it("writes a stable, human-readable file with a trailing newline", () => {
    const json = serializeDocument(document());
    expect(json.endsWith("\n")).toBe(true);
    expect(json).toContain('"format": "nearsheets"');
    // No secrets or exported function implementations.
    expect(json).not.toContain("privateKey");
    expect(json).not.toMatch(/"function":/);
  });

  it("rejects malformed JSON without throwing", () => {
    const result = parseDocumentJson("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid-document");
    }
  });

  it("rejects unrelated JSON instead of partially loading it", () => {
    const rawSnapshot = JSON.stringify(workbook());
    const result = parseDocumentJson(rawSnapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not-a-trezu-document");
    }
  });

  it("rejects a document from a newer schema version", () => {
    const future = JSON.parse(serializeDocument(document())) as Record<string, unknown>;
    future.schemaVersion = SCHEMA_VERSION + 1;

    const result = parseDocumentJson(JSON.stringify(future));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unsupported-future-version");
      expect(result.error.message).toContain("Update NearSheets");
    }
  });

  it("imports as a new copy so it cannot overwrite an existing draft", () => {
    const imported = asImportedCopy(document(), {
      documentId: "doc-imported",
      now: new Date("2026-11-11T11:00:00.000Z"),
    });
    expect(imported.documentId).toBe("doc-imported");
    expect(imported.createdAt).toBe("2026-11-11T11:00:00.000Z");
  });

  it("derives safe export file names", () => {
    expect(documentFileName("Community Budget (2026)", "json")).toBe(
      "community-budget-2026.json",
    );
    expect(documentFileName("   ", "csv")).toBe("nearsheets.csv");
  });
});

describe("document validation and migration", () => {
  it("reports the failing field for an invalid envelope", () => {
    const invalid = { ...document(), title: "" };
    const result = validateDocument(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("title");
    }
  });

  it("rejects a snapshot whose sheet order references a missing sheet", () => {
    const broken = document();
    broken.workbook.sheetOrder = ["missing-sheet"];
    const result = validateDocument(broken);
    expect(result.ok).toBe(false);
  });

  it("runs no migration for the current version", () => {
    const result = migrateDocument(document());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migratedFrom).toBeNull();
    }
  });

  it("fails clearly when a version step has no registered migration", () => {
    const older = JSON.parse(serializeDocument(document())) as Record<string, unknown>;
    older.schemaVersion = 0;

    const result = migrateDocument(older);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("No migration exists");
    }
  });

  it("applies registered migrations without mutating the source", () => {
    const older = JSON.parse(serializeDocument(document())) as Record<string, unknown>;
    older.schemaVersion = 0;

    const result = migrateDocument(older, [
      {
        toVersion: 1,
        migrate: (value) => ({ ...value, title: "Migrated title" }),
      },
      {
        toVersion: 2,
        migrate: (value) => ({ ...value, submissions: {} }),
      },
      { toVersion: 3, migrate: value => value },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.title).toBe("Migrated title");
      expect(result.migratedFrom).toBe(0);
    }
    // The caller's original object is untouched.
    expect(older.title).toBe("Community budget");
  });
});