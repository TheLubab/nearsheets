import { describe, expect, it, vi } from 'vitest';
import { TableRuntime } from '../src/features/table/runtime';
import type { TablePorts } from '../src/features/table/runtime';
import { executePlan, reviewPlan, reconcileExecution, executionProblem, executionSchema } from '../src/features/table/execution';
import type { ExecutionJournal } from '../src/features/table/execution';
import type { WalletController } from '../src/features/wallet/application/wallet-controller';
import { migrateFormula, migrateDocument } from '../src/features/documents/model/document-migrations';
import { createDocumentEnvelope } from '../src/features/documents/model/document-envelope';
import { parseExactAmount } from '../src/features/treasury/model/exact-amount';
const policy = {proposal_bond:'100',roles:[{kind:{Group:['signer.testnet']},permissions:['*:AddProposal','*:VoteApprove']}]};
function fixture() {
  const view = vi.fn<TablePorts['view']>(async (_n,_c,method) => {
    if(method === 'get_policy') return policy;
    if(method === 'ft_metadata') return {spec:'ft-1.0.0',name:'Token',symbol:'TOK',decimals:6};
    if(method === 'ft_balance_of') return '1250000';
    if(method === 'get_proposal') return {id:1,status:'InProgress'};
    return [{id:1,status:'InProgress',description:'A proposal',proposer:'signer.testnet'}];
  });
  const runtime = new TableRuntime({view,balance:vi.fn(async()=> '2500000000000000000000000')});
  const sign = vi.fn(async()=>({status:{SuccessValue:''},transaction:{hash:'hash'}}));
  const wallet = {getState:()=>({status:'connected',network:'testnet',connection:{accountId:'signer.testnet'}}),signAndSendTransaction:sign} as unknown as WalletController;
  return {runtime,view,wallet,sign};
}
const transferArgs = ['invoice-1','dao.sputnikv2.testnet','alice.testnet','1.000001','token.testnet','testnet'];
describe('table runtime and deliberate execution',()=>{
  it('returns calculable balances and structured proposal ranges using shared deduplicated reads',async()=>{
    const {runtime,view,sign} = fixture();
    expect(await runtime.calculate('NEAR_BALANCE',['alice.testnet','testnet'])).toBe(2.5);
    expect(await runtime.calculate('FT_BALANCE',['token.testnet','alice.testnet','testnet'])).toBe(1.25);
    const [a,b] = await Promise.all([runtime.calculate('SPUTNIK_PROPOSALS',['dao.testnet','testnet']),runtime.calculate('SPUTNIK_PROPOSALS',['dao.testnet','testnet'])]);
    expect(a).toEqual(b);expect(a).toEqual([['ID','Description','Status','Proposer'],[1,'A proposal','InProgress','signer.testnet']]);
    expect(view.mock.calls.filter(args=>args[2]==='get_proposals')).toHaveLength(1);
    expect(sign).not.toHaveBeenCalled();
    runtime.dispose();
  });
  it('uses verified FT metadata and preserves exact units in the reviewed payload',async()=>{
    const {runtime,wallet,sign}=fixture();
    const label = await runtime.calculate('SPUTNIK_TRANSFER',transferArgs);
    const op = runtime.operations.get(String(label))!;
    expect(op.baseUnits).toBe('1000001');expect(op.decimals).toBe(6);
    expect(op.transaction.actions[0]?.params.args).toEqual({proposal:{description:'NearSheets invoice-1',kind:{Transfer:{token_id:'token.testnet',receiver_id:'alice.testnet',amount:'1000001'}}}});
    const journal: ExecutionJournal={}; const events:string[]=[];
    sign.mockImplementation(async()=>{events.push('sign');expect(journal[op.id]?.state).toBe('awaiting-wallet');return {status:{SuccessValue:''},transaction:{hash:'hash'}};});
    const plan = await reviewPlan([op],{cells:'unchanged'},wallet,runtime);
    await executePlan({plan,wallet,runtime,snapshot:()=>({cells:'unchanged'}),journal:()=>journal,record:async record=>{events.push(record.state);journal[record.id]=record;}});
    expect(events).toEqual(['awaiting-wallet','sign','confirmed']);
    await expect(executePlan({plan,wallet,runtime,snapshot:()=>({cells:'unchanged'}),journal:()=>journal,record:async()=>{}})).rejects.toThrow(/already has/);
    expect(sign).toHaveBeenCalledTimes(1);runtime.dispose();
  });
  it('rejects stale previews and failed attempt persistence before wallet submission',async()=>{
    const {runtime,wallet,sign}=fixture();
    const label=await runtime.calculate('SPUTNIK_TRANSFER',transferArgs);
    const plan=await reviewPlan([runtime.operations.get(String(label))!],{v:1},wallet,runtime);
    await expect(executePlan({plan,wallet,runtime,snapshot:()=>({v:2}),journal:()=>({}),record:async()=>{}})).rejects.toThrow(/stale/);
    await expect(executePlan({plan,wallet,runtime,snapshot:()=>({v:1}),journal:()=>({}),record:async()=>{throw new Error('disk full');}})).rejects.toThrow('disk full');
    expect(sign).not.toHaveBeenCalled();runtime.dispose();
  });
  it('reconciles a known transaction without signing or treating absence as a safe retry',async()=>{
    const {runtime,wallet,sign}=fixture();
    const label=await runtime.calculate('SPUTNIK_TRANSFER',transferArgs);
    const op=runtime.operations.get(String(label))!;
    const record={id:op.id,revision:op.revision,account:'signer.testnet',at:new Date().toISOString(),state:'indeterminate' as const,transactionHash:'hash',message:null};
    runtime.ports.transaction=vi.fn(async()=>({status:{SuccessValue:btoa('42')},transaction:{hash:'hash',signer_id:'signer.testnet',receiver_id:op.source}}));
    expect(await reconcileExecution(record,runtime)).toMatchObject({state:'confirmed',proposalId:42});
    await expect(reconcileExecution({...record,transactionHash:null},runtime)).rejects.toThrow(/remains indeterminate/);
    expect(sign).not.toHaveBeenCalled();void wallet;runtime.dispose();
  });
  it('keeps indeterminate attempts blocked, including copied expressions',async()=>{
    const {runtime,wallet,sign}=fixture();
    const label=await runtime.calculate('SPUTNIK_TRANSFER',transferArgs);
    const op=runtime.operations.get(String(label))!; const plan=await reviewPlan([op],{},wallet,runtime);
    sign.mockRejectedValue(new Error('RPC connection lost'));
    const journal: ExecutionJournal={};
    await executePlan({plan,wallet,runtime,snapshot:()=>({}),journal:()=>journal,record:async r=>{journal[r.id]=r;}});
    expect(journal[op.id]?.state).toBe('indeterminate');
    expect(executionProblem(journal[op.id]!)?.recovery).toMatch(/wallet history/);
    expect(executionSchema.parse(journal[op.id]).technicalDetails).toBe('RPC connection lost');
    expect(journal[op.id]?.message).toMatch(/outcome is unknown/);
    await expect(executePlan({plan,wallet,runtime,snapshot:()=>({}),journal:()=>journal,record:async()=>{}})).rejects.toThrow(/Reconcile/);
    expect(sign).toHaveBeenCalledTimes(1);runtime.dispose();
  });
  it('rejects exact-string precision loss and zero actions',async()=>{
    expect(parseExactAmount('1000000000.49',0).ok).toBe(false);
    expect(parseExactAmount('0.0000000000000000000000001',24).ok).toBe(false);
    const {runtime}=fixture();
    await expect(runtime.calculate('SPUTNIK_TRANSFER',transferArgs.map((v,i)=>i===3?'0':v))).rejects.toThrow(/positive/);
    await expect(runtime.calculate('SPUTNIK_TRANSFER',transferArgs.map((v,i)=>i===3?'1.0000001':v))).rejects.toThrow(/decimal/);
    runtime.dispose();
  });
  it('migrates formula tokens, retaining literal user text, plugin resources and historical evidence',()=>{
    expect(migrateFormula('=TREZU_ACCOUNT("TREZU_AMOUNT(7)")&TREZU_REFERENCE("INV",2)')).toBe('=NEAR_ACCOUNT("TREZU_AMOUNT(7)")&NS_REFERENCE("INV",2)');
    expect(migrateFormula("='TREZU_ACCOUNT(foo)'!A1+TREZU_AMOUNT(B2,24)")).toBe("='TREZU_ACCOUNT(foo)'!A1+NEAR_AMOUNT(B2,24)");
    const old=createDocumentEnvelope({title:'Trezu Sheets is my label',workbook:{id:'w',name:'User text',sheetOrder:['x'],sheets:{x:{id:'x',name:'Anything',cellData:{42:{9:{f:'=TREZU_ACCOUNT("alice.testnet")',v:'literal TREZU_ACCOUNT('}}}}},resources:[{name:'custom',data:'retained'}]},treasury:{network:'testnet',accountId:null}});
    const legacy={...old,format:'trezu-sheets',schemaVersion:2};const source=JSON.stringify(legacy);
    const result=migrateDocument(legacy);expect(result.ok).toBe(true);
    if(result.ok){expect(result.document.format).toBe('nearsheets');expect(result.document.title).toBe(old.title);expect(result.document.workbook.sheets.x?.cellData?.[42]?.[9]?.f).toBe('=NEAR_ACCOUNT("alice.testnet")');expect(result.document.workbook.resources).toEqual(old.workbook.resources);}
    expect(JSON.stringify(legacy)).toBe(source);
  });
});
