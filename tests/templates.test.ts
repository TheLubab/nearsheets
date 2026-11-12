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
import { OneClick } from '../src/integrations/intents/one-click';
import { createTableFunctionCatalog } from '../src/features/spreadsheet/univer/table-functions';
import type { WorkbookSnapshot } from '../src/features/spreadsheet/model/workbook-snapshot';

const treasury = { network: 'testnet' as const, accountId: null };
function engine(id: TemplateId, snapshot?: WorkbookSnapshot, publicDefaults=false) {
  const balance = vi.fn(async () => '1250000000000000000000000');
  const view = vi.fn(async (_network: string, _account: string, method: string): Promise<unknown> => {
    if (method === 'get_account_staked_balance') return '0';
    if (method === 'get_proposal') return {id:4,status:'InProgress',kind:{Transfer:{}}};
    if (method === 'get_policy') return { proposal_bond: '100' };
    if (method === 'get_proposals') return [{ id: 4, description: 'Mock proposal', status: 'InProgress', proposer: 'author.testnet' }];
    if (method === 'ft_metadata') return { spec: 'ft-1.0.0', name: 'Test token', symbol: 'TOK', decimals: 6 };
    if (method === 'ft_balance_of') return '2000000';
    throw new Error(`Unexpected method: ${method}`);
  });
  // No wallet or submit capability exists in the calculation boundary.
  const provider=new OneClick('https://provider.invalid',async(url,init)=>{
    if(String(url).endsWith('/tokens'))return new Response(JSON.stringify([{assetId:'nep141:wrap.near',decimals:24,blockchain:'near',symbol:'wNEAR'},{assetId:'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',decimals:6,blockchain:'eth',symbol:'USDC'}]));
    const body=JSON.parse(String(init?.body));
    return new Response(JSON.stringify({correlationId:'mock',timestamp:new Date().toISOString(),quote:{amountIn:body.amount,amountOut:'2000000',minAmountOut:'1980000',deadline:'2099-01-01T00:00:00Z',timeEstimate:30}}));
  });
  const runtime = new TableRuntime({ balance, view },undefined,provider);
  const univer = new Univer({ locale: LocaleType.EN_US, locales: { [LocaleType.EN_US]: {} } });
  const api = FUniver.newAPI(univer);
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverFormulaEnginePlugin, { function: createTableFunctionCatalog(runtime,
    cell => api.getWorkbook(cell.unitId)?.getSheetBySheetId(cell.sheetId)?.getRange(cell.row, cell.column).getFormula() ?? '') });
  univer.registerPlugin(UniverSheetsFormulaPlugin);
  const initial=snapshot??getWorkbookTemplate(id).createWorkbook();
  if(!snapshot&&!publicDefaults)for(const data of Object.values(initial.sheets)){
    const reset=(r:number,c:number,v:string)=>{data.cellData![r-1]![c-1]={v,t:1};};
    if(data.name==='Funding')reset(4,2,'');
    if(data.name==='Balances'){reset(4,2,'testnet');reset(5,2,'');reset(6,2,'');for(let r=8;r<=10;r++)reset(r,1,'');}
    if(data.name==='Treasury'){reset(4,2,'');reset(5,2,'testnet');}
    if(data.name==='Proposals'){reset(3,2,'');reset(4,2,'testnet');}
    if(data.name==='Compare quotes')for(let r=9;r<=11;r++)reset(r,2,'');
    if(data.name==='Quote route')reset(3,2,'');
  }
  const book = api.createWorkbook(initial);
  const sheetNames:Record<TemplateId,string>={'getting-started':'Start here','account-balances':'Balances','dao-proposals':'Proposals','contributor-payments':'Payments','invoices-expenses':'Payments','community-budget':'Payments','grants-rewards':'Payments','international-payouts':'International payout','treasury-overview':'Treasury'};
  const sheet = book.getSheetByName(sheetNames[id])!;
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
      const address = template.id === 'getting-started' ? 'B11' : template.id === 'account-balances' ? 'B8' : template.id === 'dao-proposals' ? 'A9' : template.id === 'treasury-overview' ? 'B7' : template.id === 'international-payouts' ? 'B17' : 'E10';
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

  it('compares real stablecoin identifiers with separate USDT and USDC totals using verified metadata',async()=>{
    const f=engine('account-balances',undefined,true);
    const usdt='usdt.tether-token.near',usdc='17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
    try {
      f.view.mockImplementation(async(_network,contract,method)=>{
        if(method==='ft_metadata')return {spec:'ft-1.0.0',name:'Stablecoin',symbol:contract===usdt?'USDT':'USDC',decimals:6};
        if(method==='ft_balance_of')return contract===usdt?'1250000':'2500000';
        throw new Error('Unexpected request');
      });
      expect(f.sheet.getRange('B5').getValue()).toBe(usdt);
      expect(f.sheet.getRange('B6').getValue()).toBe(usdc);
      await vi.waitFor(()=>expect(f.sheet.getRange('C13').getValue()).toBe(3.75));
      await vi.waitFor(()=>expect(f.sheet.getRange('D13').getValue()).toBe(7.5));
      expect(f.sheet.getRange('C7').getValue()).toBe('USDT balance');
      expect(f.sheet.getRange('D7').getValue()).toBe('USDC balance');
      expect(f.view).toHaveBeenCalledWith('mainnet',usdt,'ft_metadata',{});
      expect(f.view).toHaveBeenCalledWith('mainnet',usdc,'ft_metadata',{});
      f.sheet.getRange('B6').setValue('another.near');
      await vi.waitFor(()=>expect(f.sheet.getRange('D7').getValue()).toBe('Token 2 balance'));
    }finally{f.dispose();}
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

  it.each(['invoices-expenses', 'community-budget', 'grants-rewards'] as const)('%s prepares exact treasury proposals from its rows', async id => {
    const f = engine(id);
    try {
      f.sheet.getRange('B3').setValue('dao.testnet');
      f.sheet.getRange('A10').setValue('payment-unique-1');
      f.sheet.getRange('B10').setValue('alice.testnet');
      f.sheet.getRange('C10').setValue({ v: '1.000000000000000000000001', t: 1 });
      f.sheet.getRange('G10').setValue('A descriptive note');
      await vi.waitFor(() => expect(f.sheet.getRange('F10').getValue()).toBe('Draft · not submitted'));
      expect(f.runtime.operations.get(String(f.sheet.getRange('E10').getValue()))).toMatchObject({ amount:'1.000000000000000000000001', source:'dao.testnet', recipient:'alice.testnet' });
      expect(f.runtime.executions).toEqual({});
    } finally { f.dispose(); }
  });

  it('shows treasury balance and proposals while keeping the proposal spill area free', async () => {
    const f = engine('treasury-overview');
    try {
      f.sheet.getRange('B4').setValue('dao.testnet');
      await vi.waitFor(() => expect(f.sheet.getRange('B7').getValue()).toBe(1.25));
      await vi.waitFor(() => expect(f.sheet.getRange('D14').getValue()).toBe('author.testnet'));
      expect([...f.runtime.evidence.values()].some(read => (read.value as {display?:string})?.display==='1.25')).toBe(true);
    } finally { f.dispose(); }
  });

  it('estimates an international payout without allocating a deposit or signing', async () => {
    const f = engine('international-payouts');
    const requests: Array<Record<string, unknown>> = [];
    const request = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith('/tokens')) return new Response(JSON.stringify([
        {assetId:'nep141:token.near',decimals:6,blockchain:'near',symbol:'TOK'},
        {assetId:'eth-usdc',decimals:6,blockchain:'eth',symbol:'USDC'},
      ]));
      const body = JSON.parse(String(init?.body)) as Record<string,unknown>; requests.push(body);
      if(body.amount==='9000000')return new Response('invalid quote',{status:400});
      return new Response(JSON.stringify({correlationId:'quote',timestamp:'2026-01-01T00:00:00Z',quote:{amountIn:String(body.amount),amountOut:String(BigInt(String(body.amount))*2n),minAmountOut:'1980000',deadline:'2099-01-01T00:00:00Z',timeEstimate:30}}));
    });
    try {
      Object.assign(f.runtime,{intents:new OneClick('https://provider.invalid',request)});
      for (const [address,value] of Object.entries({B3:'dao.near',B4:'payout-1',B5:'nep141:token.near',B6:'eth-usdc',B7:'eth',B8:'0x0000000000000000000000000000000000000001',B9:'1'})) f.sheet.getRange(address).setValue(value);
      await vi.waitFor(() => expect(f.sheet.getRange('B18').getValue()).toBe('Draft · not submitted'));
      await vi.waitFor(() => expect(f.sheet.getRange('B23').getValue()).toBe('1'));
      await vi.waitFor(()=>expect(f.book.getSheetByName('Payout tracking')!.getRange('A8').getValue()).toBe('Not submitted'));
      const route=f.book.getSheetByName('Quote route')!;
      for(const [address,value] of Object.entries({B3:'dao.near',B5:'nep141:token.near',B6:'eth-usdc',B7:'eth',B8:'0x0000000000000000000000000000000000000001'}))route.getRange(address).setValue(value);
      const comparison=f.book.getSheetByName('Compare quotes')!;
      comparison.getRange('B9').setValue({v:'2',t:1});
      await vi.waitFor(()=>expect(comparison.getRange('C9').getValue()).toBe('4'));
      expect(comparison.getRange('F9').getValue()).toBe(2);
      comparison.getRange('B9').setValue({v:'9',t:1});
      await vi.waitFor(()=>expect(String(comparison.getRange('C9').getValue())).toMatch(/^#/));
      expect(requests.length).toBeGreaterThan(0);
      expect(requests.every(body => body.dry === true)).toBe(true);
      expect(f.runtime.executions).toEqual({});
    } finally { f.dispose(); }
  });


  it.each(WORKBOOK_TEMPLATES.filter(t=>t.id!=='getting-started'))('$name opens on real read-only blockchain formulas',async template=>{
    const f=engine(template.id,undefined,true);try {
      expect(f.book.getSheetByName('Example')).toBeNull();
      const first=f.book.getActiveSheet();
      if(template.id==='international-payouts')await vi.waitFor(()=>expect(first.getRange('C9').getValue()).toBe('2'));
      else await vi.waitFor(()=>expect(f.balance.mock.calls.length+f.view.mock.calls.length).toBeGreaterThan(0));
      expect(f.runtime.operations.size).toBe(0);expect(f.runtime.executions).toEqual({});
    }finally{f.dispose();}
  });

  it('links a pay-run recipient while leaving the exact action amount for approval',async()=>{
    const f=engine('contributor-payments');try{
      const plan=f.book.getSheetByName('Pay run')!;
      plan.getRange('A9').setValue('Design');plan.getRange('B9').setValue(10);plan.getRange('C9').setValue(20);plan.getRange('E9').setValue('alice.testnet');
      await vi.waitFor(()=>expect(plan.getRange('D9').getValue()).toBe(200));
      await vi.waitFor(()=>expect(f.sheet.getRange('B10').getValue()).toBe('alice.testnet'));
      expect(f.sheet.getRange('C10').getValue()).toBe('');expect(f.runtime.operations.size).toBe(0);
    }finally{f.dispose();}
  });

  it('keeps balance precision in Inspect evidence without duplicate balance columns',async()=>{
    const f=engine('account-balances');
    try {
      f.balance.mockResolvedValue('1250000000000000000000001');
      f.sheet.getRange('A8').setValue('alice.testnet');
      await vi.waitFor(()=>expect(f.sheet.getRange('B8').getValue()).toBe(1.25));
      expect(f.sheet.getRange('E7').getValue()).toBe('NEAR share (%)');
      expect(f.sheet.getRange('F7').getValue()).toBeNull();
      expect([...f.runtime.evidence.values()].some(read=>(read.value as {display?:string})?.display==='1.250000000000000000000001')).toBe(true);
    }finally{f.dispose();}
  });

  it.each(['contributor-payments','invoices-expenses','community-budget','grants-rewards'] as const)('%s uses an Amount input with text precision preserved',id=>{
    const book=getWorkbookTemplate(id).createWorkbook();
    const payment=Object.values(book.sheets).find(sheet=>sheet.name==='Payments')!;
    expect(payment.cellData?.[8]?.[2]?.v).toBe('Amount');
    expect(payment.cellData?.[9]?.[2]).toMatchObject({t:1,s:{n:{pattern:'@'}}});
    const funding=Object.values(book.sheets).find(sheet=>sheet.name==='Funding')!;
    expect(funding.cellData?.[7]?.[2]).toBeUndefined();
    expect(funding.cellData?.[8]?.[2]).toBeUndefined();
  });

  it('builds staking and voting proposals from explicit live inputs',async()=>{
    const stake=engine('treasury-overview'),vote=engine('dao-proposals');try{
      stake.sheet.getRange('B4').setValue('dao.testnet');
      const pool=stake.book.getSheetByName('Staking')!;pool.getRange('B4').setValue('pool.testnet');pool.getRange('B5').setValue({v:'1.000000000000000000000001',t:1});pool.getRange('B6').setValue('stake-unique');
      await vi.waitFor(()=>expect(pool.getRange('B10').getValue()).toBe('Draft · not submitted'));
      expect(stake.runtime.operations.get(String(pool.getRange('B9').getValue()))?.baseUnits).toBe('1000000000000000000000001');
      vote.sheet.getRange('B3').setValue('dao.testnet');const decisions=vote.book.getSheetByName('Decisions')!;
      decisions.getRange('A9').setValue('vote-unique');decisions.getRange('B9').setValue(4);decisions.getRange('C9').setValue('VoteReject');
      await vi.waitFor(()=>expect(decisions.getRange('E9').getValue()).toBe('Draft · not submitted'));
      expect(vote.runtime.operations.get(String(decisions.getRange('D9').getValue()))?.kind).toBe('SPUTNIK_VOTE');
    }finally{stake.dispose();vote.dispose();}
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
      const amount = saved.sheets[second.sheet.getSheetId()]!.cellData![9]![2]!;
      expect(typeof amount.s === 'string' ? saved.styles[amount.s] : amount.s).toMatchObject({ n: { pattern: '@' }, bg: { rgb: '#F4F6D8' } });
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
