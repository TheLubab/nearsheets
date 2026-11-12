import { referencedProblems } from '../src/features/table/referenced-problems';
import {describe,it,expect,vi} from 'vitest';
import {Univer,LocaleType} from '@univerjs/core';
import {FUniver} from '@univerjs/core/facade';
import {UniverSheetsPlugin} from '@univerjs/sheets';
import {UniverSheetsFormulaPlugin} from '@univerjs/sheets-formula';
import {UniverFormulaEnginePlugin, ErrorType, ErrorValueObject, StringValueObject, AsyncObject} from '@univerjs/engine-formula';
import {AccountDoesNotExistError} from 'near-api-js/rpc-errors';
import '@univerjs/sheets/facade';
import '@univerjs/sheets-formula/facade';
import {TableRuntime} from '../src/features/table/runtime';
import {createTableFunctionCatalog} from '../src/features/spreadsheet/univer/table-functions';
import {registerCellErrorAlerts} from '../src/features/spreadsheet/univer/cell-error-alerts';
import {toProblem} from '../src/features/table/problems';
import type {CellAlertManagerService} from '@univerjs/preset-sheets-core';
import {Subject} from 'rxjs';
import {createCustomFunctionCatalog} from '../src/features/treasury/formulas/custom-functions';
import {withHelperDiagnostics} from '../src/features/spreadsheet/univer/helper-diagnostics';

function fixture() {
  const balance=vi.fn(async (_network:string,account:string)=>{
    if(account==='missing.near')throw new AccountDoesNotExistError(account,'block',1);
    if(account==='offline.near')throw new TypeError('Failed to fetch');
    return '1250000000000000000000001';
  });
  const runtime=new TableRuntime({balance,view:async()=>({})});
  const univer=new Univer({locale:LocaleType.EN_US,locales:{[LocaleType.EN_US]:{}}});
  const api=FUniver.newAPI(univer);
  const readFormula=(cell:import('../src/features/table/cell-diagnostics').CellLocation)=>api.getWorkbook(cell.unitId)?.getSheetBySheetId(cell.sheetId)?.getRange(cell.row,cell.column).getFormula() ?? '';
  const functions=[...createTableFunctionCatalog(runtime,readFormula),...withHelperDiagnostics(createCustomFunctionCatalog().functions,runtime,readFormula)];
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverFormulaEnginePlugin,{function:functions});
  univer.registerPlugin(UniverSheetsFormulaPlugin);
  const book=api.createWorkbook({id:'errors'}),sheet=book.getActiveSheet();
  const start=api.getFormula().calculationStart(()=>runtime.diagnostics.nextCalculation());
  const location=(row:number,column=0)=>({unitId:book.getId(),sheetId:sheet.getSheetId(),row,column});
  const diagnostics=(address:string)=>{const cell=sheet.getRange(address);return runtime.diagnostics.get(location(cell.getRow(),cell.getColumn()),cell.getFormula(),cell.getRawValue());};
  return {univer,api,book,sheet,runtime,balance,functions,location,diagnostics,dispose(){start.dispose();runtime.dispose();univer.dispose();}};
}

describe('cell-specific blockchain errors through the real formula engine',()=>{
  it('explains a missing account, propagates an error, supports IFERROR, and clears after correction',async()=>{
    const f=fixture();
    try {
      f.sheet.getRange('A1').setValue('missing.near');
      f.sheet.getRange('B1').setValue({f:'=NEAR_BALANCE(A1,"mainnet")'});
      f.sheet.getRange('C1').setValue({f:'=B1+1'});
      f.sheet.getRange('D1').setValue({f:'=IFERROR(NEAR_BALANCE(A1,"mainnet"),"check account")'});
      await vi.waitFor(()=>expect(f.sheet.getRange('B1').getRawValue()).toBe('#N/A'));
      await vi.waitFor(()=>expect(f.sheet.getRange('C1').getRawValue()).toBe('#N/A'));
      await vi.waitFor(()=>expect(f.sheet.getRange('D1').getRawValue()).toBe('check account'));
      expect(f.diagnostics('B1')[0]).toMatchObject({code:'account-not-found',message:'Account “missing.near” was not found on mainnet.'});
      expect(f.diagnostics('D1')).toEqual([]);
      f.sheet.getRange('A1').setValue('exists.near');
      await vi.waitFor(()=>expect(f.sheet.getRange('B1').getRawValue()).toBe(1.25));
      expect(f.diagnostics('B1')).toEqual([]);
    } finally {f.dispose();}
  });


  it('shows the originating failure on a cross-sheet quote comparison popup and clears after correction',async()=>{
    const f=fixture();let registration:ReturnType<typeof registerCellErrorAlerts>|undefined;
    try {
      const details=f.book.create('Quote details',100,12),route=f.book.create('Quote route',100,12);
      for(const row of [3,5,6,7,8,10])route.getRange('B'+row).setValue('configured');
      f.sheet.getRange('B9').setValue('1');
      details.getRange('A3').setValue({f:'=NEAR_BALANCE("offline.near","mainnet")'});
      f.sheet.getRange('C9').setValue({f:`=IF(OR(B9="",'Quote route'!B3="",'Quote route'!B5="",'Quote route'!B6="",'Quote route'!B7="",'Quote route'!B8="",'Quote route'!B10=""),"",IF('Quote details'!A3="Estimate · no funding instructions",'Quote details'!B5,'Quote details'!A3))`});
      await vi.waitFor(()=>expect(f.sheet.getRange('C9').getRawValue()).toBe('#CONNECT!'));
      const location=f.location(8,2),range=f.sheet.getRange('C9');
      expect(referencedProblems(f.api,f.runtime,location,range.getFormula(),range.getRawValue())[0]).toMatchObject({code:'connection-failed'});
      const updates=new Subject<void>(),currentAlert=new Map();
      const showAlert=vi.fn(alert=>{currentAlert.set(alert.key,{alert});updates.next();});
      registration=registerCellErrorAlerts(f.api,{currentAlert,currentAlert$:updates,showAlert} as unknown as CellAlertManagerService,f.runtime);
      const key='SHEET_FORMULA_ALERT:'+f.book.getId();
      showAlert({key,location:{unitId:f.book.getId(),subUnitId:f.sheet.getSheetId(),row:8,col:2},title:'Error',message:'Generic'});
      expect(currentAlert.get(key).alert.message).toContain('Source: Quote details!A3');
      expect(currentAlert.get(key).alert.message).toContain('offline.near');
      expect(referencedProblems(f.api,f.runtime,location,range.getFormula(),'Handled')).toEqual([]);
      details.getRange('A3').setValue(7);
      await vi.waitFor(()=>expect(range.getRawValue()).toBe(7));
      expect(referencedProblems(f.api,f.runtime,location,range.getFormula(),range.getRawValue())).toEqual([]);
    }finally{registration?.dispose();f.dispose();}
  });

  it('distinguishes connection and input errors and preserves exact decimal text',async()=>{
    const f=fixture();
    try {
      for(const [address,formula] of [
        ['A1','=NEAR_BALANCE("offline.near","mainnet")'],
        ['A2','=NEAR_BALANCE("bad account","mainnet")'],
        ['A3','=NEAR_BALANCE_EXACT("exists.near","mainnet")'],
        ['A4','=NEAR_BALANCE("exists.near")'],
        ['A5','=NEAR_VIEW("exists.near","method","[]","mainnet")'],
        ['A6','=NEAR_ACCOUNT("bad account")'],
      ])f.sheet.getRange(address!).setValue({f:formula});
      await vi.waitFor(()=>expect(f.sheet.getRange('A1').getRawValue()).toBe('#CONNECT!'));
      await vi.waitFor(()=>expect(f.sheet.getRange('A2').getRawValue()).toBe('#VALUE!'));
      await vi.waitFor(()=>expect(f.sheet.getRange('A3').getRawValue()).toBe('1.250000000000000000000001'));
      await vi.waitFor(()=>expect(f.sheet.getRange('A4').getRawValue()).toBe('#VALUE!'));
      await vi.waitFor(()=>expect(f.sheet.getRange('A5').getRawValue()).toBe('#VALUE!'));
      expect(f.diagnostics('A1')[0]?.code).toBe('connection-failed');
      expect(f.diagnostics('A4')[0]?.message).toMatch(/argument count/);
      expect(f.diagnostics('A5')[0]?.message).toMatch(/JSON object/);
      await vi.waitFor(()=>expect(f.sheet.getRange('A6').getRawValue()).toBe('#VALUE!'));
      expect(f.diagnostics('A6')[0]?.recovery).toMatch(/NEAR account ID/);
      f.sheet.getRange('A1').setValue('removed');
      expect(f.diagnostics('A1')).toEqual([]);
    } finally {f.dispose();}
  });

  it('keeps identical failed formulas independent across cells and sheets',async()=>{
    const f=fixture();
    try {
      const other=f.book.create('Other',100,26);
      const formula='=NEAR_BALANCE("missing.near","mainnet")';
      f.sheet.getRange('A1').setValue({f:formula});
      f.sheet.getRange('A2').setValue({f:formula});
      other.getRange('A1').setValue({f:formula});
      await vi.waitFor(()=>expect(other.getRange('A1').getRawValue()).toBe('#N/A'));
      await vi.waitFor(()=>expect(f.sheet.getRange('A2').getRawValue()).toBe('#N/A'));
      f.sheet.getRange('A1').setValue({f:'=NEAR_BALANCE("exists.near","mainnet")'});
      await vi.waitFor(()=>expect(f.sheet.getRange('A1').getRawValue()).toBe(1.25));
      expect(f.diagnostics('A1')).toEqual([]);
      expect(f.diagnostics('A2')[0]?.code).toBe('account-not-found');
      expect(f.runtime.diagnostics.get({...f.location(0),sheetId:other.getSheetId()},formula,'#N/A')[0]?.code).toBe('account-not-found');
    }finally{f.dispose();}
  });

  it('preserves exact text in spilled read results through the native function boundary',async()=>{
    const f=fixture();
    try {
      f.runtime.ports.view=async()=>[{amount:'1000000000000000000000001',identifier:'00123',literal:'a"b'}];
      f.sheet.getRange('A1').setValue({f:'=NEAR_VIEW("exists.near","records","{}","mainnet")'});
      // Spill children live in Univer's array-formula layer, outside the raw
      // worksheet matrix. getValue includes that layer; these cells are text.
      await vi.waitFor(()=>expect(f.sheet.getRange('A2').getValue()).toBe('1000000000000000000000001'));
      expect(f.sheet.getRange('B2').getValue()).toBe('00123');
      expect(f.sheet.getRange('C2').getValue()).toBe('a"b');
    }finally{f.dispose();}
  });

  it('ignores a delayed failure after the formula changes, and after refresh',async()=>{
    const f=fixture();
    try {
      let reject!:(cause:unknown)=>void;
      f.balance.mockImplementation(()=>new Promise((_,fail)=>{reject=fail;}));
      const formula='=NEAR_BALANCE("old.near","mainnet")';
      f.sheet.getRange('A1').setValue({f:formula});
      // Invoke the same class the engine uses while holding a request in flight.
      const Constructor=f.functions.find(([,name])=>name==='NEAR_BALANCE')![0];
      const fn=new Constructor('NEAR_BALANCE');
      fn.setRefInfo(f.book.getId(),f.sheet.getSheetId(),0,0);
      const result=fn.calculate(StringValueObject.create('old.near'),StringValueObject.create('mainnet'));
      f.sheet.getRange('A1').setValue(7);
      f.runtime.refresh();reject(new AccountDoesNotExistError('old.near','block',1));
      await (result as AsyncObject).getValue();
      expect(f.runtime.diagnostics.get(f.location(0),formula,'#N/A')).toEqual([]);
    } finally {f.dispose();}
  });
});

describe('native cell alert enrichment',()=>{
  it('replaces the generic popup at the matching cell and preserves native dismissal',()=>{
    const updates=new Subject<void>();
    const currentAlert=new Map();
    const showAlert=vi.fn(alert=>{currentAlert.set(alert.key,{alert});updates.next();});
    const alerts={currentAlert,currentAlert$:updates,showAlert} as unknown as CellAlertManagerService;
    const runtime=new TableRuntime({balance:async()=>'',view:async()=>null});
    const location={unitId:'book',sheetId:'sheet',row:2,column:4};
    const formula='=NEAR_BALANCE("missing.near","mainnet")';
    const finish=runtime.diagnostics.begin(location,formula,'balance');
    finish(toProblem(new Error('Specific failure')));
    const range={getFormula:()=>formula,getRawValue:()=>ErrorType.VALUE};
    const api={getWorkbook:()=>({getSheetBySheetId:()=>({getRange:()=>range})})} as unknown as FUniver;
    const subscription=registerCellErrorAlerts(api,alerts,runtime);
    const key='SHEET_FORMULA_ALERT:book';
    showAlert({key,location:{unitId:'book',subUnitId:'sheet',row:2,col:4},title:'Error',message:'Error in value'});
    expect(currentAlert.get(key).alert.message).toMatch(/Specific failure/);
    expect(showAlert).toHaveBeenCalledTimes(2);
    currentAlert.clear();updates.next();
    expect(currentAlert.size).toBe(0);
    subscription.dispose();runtime.dispose();
  });


  it('opens a cell popup when Univer creates no native alert, and removes it on edit, correction and disposal',async()=>{
    const runtime=new TableRuntime({balance:async()=>'',view:async()=>null});
    const updates=new Subject<void>(),editorUpdates=new Subject<void>(),currentAlert=new Map();
    const showAlert=vi.fn(alert=>{currentAlert.set(alert.key,{alert});updates.next();});
    const removeAlert=vi.fn(key=>{currentAlert.delete(key);updates.next();});
    const location={unitId:'book',sheetId:'sheet',row:0,column:0};
    const formula='=NEAR_BALANCE("offline.near","mainnet")';let value:unknown='#CONNECT!',isEditing=false;
    const problem={code:'service-failed',title:'Intents request failed',message:'Intents returned HTTP 429.',recovery:'Try again later.',details:'GET https://example.invalid/v0/tokens',cellError:'#CONNECT!' as const};
    runtime.diagnostics.begin(location,formula,'request')(problem);
    let selectionChanged=()=>{};
    const cell={getFormula:()=>formula,getRawValue:()=>value,getValue:()=>value,getSheetId:()=> 'sheet',getRow:()=>0,getColumn:()=>0};
    const book={getId:()=> 'book',getActiveCell:()=>cell,onSelectionChange:(callback:()=>void)=>{selectionChanged=callback;return {dispose:vi.fn()};},onCommandExecuted:()=>({dispose:vi.fn()}),getSheetBySheetId:()=>({getRange:()=>cell})};
    const api={getActiveWorkbook:()=>book,getWorkbook:()=>book} as unknown as FUniver;
    const registration=registerCellErrorAlerts(api,{currentAlert,currentAlert$:updates,showAlert,removeAlert} as unknown as CellAlertManagerService,runtime,{isVisible:()=>({visible:isEditing}),visible$:editorUpdates});
    await Promise.resolve();
    const key='nearsheets.blockchain-error:book';
    expect(currentAlert.get(key).alert.message).toContain('HTTP 429');
    expect(currentAlert.get(key).alert.message).toContain('GET https://example.invalid/v0/tokens');
    isEditing=true;editorUpdates.next();await Promise.resolve();expect(currentAlert.has(key)).toBe(false);
    isEditing=false;selectionChanged();await Promise.resolve();expect(currentAlert.has(key)).toBe(true);
    value=1;selectionChanged();await Promise.resolve();expect(currentAlert.has(key)).toBe(false);
    value='#CONNECT!';selectionChanged();await Promise.resolve();expect(currentAlert.has(key)).toBe(true);
    registration.dispose();expect(currentAlert.has(key)).toBe(false);
    const count=showAlert.mock.calls.length;selectionChanged();await Promise.resolve();expect(showAlert).toHaveBeenCalledTimes(count);
    runtime.dispose();
  });

  it('does not turn a generic RPC failure into an account-not-found claim',async()=>{
    const runtime=new TableRuntime({balance:async()=>{throw new Error('UNKNOWN_ACCOUNT mentioned in unrelated response');},view:async()=>null});
    try {
      await expect(runtime.calculate('NEAR_BALANCE',['alice.near','mainnet'])).rejects.toMatchObject({problem:{code:'read-failed'}});
    }finally{runtime.dispose();}
    expect(ErrorValueObject.create(ErrorType.VALUE).isError()).toBe(true);
  });
});
