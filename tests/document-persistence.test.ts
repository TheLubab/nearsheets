import { describe, expect, it, vi } from "vitest";
import { CommandType } from "@univerjs/core";
import type { WorkbookSession } from "../src/features/spreadsheet/univer/create-workbook-session";
import type { WorkbookSnapshot } from "../src/features/spreadsheet/model/workbook-snapshot";
import { createDocumentPersistence } from "../src/features/documents/session/document-persistence";
import type { DocumentEnvelope } from "../src/features/documents/model/document-envelope";
import {
  createDocumentEnvelope,
} from "../src/features/documents/model/document-envelope";
import type { DocumentRepository } from "../src/features/documents/repository/document-repository";
import { MemoryDocumentRepository } from "../src/features/documents/repository/document-repository";
import {
  createDocumentWorkspace,
} from "../src/features/documents/application/document-workspace";
import { serializeDocument } from "../src/features/documents/interchange/json";

const treasury = { network: "testnet" as const, accountId: null };

function snapshot(name = "Workbook"): WorkbookSnapshot {
  return {
    id: `workbook-${name}`,
    name,
    sheetOrder: ["s1"],
    sheets: { s1: { id: "s1", name: "Sheet1", cellData: { 0: { 0: { v: name } } } } },
  };
}

function envelope(name = "Doc"): DocumentEnvelope {
  return createDocumentEnvelope({
    documentId: `doc-${name}`,
    title: name,
    workbook: snapshot(name),
    treasury,
    now: new Date("2026-11-11T09:00:00.000Z"),
  });
}

/**
 * Fake editor: `current` is what `saveSnapshot` returns, and `emit` simulates a
 * command executed by the user.
 */
function fakeSession(initial: WorkbookSnapshot = snapshot()) {
  let current: WorkbookSnapshot = initial;
  const listeners = new Set<(command: { type?: CommandType }) => void>();

  const session: WorkbookSession = {
    univerAPI: {} as WorkbookSession["univerAPI"],
    getWorkbook: () => null,
    saveSnapshot: () => current as never,
    whenReady: async () => undefined,
    dispose: () => undefined,
  };

  return {
    session,
    onChange(callback: (command: { type?: CommandType }) => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    edit(next: Partial<WorkbookSnapshot>, type: CommandType = CommandType.MUTATION) {
      current = { ...current, ...next };
      for (const listener of listeners) {
        listener({ type });
      }
    },
    current: () => current,
  };
}

/** The real session attaches through `getWorkbook().onCommandExecuted`. */
function sessionWithWorkbook(initial: WorkbookSnapshot = snapshot()) {
  let current: WorkbookSnapshot = initial;
  const listeners = new Set<(command: { type?: CommandType }) => void>();

  const session = {
    univerAPI: {},
    getWorkbook: () => ({
      onCommandExecuted: (callback: (command: { type?: CommandType }) => void) => {
        listeners.add(callback);
        return { dispose: () => listeners.delete(callback) };
      },
    }),
    saveSnapshot: () => current,
    whenReady: async () => undefined,
    dispose: () => undefined,
  } as unknown as WorkbookSession;

  return {
    session,
    edit(next: Partial<WorkbookSnapshot>, type: CommandType = CommandType.MUTATION) {
      current = { ...current, ...next };
      for (const listener of listeners) {
        listener({ type });
      }
    },
    listenerCount: () => listeners.size,
  };
}

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("document persistence", () => {
  it("saves after an edit without writing on view-only operations", async () => {
    const repository = new MemoryDocumentRepository();
    const doc = envelope();
    await repository.save(doc);
    const fake = sessionWithWorkbook();
    const persistence = createDocumentPersistence({
      session: fake.session,
      repository,
      document: doc,
      debounceMs: 0,
      now: () => new Date("2026-11-11T10:00:00.000Z"),
    });

    // Selection and other operations do not change the snapshot.
    fake.edit({}, CommandType.OPERATION);
    await flushTimers();
    const storedBefore = await repository.get(doc.documentId);
    expect(storedBefore?.updatedAt).toBe(doc.updatedAt);

    // A real mutation does.
    fake.edit({ name: "Edited" });
    await flushTimers();
    const storedAfter = await repository.get(doc.documentId);
    expect(storedAfter?.workbook.name).toBe("Edited");
    expect(storedAfter?.updatedAt).toBe("2026-11-11T10:00:00.000Z");
    expect(persistence.getState().status).toBe("saved");

    persistence.dispose();
  });

  it("reports save failures and keeps the last good document", async () => {
    const stored: DocumentEnvelope[] = [];
    const repository: DocumentRepository = {
      list: async () => [],
      get: async () => null,
      getMostRecent: async () => null,
      save: async (document) => {
        if (stored.length > 0) {
          throw new Error("Quota exceeded");
        }
        stored.push(document);
      },
      remove: async () => undefined,
    };

    const doc = envelope();
    const fake = sessionWithWorkbook();
    const persistence = createDocumentPersistence({
      session: fake.session,
      repository,
      document: doc,
      debounceMs: 0,
    });

    fake.edit({ name: "First edit" });
    await flushTimers();
    expect(stored).toHaveLength(1);
    expect(persistence.getState().status).toBe("saved");

    fake.edit({ name: "Second edit" });
    await flushTimers();
    expect(persistence.getState().status).toBe("error");
    expect(persistence.getState().error).toContain("Quota");
    // The in-memory document is still the last saved version.
    expect(persistence.getDocument().workbook.name).toBe("First edit");

    persistence.dispose();
  });

  it("skips redundant writes when the snapshot is unchanged", async () => {
    const save = vi.fn(async () => undefined);
    const repository: DocumentRepository = {
      list: async () => [],
      get: async () => null,
      getMostRecent: async () => null,
      save,
      remove: async () => undefined,
    };
    const doc = envelope();
    const fake = sessionWithWorkbook();
    const persistence = createDocumentPersistence({
      session: fake.session,
      repository,
      document: doc,
      debounceMs: 0,
    });

    fake.edit({});
    await flushTimers();
    expect(save).not.toHaveBeenCalled();

    persistence.dispose();
  });

  it("stops listening after disposal", () => {
    const fake = sessionWithWorkbook();
    const persistence = createDocumentPersistence({
      session: fake.session,
      repository: new MemoryDocumentRepository(),
      document: envelope(),
      debounceMs: 0,
    });

    expect(fake.listenerCount()).toBe(1);
    persistence.dispose();
    expect(fake.listenerCount()).toBe(0);
  });
});

describe("document workspace", () => {
  const createWorkspace = (repository: DocumentRepository) =>
    createDocumentWorkspace({
      repository,
      treasury,
      now: () => new Date("2026-11-11T10:00:00.000Z"),
    });

  it("creates and persists the starter document on first run", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);

    await workspace.start();

    const document = workspace.getState().document;
    expect(workspace.getState().status).toBe("ready");
    expect(document?.title).toBe("Untitled workbook");
    expect(await repository.getMostRecent()).not.toBeNull();
  });

  it("reopens the most recent document instead of the starter", async () => {
    const repository = new MemoryDocumentRepository();
    const existing = envelope("Saved draft");
    await repository.save(existing);

    const workspace = createWorkspace(repository);
    await workspace.start();

    expect(workspace.getState().document?.documentId).toBe("doc-Saved draft");
  });

  it("leaves the current document intact when a JSON import is invalid", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const before = workspace.getState().document;
    const beforeStored = await repository.getMostRecent();

    await workspace.importJson("{ \"format\": \"something-else\" }");

    expect(workspace.getState().document?.documentId).toBe(before?.documentId);
    expect(workspace.getState().notice?.kind).toBe("error");
    // The stored copy is unchanged too.
    expect((await repository.getMostRecent())?.documentId).toBe(beforeStored?.documentId);
  });

  it("leaves the current document intact for an unsupported future version", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const before = workspace.getState().document;

    const future = JSON.parse(serializeDocument(before!)) as Record<string, unknown>;
    future.schemaVersion = 99;
    await workspace.importJson(JSON.stringify(future));

    expect(workspace.getState().document?.documentId).toBe(before?.documentId);
    expect(workspace.getState().notice?.message).toContain("Update NearSheets");
  });

  it("imports valid JSON as a new document without overwriting the original", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();

    const importedSource = envelope("Imported source");
    await workspace.importJson(serializeDocument(importedSource));

    const state = workspace.getState();
    expect(state.status).toBe("ready");
    expect(state.document?.workbook.name).toBe("Imported source");
    // A new identity, not the one in the file.
    expect(state.document?.documentId).not.toBe(importedSource.documentId);
    // Both documents remain in storage.
    expect((await repository.list()).length).toBeGreaterThanOrEqual(2);
  });

  it("imports CSV as a values-only document", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();

    await workspace.importCsv("Contributor,Amount\nSara,30\n", "Untitled workbook.csv");

    const document = workspace.getState().document;
    expect(document?.title).toBe("Untitled workbook");
    const sheet = document?.workbook.sheets[document.workbook.sheetOrder[0]!];
    expect(sheet?.name).toBe("Untitled workbook");
    expect(sheet?.cellData?.[1]?.[1]).toEqual({ v: 30 });
  });

  it("exports JSON in a form that imports again", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();

    const exported = await workspace.exportJson();
    expect(exported).not.toBeNull();

    const second = createWorkspace(new MemoryDocumentRepository());
    await second.start();
    await second.importJson(exported!);
    expect(second.getState().document?.title).toBe("Untitled workbook");
  });

  it("creates a new blank document", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();

    await workspace.createNewDocument();

    const document = workspace.getState().document;
    expect(document?.title).toBe("Untitled workbook");
    expect(document?.workbook.sheetOrder).toHaveLength(1);
  });

  it("persists a rename", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();

    await workspace.rename("Renamed budget");

    expect(workspace.getState().document?.title).toBe("Renamed budget");
    expect((await repository.getMostRecent())?.title).toBe("Renamed budget");
  });

  it("includes not-yet-debounced edits in an export", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const fake = sessionWithWorkbook();
    workspace.attachSession(fake.session, workspace.getState().document!.documentId);

    // Edit without waiting for the autosave debounce.
    fake.edit({ name: "Pending edit" });

    const exported = await workspace.exportJson();
    expect(exported).toContain("Pending edit");
    // Export captures without requiring a write.
    expect((await repository.getMostRecent())?.workbook.name).not.toBe("Pending edit");

    await workspace.flush();
  });

  it("exports the current snapshot when storage fails", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const fake = sessionWithWorkbook();
    workspace.attachSession(fake.session, workspace.getState().document!.documentId);
    fake.edit({ name: "Unsaved critical edit" });

    repository.save = async () => {
      throw new Error("Storage is unavailable");
    };

    const exported = await workspace.exportJson();
    expect(exported).toContain("Unsaved critical edit");
  });

  it("keeps the current document when pending edits cannot be saved", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const before = workspace.getState().document!.documentId;

    const fake = sessionWithWorkbook();
    workspace.attachSession(fake.session, before);
    fake.edit({ name: "Unsaved work" });

    // Make every subsequent write fail.
    const originalSave = repository.save.bind(repository);
    let failing = false;
    repository.save = async (document) => {
      if (failing) {
        throw new Error("Storage is unavailable");
      }
      await originalSave(document);
    };
    failing = true;

    await workspace.createNewDocument();

    // The switch was refused, so the editor still shows the edited document.
    expect(workspace.getState().document?.documentId).toBe(before);
    expect(workspace.getState().notice?.kind).toBe("error");
  });

  it("ignores a session attached for a document that is no longer open", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const fake = fakeSession();

    const detach = workspace.attachSession(fake.session, "some-other-document");
    fake.edit({ name: "should not save" });
    await flushTimers();
    detach();

    expect((await repository.getMostRecent())?.workbook.name).toBe("Untitled workbook");
  });

  it("does not let a stale attach detach the live editor", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const firstId = workspace.getState().document!.documentId;
    const first = sessionWithWorkbook();
    workspace.attachSession(first.session, firstId);

    // Switch documents; the new editor attaches, then the replaced editor's
    // late readiness callback arrives for the document that is no longer open.
    await workspace.createNewDocument();
    const secondId = workspace.getState().document!.documentId;
    const second = sessionWithWorkbook();
    workspace.attachSession(second.session, secondId);
    workspace.attachSession(sessionWithWorkbook().session, firstId);

    second.edit({ name: "Live edit" });
    await workspace.flush();
    expect((await repository.get(secondId))?.workbook.name).toBe("Live edit");
  });

  it("records a treasury selection as saved metadata", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();

    await workspace.setTreasury({ network: "mainnet", accountId: "my-dao.near" });

    expect(workspace.getState().document?.treasury).toEqual({
      network: "mainnet",
      accountId: "my-dao.near",
    });
    expect((await repository.getMostRecent())?.treasury.accountId).toBe("my-dao.near");
  });

  it("keeps later autosaves on the selected treasury", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    await workspace.setTreasury({ network: "testnet", accountId: "dao.testnet" });

    // Autosave is re-bound to the updated envelope; an edit must not write the
    // previous treasury back.
    const documentId = workspace.getState().document!.documentId;
    const fake = sessionWithWorkbook();
    workspace.attachSession(fake.session, documentId);
    fake.edit({ name: "After treasury" });
    await workspace.flush();

    const stored = await repository.get(documentId);
    expect(stored?.treasury.accountId).toBe("dao.testnet");
    expect(stored?.workbook.name).toBe("After treasury");
  });

  it("does not rewrite the document when the treasury is unchanged", async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createWorkspace(repository);
    await workspace.start();
    const original = workspace.getState().document!;

    await workspace.setTreasury({ network: original.treasury.network, accountId: null });

    expect(workspace.getState().document).toBe(original);
  });
});
describe('template creation preserves documents', () => {
  const setup = async () => {
    const repository = new MemoryDocumentRepository();
    const workspace = createDocumentWorkspace({ repository, treasury });
    await workspace.start();
    const original = workspace.getState().document!;
    const editor = sessionWithWorkbook(original.workbook);
    workspace.attachSession(editor.session, original.documentId);
    return { repository, workspace, original, editor };
  };

  it('saves pending edits before opening an independent template copy', async () => {
    const f = await setup();
    try {
      f.editor.edit({ name: 'Pending edits' });
      expect(await f.workspace.createFromTemplate('account-balances')).toBe(true);
      expect((await f.repository.get(f.original.documentId))?.workbook.name).toBe('Pending edits');
      expect(f.workspace.getState().document?.documentId).not.toBe(f.original.documentId);
      expect(f.editor.listenerCount()).toBe(0);
    } finally { f.workspace.dispose(); }
  });

  it('keeps the current editor and export when pending edits cannot be saved', async () => {
    const f = await setup();
    try {
      f.editor.edit({ name: 'Unsaved work' });
      vi.spyOn(f.repository, 'save').mockRejectedValue(new Error('Disk full'));
      expect(await f.workspace.createFromTemplate('getting-started')).toBe(false);
      expect(f.workspace.getState().document?.documentId).toBe(f.original.documentId);
      expect(f.editor.listenerCount()).toBe(1);
      expect(await f.workspace.exportJson()).toContain('Unsaved work');
      expect(await f.repository.list()).toHaveLength(1);
    } finally { f.workspace.dispose(); }
  });

  it('keeps current work when saving the template fails', async () => {
    const f = await setup();
    try {
      vi.spyOn(f.repository, 'save').mockRejectedValue(new Error('Template storage unavailable'));
      expect(await f.workspace.createFromTemplate('contributor-payments')).toBe(false);
      expect(f.workspace.getState().notice?.message).toContain('Template storage unavailable');
      expect(f.workspace.getSession()).toBe(f.editor.session);
      expect(await f.repository.list()).toHaveLength(1);
    } finally { f.workspace.dispose(); }
  });

  it('ignores duplicate creation requests and settles edits made during template persistence', async () => {
    const f = await setup();
    try {
      const save = f.repository.save.bind(f.repository);
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      vi.spyOn(f.repository, 'save').mockImplementation(async document => {
        if (document.documentId !== f.original.documentId) await gate;
        await save(document);
      });
      const first = f.workspace.createFromTemplate('dao-proposals');
      await vi.waitFor(() => expect(f.repository.save).toHaveBeenCalled());
      expect(await f.workspace.createFromTemplate('dao-proposals')).toBe(false);
      f.editor.edit({ name: 'Edited during save' });
      release();
      expect(await first).toBe(true);
      expect((await f.repository.get(f.original.documentId))?.workbook.name).toBe('Edited during save');
      expect(await f.repository.list()).toHaveLength(2);
    } finally { f.workspace.dispose(); }
  });
});
