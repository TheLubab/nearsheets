import type { SelectedCell } from './selection';
import { checkRouteExpiry, savedDraftProblem } from './runtime';
import type { Operation, TableRuntime } from './runtime';
import type { WalletController } from '../wallet/application/wallet-controller';
import { reviewPlan } from './execution';
import type { Execution } from './execution';
import { toProblem } from './problems';
import { amountFromBaseUnits } from '../treasury/model/exact-amount';
export interface ReviewRow {
 key:string;source:SelectedCell;operation?:Operation;issues:string[];duplicate:boolean;included:boolean;previous?:Execution;outcome?:Execution;
}
/** Safe reads only. Funding instructions require the separate prepare button. */
export async function preflightRows(cells:SelectedCell[],runtime:TableRuntime,wallet:WalletController):Promise<ReviewRow[]> {
 const counts=new Map<string,number>();for(const cell of cells)if(cell.operation)counts.set(cell.operation.id,(counts.get(cell.operation.id)??0)+1);
 const rows:ReviewRow[]=[];
 for(const cell of cells) {
  const row:ReviewRow={key:JSON.stringify(cell.location),source:cell,operation:cell.operation,issues:cell.problems.map(p=>p.message),duplicate:!!cell.operation&&(counts.get(cell.operation.id)??0)>1,included:false,previous:cell.operation?runtime.executions[cell.operation.id]:undefined};
  if(!row.operation)row.issues.push('No valid action draft. Correct the formula and recalculate.');
  else if(row.operation.saved || cell.readKeys.some(key=>runtime.evidence.get(key)?.saved)) {
    row.issues.push(savedDraftProblem().message);
  }
  else {
   try {
    const op=row.operation;
    runtime.query.removeQueries({queryKey:[op.network,op.source,'get_policy']});
    const policy=await runtime.read(op.network,op.source,'get_policy');
    let proposal=op.proposal;
    if(op.kind==='SPUTNIK_VOTE') {runtime.query.removeQueries({queryKey:[op.network,op.source,'get_proposal']});proposal=await runtime.read(op.network,op.source,'get_proposal',{id:op.transaction.actions[0]?.params.args.id});if(JSON.stringify(proposal)!==JSON.stringify(op.proposal))throw new Error('Proposal changed. Refresh and review again.');}
    if(JSON.stringify(policy)!==JSON.stringify(op.policy))throw new Error('DAO policy changed. Refresh and review again.');
    if(op.asset&&op.asset!=='near') {runtime.query.removeQueries({queryKey:[op.network,op.asset,'ft_metadata']});const meta=await runtime.read(op.network,op.asset,'ft_metadata') as {decimals?:unknown};if(meta.decimals!==op.decimals)throw new Error('Token precision changed. Refresh and review again.');}
    if(op.kind==='SPUTNIK_VOTE')checkRouteExpiry(proposal,String(op.transaction.actions[0]?.params.args.action));
    await reviewPlan([op],null,wallet,runtime,true);
    if(row.previous&&!['failed','cancelled'].includes(row.previous.state))throw new Error('Previously attempted. Reconcile the transaction or wallet history before any replacement.');
   }catch(cause){row.issues.push(toProblem(cause).message);}
  }
  rows.push(row);
 }
 if(rows.every(row=>!row.issues.length&&!row.duplicate))rows.forEach(row=>{row.included=true;});
 return rows;
}
export function includeRow(rows:ReviewRow[],key:string,included:boolean):ReviewRow[] {
 const target=rows.find(row=>row.key===key);if(!target||target.issues.length)return rows;
 return rows.map(row=>({...row,included:row.key===key?included:included&&row.operation?.id===target.operation?.id?false:row.included}));
}
export function signingLabel(operations:Operation[]) {const votes=operations.filter(op=>op.kind==='SPUTNIK_VOTE').length;return votes===operations.length?`Sign ${votes} votes`:votes===0?`Submit ${operations.length} proposals`:`Sign ${operations.length} actions`;}
export function groupedAmounts(operations:Operation[]) {
 const groups=new Map<string,{network:string;source:string;asset:string;kind:string;decimals:number;units:bigint}>();
 for(const op of operations) {if(!op.baseUnits)continue;const key=JSON.stringify([op.network,op.source,op.asset,op.kind]);const old=groups.get(key);groups.set(key,{network:op.network,source:op.source,asset:op.asset,kind:op.kind,decimals:op.decimals,units:(old?.units??0n)+BigInt(op.baseUnits)});}
 return [...groups.values()].map(g=>({...g,amount:amountFromBaseUnits(g.units.toString(),g.decimals)!.display}));
}
export const outcomeLabel=(row:ReviewRow,finished:boolean)=>row.outcome?row.outcome.state==='confirmed'?(row.operation?.kind==='SPUTNIK_VOTE'?'Vote confirmed':'Proposal submitted · awaiting governance'):row.outcome.state:finished?'Not attempted':row.issues.join(' ')||'Ready for review';
