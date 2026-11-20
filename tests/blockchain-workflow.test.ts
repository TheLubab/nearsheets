import {describe,it,expect,vi} from 'vitest';
import {FUNCTION_REGISTRY,getFunction,searchFunctions,availability,rememberFunction,recentFunctions} from '../src/features/table/function-registry';
import {parseFunction,decodeArgument,encodeArgument,singleCellReference,parseCellReference} from '../src/features/table/formula-editor';
import {defaultArgument} from '../src/features/table/FunctionArguments';
import {TableRuntime} from '../src/features/table/runtime';
import type {Operation,TablePorts} from '../src/features/table/runtime';
import {preflightRows,includeRow,groupedAmounts,outcomeLabel,signingLabel} from '../src/features/table/batch-review';
import {executePlan,reviewPlan} from '../src/features/table/execution';
import type {ExecutionJournal} from '../src/features/table/execution';
import type {SelectedCell} from '../src/features/table/selection';
import type {WalletController} from '../src/features/wallet/application/wallet-controller';
import {WalletCancelledError} from '../src/integrations/wallet/gateway';
const location={unitId:'book',sheetId:'sheet',row:0,column:0};
const policy={proposal_bond:'100',roles:[{kind:{Group:['signer.testnet']},permissions:['*:AddProposal','*:VoteApprove']}]};
function fixture() {
 const view=vi.fn<TablePorts['view']>(async(_n,_c,method)=>method==='get_policy'?policy:method==='ft_metadata'?{spec:'ft-1.0.0',name:'Token',symbol:'TOK',decimals:6}:{});
 const balance=vi.fn(async()=> '1000000000000000000000000');const runtime=new TableRuntime({view,balance},undefined,null);
 const sign=vi.fn(async()=>({status:{SuccessValue:''},transaction:{hash:'hash'}}));
 const wallet={getState:()=>({status:'connected',network:'testnet',connection:{accountId:'signer.testnet'}}),signAndSendTransaction:sign} as unknown as WalletController;
 const op=async(reference:string)=>runtime.operations.get(String(await runtime.calculate('SPUTNIK_TRANSFER',[reference,'dao.testnet','alice.testnet','1.000001','token.testnet','testnet'])))!;
 return {runtime,view,balance,sign,wallet,op};
}
const selected=(op:Operation|undefined,row:number):SelectedCell=>({address:'A'+(row+1),location:{...location,row},formula:'=SPUTNIK_TRANSFER(...)',value:'Draft',operation:op,problems:[],readKeys:[],args:[],action:true,submitted:false});
describe('workflow registry and formula editing',()=>{
 it('covers the existing 16 signatures with one discoverable workflow entry per task',()=>{
  expect(FUNCTION_REGISTRY).toHaveLength(16);expect(new Set(FUNCTION_REGISTRY.map(f=>f.name)).size).toBe(16);
  expect(searchFunctions('Read data','').map(f=>f.title)).toEqual(expect.arrayContaining(['NEAR balance','Token balance','DAO proposals','Swap estimate','Contract data']));
  expect(searchFunctions('Read data','verified')).toHaveLength(1);
  expect(searchFunctions('Read data','FT_BALANCE_EXACT')[0]?.name).toBe('FT_BALANCE');
  expect(searchFunctions('Prepare action','').length).toBe(5);expect(searchFunctions('Track results','').length).toBe(4);
  for(const f of FUNCTION_REGISTRY){expect(parseFunction(f.example)?.args.length).toBe(f.arguments.length);expect(f.output).toBeTruthy();}
  expect(availability(getFunction('INTENTS_SWAP')!,false)).toMatch(/provider/);
 });
 it('round-trips nested calls, JSON commas and quotes, cross-sheet absolute references',()=>{
  const json=JSON.stringify({message:'a,b "quote"',array:[1,2]});
  const args=['"id"',"'Other sheet'!$A$1",'"app.near"','"method"','"'+json.replaceAll('"','""')+'"','IF(A1>0,"50000000000000","60000000000000")','"0"','"mainnet"'];
  const formula='=SPUTNIK_CALL('+args.join(',')+')';const parsed=parseFunction(formula)!;
  expect(parsed.args).toEqual(args);
  expect('='+parsed.name+'('+parsed.args.map((a,i)=>encodeArgument(decodeArgument(a,getFunction(parsed.name)!.arguments[i]!),getFunction(parsed.name)!.arguments[i]!)).join(',')+')').toBe(formula);
  expect(parseFunction('=IFERROR(NEAR_BALANCE("alice.near","mainnet"),0)')).toBeNull();
  expect(parseFunction('=NEAR_BALANCE("alice.near","mainnet")+1')).toBeNull();
 });
 it('converts displayed units exactly and preserves base-unit expressions',()=>{
  const gas=getFunction('SPUTNIK_CALL')!.arguments[5]!,slippage=getFunction('INTENTS_SWAP')!.arguments[8]!;
  expect(encodeArgument('50.000000000001',gas)).toBe('"50000000000001"');expect(encodeArgument('1.25',slippage)).toBe('125');
  expect(()=>encodeArgument('1.001',slippage)).toThrow(/decimal/);expect(()=>encodeArgument('251',gas)).toThrow(/250/);
  expect(encodeArgument('=A1*100',gas)).toBe('A1*100');
  expect(defaultArgument(getFunction('SPUTNIK_TRANSFER')!.arguments[3]!)).toBe('');
  expect(defaultArgument(getFunction('SPUTNIK_TRANSFER')!.arguments[0]!)).not.toBe(defaultArgument(getFunction('SPUTNIK_TRANSFER')!.arguments[0]!));
 });
 it('builds quoted cross-sheet references and rejects scalar ranges',()=>{
  const reference=singleCellReference("Other's sheet",{startRow:2,endRow:2,startColumn:1,endColumn:1},true,true);
  expect(reference).toBe("'Other''s sheet'!$B$3");expect(parseCellReference('='+reference)?.sheetName).toBe("Other's sheet");
  expect(()=>singleCellReference('Sheet',{startRow:0,endRow:1,startColumn:0,endColumn:0},false,false)).toThrow(/one cell/);
 });
 it('stores only up to five recent function IDs per category and tolerates storage failure',()=>{
  let value='[]';const storage={getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;}};
  FUNCTION_REGISTRY.forEach(f=>rememberFunction(f.name,storage));rememberFunction('NEAR_BALANCE',storage);
  expect(recentFunctions('Read data',storage)).toHaveLength(5);expect(recentFunctions('Read data',storage)[0]).toBe('NEAR_BALANCE');
  expect(JSON.parse(value).every((id:unknown)=>typeof id==='string'&&getFunction(id))).toBe(true);
  expect(()=>rememberFunction('NEAR_BALANCE',{getItem:()=>{throw new Error('blocked');},setItem:vi.fn()})).not.toThrow();
 });
});
describe('read bindings and selective refresh',()=>{
 it('invalidates selected dependencies only, preserves unrelated drafts and last-success freshness',async()=>{
  const f=fixture();try{
   const operation=await f.op('one');const a=f.runtime.bindings.begin(location,'=NEAR_BALANCE(...)',[]);
   await f.runtime.calculate('NEAR_BALANCE',['alice.testnet','testnet'],a);
   await f.runtime.calculate('NEAR_BALANCE',['other.testnet','testnet']);
   const read=f.runtime.evidence.get([...a.keys][0]!)!,time=read.fetchedAt;
   f.runtime.refresh(a.keys);expect(read.stale).toBe(true);expect(read.fetchedAt).toBe(time);expect([...f.runtime.operations.values()]).toContain(operation);
   await f.runtime.calculate('NEAR_BALANCE',['other.testnet','testnet']);expect(f.balance).toHaveBeenCalledTimes(2);
   await f.runtime.calculate('NEAR_BALANCE',['alice.testnet','testnet']);expect(f.balance).toHaveBeenCalledTimes(3);
  }finally{f.runtime.dispose();}
 });
 it('retains all nested calls at an anchor and clears removed formulas',async()=>{
  const f=fixture();try{
   const a=f.runtime.bindings.begin(location,'=NEAR_BALANCE(...)+NEAR_BALANCE(...)',['alice'],'NEAR_BALANCE');
   const b=f.runtime.bindings.begin(location,a.formula,['bob'],'NEAR_BALANCE');
   await Promise.all([f.runtime.calculate('NEAR_BALANCE',['alice.testnet','testnet'],a),f.runtime.calculate('NEAR_BALANCE',['bob.testnet','testnet'],b)]);
   expect(f.runtime.bindings.forCell(location)).toHaveLength(2);f.runtime.bindings.prune(()=> '');expect(f.runtime.bindings.forCell(location)).toHaveLength(0);
  }finally{f.runtime.dispose();}
 });
 it('does not accept stale asynchronous reads or publish them as fresh evidence',async()=>{
  const f=fixture();try{
   let resolve!:(value:string)=>void;f.balance.mockImplementation(()=>new Promise(done=>{resolve=done;}));
   const context=f.runtime.bindings.begin(location,'=NEAR_BALANCE(...)',[]);const pending=f.runtime.calculate('NEAR_BALANCE',['alice.testnet','testnet'],context);
   f.runtime.refresh(context.keys);resolve('2000000000000000000000000');await expect(pending).rejects.toThrow();expect(f.runtime.evidence.size).toBe(0);
  }finally{f.runtime.dispose();}
 });
 it('binds spilled output cells to their read anchor',async()=>{
  const f=fixture();try{
   f.view.mockResolvedValue([{x:1,y:2}]);const context=f.runtime.bindings.begin(location,'=NEAR_VIEW(...)',[]);await f.runtime.calculate('NEAR_VIEW',['app.testnet','read','{}','testnet'],context);
   expect(f.runtime.bindings.forCell({...location,row:1,column:1})[0]?.keys.size).toBe(1);expect(f.runtime.bindings.forCell({...location,row:2})).toEqual([]);
  }finally{f.runtime.dispose();}
 });
});
describe('explicit batch review and sequential outcomes',()=>{
 it('uses the exact Sputnik delegation threshold and checks it again before signing',async()=>{
  const f=fixture();
  try {
   const minimum = '9007199254740993';
   let weight: unknown = '9007199254740992';
   const memberPolicy = {proposal_bond:'100',roles:[{kind:{Member:minimum},permissions:['transfer:AddProposal']}]};
   f.view.mockImplementation(async (_network,_contract,method) => {
    if (method === 'get_policy') return memberPolicy;
    if (method === 'delegation_balance_of') return weight;
    return {spec:'ft-1.0.0',name:'Token',symbol:'TOK',decimals:6};
   });
   const operation = await f.op('weighted');
   const cells = [selected(operation,0)];
   expect((await preflightRows(cells,f.runtime,f.wallet))[0]?.issues.join(' ')).toMatch(/permission/);
   weight = Number(minimum);
   expect((await preflightRows(cells,f.runtime,f.wallet))[0]?.issues.join(' ')).toMatch(/valid delegated voting balance/);
   weight = minimum;
   expect((await preflightRows(cells,f.runtime,f.wallet))[0]?.included).toBe(true);
   expect(f.view).toHaveBeenCalledWith('testnet','dao.testnet','delegation_balance_of',{account_id:'signer.testnet'},expect.any(AbortSignal));
   const plan = await reviewPlan([operation],{},f.wallet,f.runtime);
   weight = '0';
   const record = vi.fn(async () => {});
   await expect(executePlan({plan,wallet:f.wallet,runtime:f.runtime,snapshot:()=>({}),journal:()=>({}),record})).rejects.toThrow(/permission/);
   expect(record).not.toHaveBeenCalled();
   expect(f.sign).not.toHaveBeenCalled();
  } finally { f.runtime.dispose(); }
 });
 it('rechecks a disconnected action after connection while retaining permission checks and never signing',async()=>{
  const f=fixture();try{
   const operation=await f.op('one'),cells=[selected(operation,0)];
   const connected=f.wallet.getState();
   const getState=vi.spyOn(f.wallet,'getState').mockReturnValue({...connected,status:'disconnected',connection:null});
   const blocked=await preflightRows(cells,f.runtime,f.wallet);
   expect(blocked[0]?.included).toBe(false);expect(blocked[0]?.issues.join(' ')).toMatch(/Connect a wallet/);
   getState.mockReturnValue(connected);
   const ready=await preflightRows(blocked.map(row=>({...row.source,operation:row.operation})),f.runtime,f.wallet);
   expect(ready[0]?.issues).toEqual([]);expect(ready[0]?.included).toBe(true);
   getState.mockReturnValue({...connected,connection:{...connected.connection!,accountId:'outsider.testnet'}});
   const denied=await preflightRows(cells,f.runtime,f.wallet);
   expect(denied[0]?.included).toBe(false);expect(denied[0]?.issues.join(' ')).toMatch(/permission/);
   expect(f.sign).not.toHaveBeenCalled();
  }finally{f.runtime.dispose();}
 });
 it('includes all eligible rows, but requires an explicit subset when any row is blocked',async()=>{
  const f=fixture();try{
   const a=await f.op('one'),b=await f.op('two');expect((await preflightRows([selected(a,0),selected(b,1)],f.runtime,f.wallet)).every(r=>r.included)).toBe(true);
   const rows=await preflightRows([selected(a,0),selected(undefined,31)],f.runtime,f.wallet);expect(rows.every(r=>!r.included)).toBe(true);expect(rows[1]?.issues.length).toBeGreaterThan(0);
   expect(includeRow(rows,rows[0]!.key,true).filter(r=>r.included)).toHaveLength(1);expect(f.sign).not.toHaveBeenCalled();
  }finally{f.runtime.dispose();}
 });
 it('keeps duplicates visible and permits only one included occurrence',async()=>{
  const f=fixture();try{const a=await f.op('one');const rows=await preflightRows([selected(a,0),selected(a,1)],f.runtime,f.wallet);expect(rows.every(r=>r.duplicate&&!r.included)).toBe(true);const one=includeRow(rows,rows[0]!.key,true),two=includeRow(one,rows[1]!.key,true);expect(two.map(r=>r.included)).toEqual([false,true]);}finally{f.runtime.dispose();}
 });
 it('reports network, permission, precision and previous-attempt blockers per row',async()=>{
  const f=fixture();try{
   const a=await f.op('one');const other={...a,id:'other',network:'mainnet' as const};let rows=await preflightRows([selected(a,0),selected(other,1)],f.runtime,f.wallet);expect(rows[1]?.issues.join(' ')).toMatch(/networks differ/);
   f.view.mockResolvedValue({proposal_bond:'100',roles:[]});rows=await preflightRows([selected({...a,policy:{proposal_bond:'100',roles:[]},asset:'near'},0)],f.runtime,f.wallet);expect(rows[0]?.issues.join(' ')).toMatch(/permission/);
   f.view.mockImplementation(async(_n,_c,m)=>m==='get_policy'?policy:{decimals:18});rows=await preflightRows([selected(a,0)],f.runtime,f.wallet);expect(rows[0]?.issues.join(' ')).toMatch(/precision/);
  }finally{f.runtime.dispose();}
 });
 it('never allocates deposits during preflight and requires prepared quotes for final review',async()=>{
  const f=fixture();try{const a=await f.op('one');const swap={...a,kind:'INTENTS_SWAP',intents:{stage:'estimated',expiresAt:'2099-01-01T00:00:00Z'}} as Operation;const prepare=vi.spyOn(f.runtime,'prepare');const rows=await preflightRows([selected(swap,0)],f.runtime,f.wallet);expect(rows[0]?.included).toBe(true);expect(prepare).not.toHaveBeenCalled();await expect(reviewPlan([swap],{},f.wallet,f.runtime)).rejects.toThrow(/Prepare/);}finally{f.runtime.dispose();}
 });
 it.each(['cancelled','failed','indeterminate'] as const)('stops after %s and leaves remaining actions untouched',async(state)=>{
  const f=fixture();try{const a=await f.op('one'),b=await f.op('two');if(state==='cancelled')f.sign.mockRejectedValue(new WalletCancelledError());else if(state==='failed')f.sign.mockResolvedValue({status:{Failure:{error:'bad'}}} as never);else f.sign.mockRejectedValue(new Error('disconnected'));
   const journal:ExecutionJournal={};await executePlan({plan:await reviewPlan([a,b],{},f.wallet,f.runtime),wallet:f.wallet,runtime:f.runtime,snapshot:()=>({}),journal:()=>journal,record:async r=>{journal[r.id]=r;}});
   expect(f.sign).toHaveBeenCalledTimes(1);expect(journal[a.id]?.state).toBe(state);expect(journal[b.id]).toBeUndefined();expect(outcomeLabel({key:'b',source:selected(b,1),operation:b,issues:[],duplicate:false,included:true},true)).toBe('Not attempted');
  }finally{f.runtime.dispose();}
 });
 it('keeps monetary totals separated by network, DAO, asset and operation',async()=>{
  const f=fixture();try{const a=await f.op('one');expect(groupedAmounts([a,a])[0]?.amount).toBe('2.000002');expect(groupedAmounts([a,{...a,source:'other.testnet'},{...a,kind:'SPUTNIK_CALL'}])).toHaveLength(3);expect(signingLabel([a])).toBe('Submit 1 proposals');}finally{f.runtime.dispose();}
 });
});
