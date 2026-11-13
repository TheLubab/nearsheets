import "fake-indexeddb/auto";
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocumentDatabase } from "../src/features/documents/repository/dexie-document-repository";
import { DexieDocumentRepository } from "../src/features/documents/repository/dexie-document-repository";
import { createDocumentEnvelope } from "../src/features/documents/model/document-envelope";
import type { WorkbookSnapshot } from "../src/features/spreadsheet/model/workbook-snapshot";

let databaseCounter = 0;
const openRepositories: DexieDocumentRepository[] = [];

function createRepository(): DexieDocumentRepository {
  databaseCounter += 1;
  const repository = new DexieDocumentRepository(
    createDocumentDatabase(`near-sheets-test-${databaseCounter}`),
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
    const name = "near-sheets-reopen-test";
    const first = new DexieDocumentRepository(createDocumentDatabase(name));
    await first.save(document("Persistent", "2026-11-11T09:00:00.000Z"));
    first.close();

    const second = new DexieDocumentRepository(createDocumentDatabase(name));
    openRepositories.push(second);
    expect((await second.getMostRecent())?.title).toBe("Persistent");
  });
});
describe('legacy database name migration',()=>{
  afterEach(async()=>{
    for(const repository of openRepositories.splice(0))repository.close();
    await Dexie.delete('near-sheets');
    await Dexie.delete('trezu-sheets');
  });
  async function legacyStore(rows:unknown[]) {
    const legacy=new Dexie('trezu-sheets');
    legacy.version(1).stores({documents:'documentId, updatedAt'});
    try {await legacy.table('documents').bulkPut(rows);}finally{legacy.close();}
  }
  function currentRepository(database=createDocumentDatabase()) {
    const repository=new DexieDocumentRepository(database);openRepositories.push(repository);return repository;
  }
  it('copies legacy documents and resources without rewriting user text or the legacy backup',async()=>{
    const original=document('Trezu Sheets is my label','2026-11-11T09:00:00.000Z');
    original.workbook.sheets.s1!.cellData![0]![0]={f:'=TREZU_ACCOUNT("alice.testnet")'};
    original.workbook.resources=[{name:'custom',data:'preserved'}];
    const legacy={...original,format:'trezu-sheets',schemaVersion:2};
    await legacyStore([legacy]);
    const repository=currentRepository();
    const restored=await repository.get(original.documentId);
    expect(restored?.format).toBe('nearsheets');
    expect(restored?.title).toBe(original.title);
    expect(restored?.workbook.resources).toEqual(original.workbook.resources);
    expect(restored?.workbook.sheets.s1?.cellData?.[0]?.[0]?.f).toBe('=NEAR_ACCOUNT("alice.testnet")');
    const backup=new Dexie('trezu-sheets');
    try {
      await backup.open();
      expect(await backup.table('documents').get(original.documentId)).toEqual(legacy);
      expect(backup.verno).toBe(1);
    }finally{backup.close();}
  });
  it('preserves existing target documents and never resurrects a migrated document after deletion',async()=>{
    const old=document('Budget','2026-11-10T09:00:00.000Z',1),newer=document('Budget','2026-11-11T09:00:00.000Z',2);
    const other=document('Other','2026-11-11T10:00:00.000Z');
    await legacyStore([old,other]);
    const target=createDocumentDatabase();await target.documents.put(newer);
    const repository=currentRepository(target);
    expect(await repository.get(newer.documentId)).toEqual(newer);
    expect(await repository.list()).toHaveLength(2);
    await repository.remove(other.documentId);repository.close();
    const reopened=currentRepository();
    expect(await reopened.list()).toHaveLength(1);
    expect(await reopened.get(other.documentId)).toBeNull();
  });
  it('rolls back a failed copy and retries without losing the old database',async()=>{
    const original=document('Budget','2026-11-10T09:00:00.000Z');
    await legacyStore([original]);
    const target=createDocumentDatabase();
    vi.spyOn(target.metadata,'put').mockRejectedValueOnce(new Error('Storage full'));
    const repository=currentRepository(target);
    await expect(repository.list()).rejects.toThrow('Storage full');
    expect(await target.documents.count()).toBe(0);
    expect(await target.metadata.count()).toBe(0);
    expect(await Dexie.exists('trezu-sheets')).toBe(true);
    expect(await repository.get(original.documentId)).toEqual(original);
  });
  it('creates the renamed store without creating an empty legacy database',async()=>{
    const repository=currentRepository();
    expect(await repository.list()).toEqual([]);
    expect(await Dexie.exists('near-sheets')).toBe(true);
    expect(await Dexie.exists('trezu-sheets')).toBe(false);
  });
});
