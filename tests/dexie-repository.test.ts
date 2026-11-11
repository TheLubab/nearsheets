import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createDocumentDatabase } from "../src/features/documents/repository/dexie-document-repository";
import { DexieDocumentRepository } from "../src/features/documents/repository/dexie-document-repository";
import { createDocumentEnvelope } from "../src/features/documents/model/document-envelope";
import type { WorkbookSnapshot } from "../src/features/spreadsheet/model/workbook-snapshot";

let databaseCounter = 0;
const openRepositories: DexieDocumentRepository[] = [];

function createRepository(): DexieDocumentRepository {
  databaseCounter += 1;
  const repository = new DexieDocumentRepository(
    createDocumentDatabase(`trezu-sheets-test-${databaseCounter}`),
  );
  openRepositories.push(repository);
  return repository;
}

afterEach(() => {
  for (const repository of openRepositories.splice(0)) {
    repository.close();
  }
});

function snapshot(name: string, value: number): WorkbookSnapshot {
  return {
    id: `wb-${name}`,
    name,
    sheetOrder: ["s1"],
    sheets: { s1: { id: "s1", name: "Sheet1", cellData: { 0: { 0: { v: value } } } } },
  };
}

function document(name: string, updatedAt: string, value = 1) {
  return createDocumentEnvelope({
    documentId: `doc-${name}`,
    title: name,
    workbook: snapshot(name, value),
    treasury: { network: "mainnet", accountId: "treasury.near" },
    now: new Date(updatedAt),
  });
}

describe("Dexie document repository", () => {
  it("round-trips a document without losing the workbook", async () => {
    const repository = createRepository();
    const original = document("Budget", "2026-11-11T09:00:00.000Z");
    await repository.save(original);

    const restored = await repository.get(original.documentId);

    expect(restored?.documentId).toBe(original.documentId);
    expect(restored?.treasury).toEqual({
      network: "mainnet",
      accountId: "treasury.near",
    });
    expect(restored?.workbook.sheets.s1?.cellData?.[0]?.[0]?.v).toBe(1);
  });

  it("lists newest first and returns the most recent document", async () => {
    const repository = createRepository();
    await repository.save(document("Older", "2026-11-10T09:00:00.000Z"));
    await repository.save(document("Newer", "2026-11-11T09:00:00.000Z"));

    expect((await repository.list()).map((entry) => entry.title)).toEqual([
      "Newer",
      "Older",
    ]);
    expect((await repository.getMostRecent())?.title).toBe("Newer");
  });

  it("replaces a document with the same id instead of duplicating it", async () => {
    const repository = createRepository();
    const original = document("Budget", "2026-11-10T09:00:00.000Z", 1);
    await repository.save(original);
    await repository.save({
      ...original,
      updatedAt: "2026-11-11T09:00:00.000Z",
      workbook: snapshot("Budget", 2),
    });

    expect(await repository.list()).toHaveLength(1);
    expect((await repository.get(original.documentId))?.workbook.sheets.s1?.cellData?.[0]?.[0]?.v).toBe(2);
  });

  it("returns null for a missing document and removes on request", async () => {
    const repository = createRepository();
    expect(await repository.get("missing")).toBeNull();

    const stored = document("Budget", "2026-11-11T09:00:00.000Z");
    await repository.save(stored);
    await repository.remove(stored.documentId);

    expect(await repository.get(stored.documentId)).toBeNull();
    expect(await repository.getMostRecent()).toBeNull();
  });

  it("survives reopening the database", async () => {
    const name = "trezu-sheets-reopen-test";
    const first = new DexieDocumentRepository(createDocumentDatabase(name));
    await first.save(document("Persistent", "2026-11-11T09:00:00.000Z"));
    first.close();

    const second = new DexieDocumentRepository(createDocumentDatabase(name));
    openRepositories.push(second);
    expect((await second.getMostRecent())?.title).toBe("Persistent");
  });
});