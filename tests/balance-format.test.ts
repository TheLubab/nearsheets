import {describe, expect, it, vi} from 'vitest';
import {FUniver} from '@univerjs/core/facade';
import {Univer, LocaleType, CellValueType, BooleanNumber, IResourceManagerService} from '@univerjs/core';
import {UniverSheetsPlugin, SetNumfmtMutation, SetRangeValuesMutation, SetShrinkToFitCommand, transformCellsToRange} from '@univerjs/sheets';
import {UniverSheetsNumfmtPlugin} from '@univerjs/sheets-numfmt';
import '@univerjs/sheets/facade';
import {getPatternPreview} from '@univerjs/sheets-numfmt';
import {balanceNumberFormat, registerBalanceFormatting} from '../src/features/spreadsheet/univer/balance-format';
import {TableRuntime} from '../src/features/table/runtime';
import {StringValueObject, AsyncObject} from '@univerjs/engine-formula';
import {createTableFunctionCatalog} from '../src/features/spreadsheet/univer/table-functions';

describe('balance presentation', () => {
  it.each(['General','#,##0'])('preserves the manual %s format through refresh and reopen', async pattern => {
    const univer = new Univer({locale:LocaleType.EN_US,locales:{[LocaleType.EN_US]:{}}});
    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverSheetsNumfmtPlugin);
    const api = FUniver.newAPI(univer);
    const book = api.createWorkbook({id:'format-ownership'});
    let calculated = () => {};
    const formatApi = new Proxy(api, {get(target,key) {
      if(key==='getFormula')return ()=>({calculationEnd:(callback:()=>void)=>{calculated=callback;return {dispose(){}};}});
      return Reflect.get(target,key);
    }});
    const registration = registerBalanceFormatting(formatApi,univer.__getInjector().get(IResourceManagerService));
    const range = book.getActiveSheet().getRange('B2');
    range.setValue({f:'=NEAR_BALANCE("alice.testnet","testnet")',v:42,t:CellValueType.NUMBER});
    calculated(); await Promise.resolve();
    expect(range.getNumberFormat()).toBe('#,##0');
    expect(range.getShrinkToFit()).toBe(true);
    expect(range.getFormula()).toContain('NEAR_BALANCE');
    range.setNumberFormat(pattern);
    // Save immediately, before another formula calculation can observe it.
    const snapshot = JSON.parse(JSON.stringify(book.save()));
    calculated(); await Promise.resolve();
    expect(range.getNumberFormat()).toBe(pattern);
    api.disposeUnit(book.getId());
    const reopened = api.createWorkbook(snapshot).getActiveSheet().getRange('B2');
    reopened.setValue({f:'=NEAR_BALANCE("alice.testnet","testnet")',v:12.5,t:CellValueType.NUMBER});
    calculated(); await Promise.resolve();
    expect(reopened.getNumberFormat()).toBe(pattern);
    expect(reopened.getShrinkToFit()).toBe(true);
    registration.dispose(); univer.dispose();
  });

  it('keeps automatic formatting active after reopening', async () => {
    const univer = new Univer({locale:LocaleType.EN_US,locales:{[LocaleType.EN_US]:{}}});
    univer.registerPlugin(UniverSheetsPlugin); univer.registerPlugin(UniverSheetsNumfmtPlugin);
    const api = FUniver.newAPI(univer);
    const book = api.createWorkbook({id:'automatic-format'});
    let calculated = () => {};
    const formatApi = new Proxy(api,{get(target,key) {
      if(key==='getFormula')return ()=>({calculationEnd:(callback:()=>void)=>{calculated=callback;return {dispose(){}};}});
      return Reflect.get(target,key);
    }});
    const registration = registerBalanceFormatting(formatApi,univer.__getInjector().get(IResourceManagerService));
    const range = book.getActiveSheet().getRange('B2');
    range.setValue({f:'=NEAR_BALANCE("alice.testnet","testnet")',v:42,t:CellValueType.NUMBER});
    calculated(); await Promise.resolve();
    expect(range.getShrinkToFit()).toBe(true);
    const snapshot = JSON.parse(JSON.stringify(book.save()));
    api.disposeUnit(book.getId());
    const reopened = api.createWorkbook(snapshot).getActiveSheet().getRange('B2');
    reopened.setValue({f:'=NEAR_BALANCE("alice.testnet","testnet")',v:1e-24,t:CellValueType.NUMBER});
    calculated(); await Promise.resolve();
    expect(reopened.getNumberFormat()).toBe(balanceNumberFormat(1e-24));
    registration.dispose(); univer.dispose();
  });
  it('persists native formatting and formulas through JSON save/reopen', async () => {
    const univer = new Univer({locale:LocaleType.EN_US,locales:{[LocaleType.EN_US]:{}}});
    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverSheetsNumfmtPlugin);
    const api = FUniver.newAPI(univer);
    const book = api.createWorkbook({id:'balance-test'});
    const sheet = book.getActiveSheet();
    sheet.getRange('C7').setValue({f:'=NEAR_BALANCE("alice.testnet","testnet")',v:12.5,t:CellValueType.NUMBER});
    const originalValue = sheet.getRange('C7').getRawValue();
    await api.executeCommand(SetNumfmtMutation.id, transformCellsToRange(book.getId(),sheet.getSheetId(),[{row:6,col:2,pattern:balanceNumberFormat(12.5)}]));
    const snapshot = JSON.parse(JSON.stringify(book.save()));
    expect(sheet.getRange('C7').getRawValue()).toBe(originalValue);
    book.undo();
    expect(sheet.getRange('C7').getFormula()).toBe('');
    book.redo();
    expect(sheet.getRange('C7').getFormula()).toContain('NEAR_BALANCE');
    api.disposeUnit(book.getId());
    const reopened = api.createWorkbook(snapshot).getActiveSheet().getRange('C7');
    expect(reopened.getNumberFormat()).toBe(balanceNumberFormat(12.5));
    expect(reopened.getFormula()).toContain('NEAR_BALANCE');
    expect(reopened.getRawValue()).toBe(originalValue);
    univer.dispose();
  });
  it('uses Univer formatting for grouping, trimmed decimals, whole values and dust', () => {
    for (const [value, display] of [[1234.567891234,'1,234.567891'],[12.5,'12.5'],[42,'42'],[0,'0'],[1e-24,'<0.000001'],[0.000001,'0.000001']] as const) {
      expect(getPatternPreview(balanceNumberFormat(value), value).result).toBe(display);
    }
  });

  it('formats inserted and typed formulas without extra undo commands or overwriting toolbar choices', async () => {
    let cell = {f:'=NEAR_BALANCE("alice.testnet","testnet")',v:42};
    let pattern = '';
    let shrink = false;
    let changed = () => {};
    let calculated = () => {};
    let command = (_event:unknown) => {};
    const listener = {dispose:vi.fn()};
    const executeCommand = vi.fn((id, params) => {
      if (id === SetRangeValuesMutation.id) {
        shrink = (params.cellValue as Array<Array<{s?:{stf?:number}}>>)[19]?.[8]?.s?.stf === BooleanNumber.TRUE;
        return Promise.resolve(true);
      }
      pattern = Object.values(params.refMap as Record<string,{pattern:string}>)[0]!.pattern;
      return Promise.resolve(true);
    });
    const api = {
      Event:{SheetValueChanged:'change',CommandExecuted:'command'},
      addEvent:(event:unknown, callback:()=>void) => {
        if(event==='change')changed = callback;
        if(event==='command')command = callback;
        return listener;
      },
      getFormula:()=>({calculationEnd:(callback:()=>void)=>{calculated=callback;return listener;}}),
      getActiveWorkbook:()=>({getId:()=> 'book',getSheets:()=>[{
        getSheetId:()=> 'arbitrary-sheet',
        getSheet:()=>({getCellMatrix:()=>({forValue:(callback:(r:number,c:number,value:typeof cell)=>void)=>callback(19,8,cell)})}),
        getRange:()=>({getNumberFormat:()=>pattern, getShrinkToFit:()=>shrink}),
      }]}), executeCommand,
    } as unknown as FUniver;
    const registration = registerBalanceFormatting(api);
    await Promise.resolve();
    expect(pattern).toBe('#,##0');
    expect(shrink).toBe(true);
    expect(executeCommand.mock.calls[0]?.[0]).toBe('sheet.mutation.set.numfmt');
    cell.v = 1e-24; calculated(); await Promise.resolve();
    expect(getPatternPreview(pattern,cell.v).result).toBe('<0.000001');
    pattern = 'General'; calculated(); await Promise.resolve();
    cell.v = 1.25; calculated(); await Promise.resolve();
    expect(pattern).toBe('General');
    cell = {f:'',v:0}; changed(); await Promise.resolve();
    cell = {f:'=FT_BALANCE(A1,B1,C1)',v:1.25}; changed(); await Promise.resolve();
    expect(getPatternPreview(pattern,1.25).result).toBe('1.25');
    pattern = '0.00'; calculated(); await Promise.resolve();
    expect(pattern).toBe('0.00');
    shrink = false;
    command({id:SetShrinkToFitCommand.id,params:{unitId:'book',subUnitId:'arbitrary-sheet',range:{startRow:19,endRow:19,startColumn:8,endColumn:8},value:BooleanNumber.FALSE}});
    calculated(); await Promise.resolve();
    expect(shrink).toBe(false);
    registration.dispose();
    expect(listener.dispose).toHaveBeenCalled();
  });

  it('retains exact NEAR and token balances alongside approximate numbers', async () => {
    const runtime = new TableRuntime({balance:async()=> '1000000000000000000000001', view:async(_n,_t,method)=>
      method === 'ft_metadata' ? {spec:'ft-1.0.0',name:'Example',symbol:'TOK',decimals:24} : '1'}, undefined, null);
    expect(await runtime.calculate('NEAR_BALANCE',['alice.testnet','testnet'])).toBe(1);
    expect(await runtime.calculate('FT_BALANCE',['token.testnet','alice.testnet','testnet'])).toBe(1e-24);
    const evidence = [...runtime.evidence.values()].map(read=>read.value);
    expect(evidence).toContainEqual(expect.objectContaining({display:'1.000000000000000000000001',baseUnits:'1000000000000000000000001',symbol:'NEAR'}));
    expect(evidence).toContainEqual(expect.objectContaining({display:'0.000000000000000000000001',baseUnits:'1',symbol:'TOK',decimals:24,asset:'token.testnet'}));
    runtime.dispose();
  });

  it.each(['NEAR_BALANCE_EXACT','FT_BALANCE_EXACT'])('preserves every digit from %s through a transfer draft', async name => {
    const units = '1000000000000000000000001';
    const runtime = new TableRuntime({balance:async()=>units,view:async(_n,_t,method)=> {
      if(method==='get_policy')return {proposal_bond:'100'};
      if(method==='ft_metadata')return {spec:'ft-1.0.0',name:'Token',symbol:'TOK',decimals:24};
      return units;
    }},undefined,null);
    const args = name==='NEAR_BALANCE_EXACT' ? ['alice.testnet','testnet'] : ['token.testnet','alice.testnet','testnet'];
    const Constructor=createTableFunctionCatalog(runtime,()=>name).find(([,registered])=>registered===name)![0];
    const cell=await (new Constructor(name).calculate(...args.map(value=>StringValueObject.create(value))) as AsyncObject).getValue();
    expect(cell.isString()).toBe(true);
    expect(cell.getValue()).toBe('1.000000000000000000000001');
    const label = await runtime.calculate('SPUTNIK_TRANSFER',['exact','dao.testnet','bob.testnet',cell.getValue(),name==='NEAR_BALANCE_EXACT'?'near':'token.testnet','testnet']);
    expect(runtime.operations.get(String(label))?.baseUnits).toBe(units);
    runtime.dispose();
  });
});
