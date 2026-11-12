import { describe, expect, it, vi } from 'vitest';
import { Univer, LocaleType } from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import '@univerjs/sheets/facade';
import '@univerjs/sheets-formula/facade';
import { WORKBOOK_TEMPLATES, getWorkbookTemplate } from '../src/features/templates/catalog';
import type { TemplateId } from '../src/features/templates/catalog';
import { createWelcomePreference } from '../src/features/templates/welcome-preference';
import { createDocumentWorkspace } from '../src/features/documents/application/document-workspace';
import { MemoryDocumentRepository } from '../src/features/documents/repository/document-repository';
import { parseDocumentJson, serializeDocument } from '../src/features/documents/interchange/json';
import { TableRuntime } from '../src/features/table/runtime';
import { createTableFunctionCatalog } from '../src/features/spreadsheet/univer/table-functions';
import type { WorkbookSnapshot } from '../src/features/spreadsheet/model/workbook-snapshot';

const treasury = { network: 'testnet' as const, accountId: null };
function engine(id: TemplateId, snapshot?: WorkbookSnapshot) {
  const balance = vi.fn(async () => '1250000000000000000000000');
  const view = vi.fn(async (_network: string, _account: string, method: string): Promise<unknown> => {
    if (method === 'get_policy') return { proposal_bond: '100' };
    if (method === 'get_proposals') return [{ id: 4, description: 'Mock proposal', status: 'InProgress', proposer: 'author.testnet' }];
    if (method === 'ft_metadata') return { spec: 'ft-1.0.0', name: 'Test token', symbol: 'TOK', decimals: 6 };
    if (method === 'ft_balance_of') return '2000000';
    throw new Error(`Unexpected method: ${method}`);
  });
  // No wallet or submit capability exists in the calculation boundary.
  const runtime = new TableRuntime({ balance, view });
  const univer = new Univer({ locale: LocaleType.EN_US, locales: { [LocaleType.EN_US]: {} } });
  const api = FUniver.newAPI(univer);
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverFormulaEnginePlugin, { function: createTableFunctionCatalog(runtime,
    cell => api.getWorkbook(cell.unitId)?.getSheetBySheetId(cell.sheetId)?.getRange(cell.row, cell.column).getFormula() ?? '') });
  univer.registerPlugin(UniverSheetsFormulaPlugin);
  const book = api.createWorkbook(snapshot ?? getWorkbookTemplate(id).createWorkbook());
  const sheet = book.getActiveSheet();
  return { api, book, sheet, balance, view, runtime, dispose() { runtime.dispose(); univer.dispose(); } };
}

describe('template workbooks', () => {
  it.each(WORKBOOK_TEMPLATES)('$name creates independent snapshots that round-trip as ordinary documents', async template => {
    const repository = new MemoryDocumentRepository();
    const workspace = createDocumentWorkspace({ repository, treasury });
    await workspace.start();
    await workspace.createFromTemplate(template.id);
    const first = workspace.getState().document!;
    await workspace.createFromTemplate(template.id);
    const second = workspace.getState().document!;
    expect(first.documentId).not.toBe(second.documentId);
    expect(first.workbook.id).not.toBe(second.workbook.id);
    expect(first.workbook.sheetOrder.every(id => !second.workbook.sheetOrder.includes(id))).toBe(true);
    expect(first.executions).toEqual({}); expect(first.submissions).toEqual({});
    const parsed = parseDocumentJson(serializeDocument(first));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.document.workbook).toEqual(first.workbook);
    first.workbook.sheets[first.workbook.sheetOrder[0]!]!.cellData![0]![0]!.v = 'Changed';
    expect(second.workbook.sheets[second.workbook.sheetOrder[0]!]!.cellData![0]![0]!.v).not.toBe('Changed');
    const fresh = template.createWorkbook();
    expect(fresh.sheets[fresh.sheetOrder[0]!]!.cellData![0]![0]!.v).toBe(second.workbook.sheets[second.workbook.sheetOrder[0]!]!.cellData![0]![0]!.v);
    workspace.dispose();
  });

  it.each(WORKBOOK_TEMPLATES)('$name calculates fresh guards without contacting services', async template => {
    const f = engine(template.id);
    try {
      const address = template.id === 'getting-started' ? 'B11' : template.id === 'account-balances' ? 'B8' : template.id === 'dao-proposals' ? 'A9' : 'E10';
      await vi.waitFor(() => expect(f.sheet.getRange(address).getValue()).toMatch(/Enter/));
      expect(f.balance).not.toHaveBeenCalled(); expect(f.view).not.toHaveBeenCalled();
      expect(f.runtime.operations.size).toBe(0);
      if (template.id === 'getting-started') {
        await vi.waitFor(() => expect(f.sheet.getRange('B5').getValue()).toBe(6));
        f.sheet.getRange('B4').setValue(12);
        await vi.waitFor(() => expect(f.sheet.getRange('B5').getValue()).toBe(13));
      }
    } finally { f.dispose(); }
  });

  it('reads balances, totals matching units, reads tokens, and propagates actual errors', async () => {
    const f = engine('account-balances');
    try {
      f.sheet.getRange('A8').setValue('alice.testnet');
      await vi.waitFor(() => expect(f.sheet.getRange('B12').getValue()).toBe(1.25));
      f.sheet.getRange('B5').setValue('token.testnet');
      await vi.waitFor(() => expect(f.sheet.getRange('C8').getValue()).toBe(2));
      f.balance.mockRejectedValue(new TypeError('Failed to fetch'));
      f.sheet.getRange('A8').setValue('offline.testnet');
      await vi.waitFor(() => expect(f.sheet.getRange('B8').getValue()).toBe('#CONNECT!'));
      // Ordinary dependent arithmetic uses Univer's generic error; the
      // originating read retains its specific connection error/diagnostics.
      await vi.waitFor(() => expect(f.sheet.getRange('B12').getValue()).toBe('#VALUE!'));
    } finally { f.dispose(); }
  });

  it('spills proposal headers and data in the reserved area', async () => {
    const f = engine('dao-proposals');
    try {
      f.sheet.getRange('B3').setValue('dao.testnet');
      await vi.waitFor(() => expect(f.sheet.getRange('D10').getValue()).toBe('author.testnet'));
      expect(f.sheet.getRange('A9').getValue()).toBe('ID');
      expect(f.sheet.getRange('A10').getValue()).toBe(4);
      expect(f.view).toHaveBeenCalledWith('testnet', 'dao.testnet', 'get_proposals', { from_index: 0, limit: 100 });
    } finally { f.dispose(); }
  });

  it('passes exact amount text directly to a draft and shows recorded status without signing', async () => {
    const f = engine('contributor-payments');
    try {
      f.sheet.getRange('B3').setValue('dao.testnet');
      f.sheet.getRange('A10').setValue('invoice-unique-1');
      f.sheet.getRange('B10').setValue('alice.testnet');
      f.sheet.getRange('C10').setValue({ v: '1.000000000000000000000001', t: 1 });
      await vi.waitFor(() => expect(f.sheet.getRange('F10').getValue()).toBe('Draft · not submitted'));
      const label = f.sheet.getRange('E10').getValue() as string;
      expect(f.runtime.operations.get(label)).toMatchObject({ amount: '1.000000000000000000000001', baseUnits: '1000000000000000000000001' });
      expect(f.runtime.executions).toEqual({});
    } finally { f.dispose(); }
  });

  it('retains editable formulas, input formatting and exact text after native save and reopen', async () => {
    const first = engine('contributor-payments');
    let snapshot: WorkbookSnapshot;
    try {
      await vi.waitFor(() => expect(first.sheet.getRange('E10').getValue()).toBe('Enter all payment inputs'));
      first.sheet.getRange('C10').setValue({ v: '0.000000000000000000000001', t: 1 });
      snapshot = JSON.parse(JSON.stringify(first.book.save()));
    } finally { first.dispose(); }
    const second = engine('contributor-payments', snapshot);
    try {
      await vi.waitFor(() => expect(second.sheet.getRange('E10').getValue()).toBe('Enter all payment inputs'));
      expect(second.sheet.getRange('C10').getValue()).toBe('0.000000000000000000000001');
      expect(second.sheet.getRange('E10').getFormula()).toContain('SPUTNIK_TRANSFER(A10,$B$3,B10,C10,D10,$B$4)');
      const saved = second.book.save();
      const amount = saved.sheets[saved.sheetOrder[0]!]!.cellData![9]![2]!;
      expect(typeof amount.s === 'string' ? saved.styles[amount.s] : amount.s).toMatchObject({ n: { pattern: '@' }, bg: { rgb: '#FFF2CC' } });
      expect(second.view).not.toHaveBeenCalled();
    } finally { second.dispose(); }
  });
});

describe('welcome eligibility and preference', () => {
  it('marks only a successfully initialized empty repository as new, including concurrent starts', async () => {
    const repository = new MemoryDocumentRepository();
    const first = createDocumentWorkspace({ repository, treasury });
    await Promise.all([first.start(), first.start()]);
    expect(first.getState().isNewWorkspace).toBe(true);
    expect(await repository.list()).toHaveLength(1);
    const returning = createDocumentWorkspace({ repository, treasury });
    await returning.start();
    expect(returning.getState().isNewWorkspace).toBe(false);
    first.dispose(); returning.dispose();
  });
  it('keeps editing and export available without showing welcome on storage startup errors', async () => {
    const repository = new MemoryDocumentRepository();
    vi.spyOn(repository, 'getMostRecent').mockRejectedValue(new Error('Unavailable'));
    const workspace = createDocumentWorkspace({ repository, treasury });
    await workspace.start();
    expect(workspace.getState()).toMatchObject({ status: 'ready', isNewWorkspace: false, saveStatus: 'error' });
    expect(await workspace.exportJson()).toContain('nearsheets');
    workspace.dispose();
  });
  it('persists only a preference and retains dismissal in-session when storage fails', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const preference = createWelcomePreference(() => storage);
    expect(preference.isDismissed()).toBe(false);
    preference.dismiss();
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('nearsheets.welcome-dismissed', 'true');
    const unavailable = createWelcomePreference(() => { throw new Error('Storage denied'); });
    expect(unavailable.isDismissed()).toBe(false);
    unavailable.dismiss(); expect(unavailable.isDismissed()).toBe(true);
    expect(createWelcomePreference(() => ({ getItem: () => 'true', setItem: vi.fn() })).isDismissed()).toBe(true);
  });
});
