import { describe, expect, it, vi } from 'vitest';
import { CommandType } from '@univerjs/core';
import { createDocumentWorkspace, createBlankWorkbook } from '../src/features/documents/application/document-workspace';
import { createDocumentEnvelope } from '../src/features/documents/model/document-envelope';
import { MemoryDocumentRepository } from '../src/features/documents/repository/document-repository';
import { createSpreadsheetNavigation, parseSpreadsheetRoute, spreadsheetPath } from '../src/features/documents/application/spreadsheet-navigation';
import type { WorkbookSession } from '../src/features/spreadsheet/univer/create-workbook-session';
import type { NavigationHost } from '../src/features/documents/application/spreadsheet-navigation';

function historyHost(initial = '/') {
  const entries = [initial]; let index = 0;
  const listeners = new Set<() => void>();
  const host: NavigationHost = {
    path: () => entries[index]!,
    push: path => { entries.splice(index + 1); entries.push(path); index++; },
    replace: path => { entries[index] = path; },
    listen: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  return { host, entries, move: (offset: number) => { index += offset; for (const listener of listeners) listener(); } };
}
const treasury = { network: 'testnet' as const, accountId: null };
async function setup(path = '/', ids: string[] = []) {
  const repository = new MemoryDocumentRepository();
  for (const documentId of ids) await repository.save(createDocumentEnvelope({ documentId, title: documentId, workbook: createBlankWorkbook(), treasury }));
  const workspace = createDocumentWorkspace({ repository, treasury });
  const history = historyHost(path);
  const navigation = createSpreadsheetNavigation(workspace, history.host);
  await navigation.start();
  return { repository, workspace, history, navigation, dispose: () => { navigation.dispose(); workspace.dispose(); } };
}
function attachEditor(workspace: ReturnType<typeof createDocumentWorkspace>) {
  let snapshot = workspace.getState().document!.workbook;
  const callbacks = new Set<(command: { type: CommandType }) => void>();
  const session = {
    getWorkbook: () => ({ onCommandExecuted: (callback: (command: { type: CommandType }) => void) => {
      callbacks.add(callback); return { dispose: () => { callbacks.delete(callback); } };
    } }),
    saveSnapshot: () => snapshot,
  } as unknown as WorkbookSession;
  workspace.attachSession(session, workspace.getState().document!.documentId);
  return { session, edit: () => { snapshot = { ...snapshot, name: 'Pending edits' }; for (const callback of callbacks) callback({ type: CommandType.MUTATION }); } };
}

describe('spreadsheet links', () => {
  it('encodes and decodes existing IDs and ignores wallet callback query strings', () => {
    const id = 'a legacy/id with spaces';
    expect(parseSpreadsheetRoute(spreadsheetPath(id) + '?transactionHashes=tx#receipt')).toEqual({ kind: 'spreadsheet', documentId: id });
    for (const path of ['/s/', '/s/%XX', '/unknown', '/s/a/b']) expect(parseSpreadsheetRoute(path)).toEqual({ kind: 'invalid' });
  });

  it.each([{ ids: [] as string[] }, { ids: ['saved-file'] }])('starts at home without selecting or creating a file ($ids)', async ({ ids }) => {
    const f = await setup('/', ids);
    try {
      expect(f.workspace.getState().document).toBeNull();
      expect(f.navigation.getState()).toMatchObject({ status: 'ready', route: { kind: 'home' }, error: null });
      expect(await f.repository.list()).toHaveLength(ids.length);
    } finally { f.dispose(); }
  });

  it('opens the exact requested spreadsheet, preserving the callback URL and transaction evidence', async () => {
    const f = await setup('/s/chosen?transactionHashes=tx', ['other', 'chosen']);
    try {
      expect(f.workspace.getState().document?.documentId).toBe('chosen');
      expect(f.history.entries).toEqual(['/s/chosen?transactionHashes=tx']);
      expect(await f.repository.list()).toHaveLength(2);
      const record = { id: 'action', revision: 'r1', account: 'signer.testnet', at: new Date().toISOString(), state: 'confirmed' as const, transactionHash: 'tx', message: null };
      await f.workspace.recordExecution(record);
      await f.navigation.goHome();
      await f.workspace.openSavedDocument('chosen');
      expect(f.workspace.getState().document?.executions.action).toEqual(record);
    } finally { f.dispose(); }
  });

  it('pushes a stable address on create, rename does not add history, and Back/Forward reopen correctly', async () => {
    const f = await setup();
    try {
      await f.workspace.createNewDocument();
      const id = f.workspace.getState().document!.documentId;
      expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
      expect(f.history.host.path()).toBe(spreadsheetPath(id));
      await f.workspace.rename('Payroll');
      expect(f.history.entries).toHaveLength(2);
      const editor = attachEditor(f.workspace); editor.edit();
      f.history.move(-1); await f.navigation.whenIdle();
      expect(f.workspace.getState().document).toBeNull();
      expect((await f.repository.get(id))?.workbook.name).toBe('Pending edits');
      f.history.move(1); await f.navigation.whenIdle();
      expect(f.workspace.getState().document?.documentId).toBe(id);
      expect(f.workspace.getState().document?.title).toBe('Payroll');
    } finally { f.dispose(); }
  });

  it('updates links for opening, template creation, duplication, imports and deletion', async () => {
    const f = await setup('/', ['existing']);
    try {
      expect(await f.navigation.openDocument('existing')).toBe(true);
      expect(f.history.host.path()).toBe('/s/existing');
      await f.workspace.createFromTemplate('account-balances');
      const templateId = f.workspace.getState().document!.documentId;
      expect(templateId).toHaveLength(12);
      expect(f.history.host.path()).toBe(spreadsheetPath(templateId));
      await f.workspace.duplicateDocument(templateId);
      expect(f.workspace.getState().document!.documentId).toHaveLength(12);
      expect(f.history.host.path()).toBe(spreadsheetPath(f.workspace.getState().document!.documentId));
      await f.workspace.importCsv('Name,Amount\nAlice,2', 'budget.csv');
      const importedId = f.workspace.getState().document!.documentId;
      expect(importedId).toHaveLength(12);
      expect(f.history.host.path()).toBe(spreadsheetPath(importedId));
      await f.workspace.deleteDocument(importedId);
      expect(f.history.host.path()).toBe(spreadsheetPath(f.workspace.getState().document!.documentId));
      await f.navigation.goHome();
      expect(f.history.host.path()).toBe('/');
      expect(f.workspace.getState().document).toBeNull();
    } finally { f.dispose(); }
  });

  it.each(['/s/missing', '/s/%XX'])('shows recovery for %s without creating a file', async path => {
    const f = await setup(path);
    try {
      expect(f.workspace.getState().document).toBeNull();
      expect(f.navigation.getState().error?.kind).toBe(path === '/s/missing' ? 'missing' : 'invalid');
      expect(f.history.host.path()).toBe(path);
      expect(await f.repository.list()).toHaveLength(0);
      await f.navigation.goHome();
      expect(f.navigation.getState().error).toBeNull();
    } finally { f.dispose(); }
  });

  it('retains unsaved edits and restores the matching URL if Back cannot save', async () => {
    const f = await setup();
    try {
      await f.workspace.createNewDocument();
      const id = f.workspace.getState().document!.documentId;
      const editor = attachEditor(f.workspace); editor.edit();
      vi.spyOn(f.repository, 'save').mockRejectedValue(new Error('Disk full'));
      f.history.move(-1); await f.navigation.whenIdle();
      expect(f.workspace.getState().document?.documentId).toBe(id);
      expect(f.workspace.getSession()).toBe(editor.session);
      expect(f.history.host.path()).toBe(spreadsheetPath(id));
      expect(await f.workspace.exportJson()).toContain('Pending edits');
    } finally { f.dispose(); }
  });

  it('serializes rapid Back/Forward so a slow old read cannot replace the newest route', async () => {
    const f = await setup('/', ['first', 'second']);
    try {
      await f.workspace.openSavedDocument('first');
      await f.workspace.openSavedDocument('second');
      const get = f.repository.get.bind(f.repository);
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      vi.spyOn(f.repository, 'get').mockImplementation(async id => { if (id === 'first') await gate; return get(id); });
      f.history.move(-1);
      await vi.waitFor(() => expect(f.repository.get).toHaveBeenCalledWith('first'));
      f.history.move(1);
      release(); await f.navigation.whenIdle();
      expect(f.workspace.getState().document?.documentId).toBe('second');
      expect(f.history.host.path()).toBe('/s/second');
    } finally { f.dispose(); }
  });

  it('puts a missing explicitly opened ID in the address and lets an imported backup recover it', async () => {
    const f = await setup();
    try {
      expect(await f.navigation.openDocument('missing')).toBe(false);
      expect(f.history.host.path()).toBe('/s/missing');
      expect(f.navigation.getState().error?.kind).toBe('missing');
      expect(await f.repository.list()).toHaveLength(0);
      await f.workspace.importCsv('Amount\n2', 'backup.csv');
      expect(f.navigation.getState().error).toBeNull();
      expect(f.history.host.path()).toBe(spreadsheetPath(f.workspace.getState().document!.documentId));
      expect(await f.repository.list()).toHaveLength(1);
    } finally { f.dispose(); }
  });

  it('reloads a saved address without changing IDs or adding history', async () => {
    const f = await setup('/', ['existing']);
    await f.navigation.openDocument('existing');
    f.dispose();
    const workspace = createDocumentWorkspace({ repository: f.repository, treasury });
    const navigation = createSpreadsheetNavigation(workspace, f.history.host);
    try {
      await navigation.start();
      expect(workspace.getState().document?.documentId).toBe('existing');
      expect(f.history.entries).toEqual(['/', '/s/existing']);
      expect(await f.repository.list()).toHaveLength(1);
    } finally { navigation.dispose(); workspace.dispose(); }
  });

  it('shows a missing historical file without substituting another saved spreadsheet', async () => {
    const f = await setup('/', ['deleted', 'other']);
    try {
      await f.navigation.openDocument('deleted');
      await f.navigation.goHome();
      await f.workspace.deleteDocument('deleted');
      f.history.move(-1); await f.navigation.whenIdle();
      expect(f.history.host.path()).toBe('/s/deleted');
      expect(f.workspace.getState().document).toBeNull();
      expect(f.navigation.getState().error?.kind).toBe('missing');
      expect((await f.repository.list()).map(doc => doc.documentId)).toEqual(['other']);
    } finally { f.dispose(); }
  });

  it('retries a short-ID collision without overwriting an existing spreadsheet', async () => {
    const f = await setup('/', ['000000000000']);
    const original = await f.repository.get('000000000000');
    const random = vi.spyOn(crypto, 'getRandomValues')
      .mockReturnValueOnce(new Uint8Array(12))
      .mockReturnValueOnce(new Uint8Array(12).fill(1));
    try {
      expect(await f.workspace.createNewDocument()).toBe(true);
      expect(f.workspace.getState().document?.documentId).toBe('111111111111');
      expect(await f.repository.get('000000000000')).toEqual(original);
      expect(await f.repository.list()).toHaveLength(2);
    } finally { random.mockRestore(); f.dispose(); }
  });

  it('keeps existing files intact if unique-ID allocation repeatedly fails', async () => {
    const f = await setup('/', ['000000000000']);
    const original = await f.repository.get('000000000000');
    const random = vi.spyOn(crypto, 'getRandomValues').mockReturnValue(new Uint8Array(12));
    try {
      expect(await f.workspace.createNewDocument()).toBe(false);
      expect(f.workspace.getState().document).toBeNull();
      expect(await f.repository.get('000000000000')).toEqual(original);
      expect(await f.repository.list()).toHaveLength(1);
    } finally { random.mockRestore(); f.dispose(); }
  });

  it('keeps the live session when opening the already active spreadsheet', async () => {
    const f = await setup('/s/existing', ['existing']);
    try {
      const editor = attachEditor(f.workspace);
      expect(await f.workspace.openSavedDocument('existing')).toBe(true);
      expect(f.workspace.getSession()).toBe(editor.session);
    } finally { f.dispose(); }
  });
});
