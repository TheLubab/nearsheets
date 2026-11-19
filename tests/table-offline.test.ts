import { describe, expect, it, vi } from 'vitest';
import { LocaleType, Univer } from '@univerjs/core';
import type { IWorkbookData } from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import '@univerjs/sheets/facade';
import '@univerjs/sheets-formula/facade';
import { createWorkbookSession } from '../src/features/spreadsheet/univer/create-workbook-session';
import { createTableFunctionCatalog } from '../src/features/spreadsheet/univer/table-functions';
import { recalculateTableCells } from '../src/features/spreadsheet/univer/table-recalculation';
import { preflightRows } from '../src/features/table/batch-review';
import { rpcPorts, TableRuntime } from '../src/features/table/runtime';
import { selectionDependencies } from '../src/features/table/selection-dependencies';
import { restoreTableReads, TABLE_RESOURCE } from '../src/features/table/table-snapshot';
import { OneClick } from '../src/integrations/intents/one-click';
import type { WalletController } from '../src/features/wallet/application/wallet-controller';

vi.mock('../src/features/spreadsheet/univer/create-univer-engine', () => ({
  createUniverEngine: vi.fn(),
}));

function openWorkbook(initialWorkbook?: IWorkbookData) {
  const session = createWorkbookSession({
    container: {} as HTMLElement,
    initialWorkbook,
    createEngine: ({ tableRuntime, initialWorkbook }) => {
      const runtime = tableRuntime!;
      const univer = new Univer({ locale: LocaleType.EN_US, locales: { [LocaleType.EN_US]: {} } });
      const api = FUniver.newAPI(univer);
      const catalog = createTableFunctionCatalog(runtime,
        cell => api.getWorkbook(cell.unitId)?.getSheetBySheetId(cell.sheetId)?.getRange(cell.row, cell.column).getFormula() ?? '',
        cells => recalculateTableCells(api, cells),
      );
      univer.registerPlugin(UniverSheetsPlugin);
      univer.registerPlugin(UniverFormulaEnginePlugin, { function: catalog });
      univer.registerPlugin(UniverSheetsFormulaPlugin);
      api.createWorkbook(initialWorkbook ?? {});
      api.getFormula().calculationStart(() => {
        catalog.beginCalculation();
        runtime.bindings.nextCalculation();
      });
      api.getFormula().calculationEnd(state => {
        if (state === 3) catalog.endCalculation();
      });
      return {
        univer,
        univerAPI: api,
        mountElement: { remove() {} } as HTMLElement,
        hasReachedSteadyStage: () => true,
        onSteadyStage: () => ({ dispose() {} }),
        dispose: () => univer.dispose(),
      };
    },
  });
  const book = session.getWorkbook()!;
  const sheet = book.getActiveSheet();
  const cell = (column: number) => ({ unitId: book.getId(), sheetId: sheet.getSheetId(), row: 0, column });
  return { session, sheet, cell, runtime: session.tableRuntime! };
}

describe('saved blockchain data', () => {
  it('reopens a legacy JSON snapshot offline with exact formulas and drafts, then refreshes selected dependencies', async () => {
    const units = '12500000000000001';
    const policy = { proposal_bond: '100', roles: [{ kind: 'Everyone', permissions: ['transfer:AddProposal'] }] };
    const rpcView = async (_network: unknown, _contract: string, method: string) => {
      if (method === 'get_policy') return policy;
      if (method === 'ft_metadata') return { spec: 'ft-1.0.0', name: 'Token', symbol: 'TOK', decimals: 6 };
      if (method === 'ft_balance_of') return units;
      throw new Error('Unexpected fixture request');
    };
    const view = vi.spyOn(rpcPorts, 'view').mockImplementation(rpcView);
    const balance = vi.spyOn(rpcPorts, 'balance').mockResolvedValue('2500000000000000000000001');
    const sign = vi.fn();
    const wallet = {
      getState: () => ({ status: 'connected', network: 'testnet', connection: { accountId: 'signer.testnet' } }),
      signAndSendTransaction: sign,
    } as unknown as WalletController;
    const online = openWorkbook();
    let offline: ReturnType<typeof openWorkbook> | undefined;
    try {
      online.sheet.getRange('A1:F1').setValues([[
        { f: '=NEAR_BALANCE_EXACT("dao.testnet","testnet")' },
        { f: '=FT_BALANCE_EXACT("token.testnet","dao.testnet","testnet")' },
        { f: '=NEAR_BALANCE("dao.testnet","testnet")*2' },
        { f: '=SPUTNIK_TRANSFER("run","dao.testnet","alice.testnet",B1,"token.testnet","testnet")' },
        { f: '=NS_FIELD(D1,"baseUnits")' },
        { f: '=NEAR_VIEW("token.testnet","ft_balance_of","{""account_id"":""dao.testnet""}","testnet")' },
      ]]);
      await vi.waitFor(() => expect(online.sheet.getRange('E1').getRawValue()).toBe(units));
      const revision = online.runtime.operations.get(String(online.sheet.getRange('D1').getRawValue()))!.revision;
      const snapshot: IWorkbookData = JSON.parse(JSON.stringify(online.session.saveSnapshot()));
      const resource = snapshot.resources!.find(item => item.name === TABLE_RESOURCE)!;
      const data = JSON.parse(resource.data);
      const ftKey = JSON.stringify(['testnet', 'token.testnet', 'ft_balance_of', { account_id: 'dao.testnet' }]);
      const [_, ftRead] = data.reads.find(([key]: [string]) => key === ftKey);
      expect(ftRead.rawValue).toBe(units);
      for (const [, read] of data.reads) delete read.rawValue;
      data.reads.push(['malformed key', ftRead]);
      resource.data = JSON.stringify(data);
      online.session.dispose();

      view.mockReset().mockRejectedValue(new TypeError('Offline'));
      balance.mockReset().mockRejectedValue(new TypeError('Offline'));
      offline = openWorkbook(snapshot);
      const { sheet, runtime, session, cell } = offline;
      await session.whenReady();
      await vi.waitFor(() => {
        expect(sheet.getRange('A1').getRawValue()).toBe('2.500000000000000000000001');
        expect(sheet.getRange('B1').getRawValue()).toBe('12500000000.000001');
        expect(sheet.getRange('C1').getRawValue()).toBe(5);
        expect(sheet.getRange('E1').getRawValue()).toBe(units);
        expect(sheet.getRange('F1').getRawValue()).toBe(units);
        expect(runtime.operations.get(String(sheet.getRange('D1').getRawValue()))?.revision).toBe(revision);
      });
      expect(view).not.toHaveBeenCalled();
      expect(balance).not.toHaveBeenCalled();
      expect(runtime.evidence.has('malformed key')).toBe(false);
      expect(runtime.evidence.get(ftKey)).toMatchObject({ saved: true, stale: true, fetchedAt: ftRead.fetchedAt, rawValue: units });

      const draft = () => ({
        address: 'D1', location: cell(3), formula: sheet.getRange('D1').getFormula(),
        value: sheet.getRange('D1').getRawValue(), operation: runtime.operations.get(String(sheet.getRange('D1').getRawValue())),
        problems: [], readKeys: [...selectionDependencies(session, cell(3))], args: [], action: true, submitted: false,
      });
      expect(draft().readKeys).toContain(ftKey);
      const [saved] = await preflightRows([draft()], runtime, wallet);
      expect(saved?.issues.join(' ')).toContain('saved blockchain data');
      expect(view).not.toHaveBeenCalled();
      await expect(runtime.read('testnet', 'dao.testnet', 'get_policy')).rejects.toThrow();
      expect(view).toHaveBeenCalledOnce();

      view.mockImplementation(rpcView);
      const keys = new Set(draft().readKeys);
      const cells = runtime.bindings.all().filter(binding => [...binding.keys].some(key => keys.has(key))).map(binding => binding.cell);
      runtime.refresh(keys);
      recalculateTableCells(session.univerAPI, cells);
      await vi.waitFor(() => {
        expect(runtime.evidence.get(ftKey)).not.toHaveProperty('saved');
        expect(sheet.getRange('E1').getRawValue()).toBe(units);
      });
      expect((await preflightRows([draft()], runtime, wallet))[0]?.included).toBe(true);
      expect(balance).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
    } finally {
      online.session.dispose();
      offline?.session.dispose();
      view.mockRestore();
      balance.mockRestore();
    }
  });

  it('shows an expired saved estimate as history and requests a live quote only on refresh', async () => {
    const input = {
      originAsset: 'nep141:wrap.near', destinationAsset: 'eth-usdc', amount: '1', destinationChain: 'eth',
      recipient: '0x0000000000000000000000000000000000000001', refundTo: 'dao.near', slippageTolerance: 100,
    };
    const expired = '2020-01-01T00:00:00Z';
    const key = JSON.stringify(['intents-estimate', input]);
    const value = {
      origin: { assetId: input.originAsset, decimals: 24, blockchain: 'near', symbol: 'wNEAR' },
      destination: { assetId: input.destinationAsset, decimals: 6, blockchain: 'eth', symbol: 'USDC' },
      expiresAt: expired, expirySource: 'provider',
      response: { correlationId: 'quote', timestamp: expired, quote: {
        amountIn: '1000000000000000000000000', amountOut: '2000000', minAmountOut: '1980000', timeEstimate: 30,
      } },
    };
    const request = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Offline'));
    const runtime = new TableRuntime(undefined, undefined, new OneClick('https://provider.invalid', request));
    runtime.restoreReads(restoreTableReads(JSON.stringify({ reads: [[key, { network: 'mainnet', fetchedAt: expired, value }]] })));
    const args = Object.values(input);
    const context = () => runtime.bindings.begin({ unitId: 'book', sheetId: 'sheet', row: 0, column: 0 }, '=INTENTS_QUOTE(...)', args);
    try {
      expect(await runtime.calculate('INTENTS_QUOTE', args, context())).toEqual(expect.arrayContaining([
        ['Saved estimate · no funding instructions', 'Value', 'Token / unit'],
        ['Expires', expired, 'UTC'],
        ['Input base units', '1000000000000000000000000', 'wNEAR'],
      ]));
      expect(request).not.toHaveBeenCalled();
      runtime.refresh(new Set([key]));
      await expect(runtime.calculate('INTENTS_QUOTE', args, context())).rejects.toThrow();
      expect(request).toHaveBeenCalledOnce();
      expect(runtime.evidence.get(key)).toMatchObject({ saved: true, stale: true, fetchedAt: expired });
    } finally {
      runtime.dispose();
    }
  });
});
