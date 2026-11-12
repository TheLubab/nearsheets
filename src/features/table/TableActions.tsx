import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';
import { BLOCKCHAIN_TOOLS,ribbonCommandId } from '../spreadsheet/univer/blockchain-ribbon';
import type { WorkbookSession } from '../spreadsheet/univer/create-workbook-session';
import { getTableSelection } from './selection';
import { ReadDetails } from './ReadDetails';
import { FunctionArguments, captureTarget } from './FunctionArguments';
import type { EditorTarget } from './FunctionArguments';
import { parseFunction, singleCellReference } from './formula-editor';
import { getFunction } from './function-registry';
import { Dialog } from '../../components/ui/dialog';
import { loadingToast } from '../../components/ui/toast';
import type { DocumentWorkspace } from '../documents/application/document-workspace';
import type { WalletController } from '../wallet/application/wallet-controller';
import { executePlan, reviewPlan, reconcileExecution, executionProblem, snapshotFingerprint } from './execution';
import type { ReviewedPlan, Execution } from './execution';
import { preflightRows, includeRow, groupedAmounts, signingLabel, outcomeLabel } from './batch-review';
import type { ReviewRow } from './batch-review';
import { toProblem } from './problems';
import type { Problem } from './problems';
import { ProblemNotice } from './ProblemNotice';

interface Review {rows:ReviewRow[];snapshot:string;owner:string;plan:ReviewedPlan|null;finished:boolean}
interface Editor {name:string;target:EditorTarget;editing:boolean;prefill?:string}
export function TableActions({workspace,wallet,activeSession,children}:{workspace:DocumentWorkspace;wallet:WalletController;activeSession:WorkbookSession|null;children:ReactNode}) {
 const [inspect,setInspect]=useState(false),[history,setHistory]=useState(false),[page,setPage]=useState(0);
 const [review,setReview]=useState<Review|null>(null),[editor,setEditor]=useState<Editor|null>(null);
 const [error,setError]=useState<Problem|null>(null),[busy,setBusy]=useState(false);
 const [selection,setSelection]=useState(()=>getTableSelection(null));
 const currentSession=useRef(activeSession);currentSession.current=activeSession;
 const stopToast=useRef<(()=>void)|null>(null);
 const closeEditor=useCallback(()=>setEditor(null),[]);
 useEffect(()=>{setEditor(null);setTracking(null);setReview(null);setInspect(false);setError(null);setBusy(false);return()=>{stopToast.current?.();};},[activeSession]);
 useEffect(()=>{
  if(!activeSession){setSelection(getTableSelection(null));return;}
  let active=true,queued=false;
  const update=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;if(active)setSelection(getTableSelection(activeSession));});};
  const workbook=activeSession.getWorkbook();
  const listeners=[workbook?.onSelectionChange(()=>{setPage(0);update();}),workbook?.onCommandExecuted(update),activeSession.univerAPI.getFormula().calculationStart(update),activeSession.univerAPI.getFormula().calculationEnd(update)];update();
  return()=>{active=false;listeners.forEach(l=>l?.dispose());};
 },[activeSession]);
 const run=async(message:string,task:(session:WorkbookSession)=>Promise<void>)=>{
  const session=activeSession;if(!session)return;
  setBusy(true);setError(null);const stop=loadingToast('nearsheets.table-operation',message);stopToast.current=stop;
  try{await task(session);}catch(cause){if(currentSession.current===session)setError(toProblem(cause));}finally{stop();if(currentSession.current===session)setBusy(false);}
 };
 const openFunction=(name:string,editing=false)=>{
  const cell=activeSession?.getWorkbook()?.getActiveCell();if(!cell)return;
  const parsed=editing?parseFunction(cell.getFormula()):null;
  const selected=getTableSelection(activeSession);
  if(editing&&(!parsed||!selected.single)){setError(toProblem(new Error('Guided editing requires one supported top-level function. Use the formula bar for wrappers and other expressions.')));return;}
  let prefill:string|undefined;
  if(getFunction(name)?.category==='Track results'&&selected.actionCells.length===1){const source=selected.actionCells[0]!;const sheet=activeSession!.univerAPI.getWorkbook(source.location.unitId)?.getSheetBySheetId(source.location.sheetId);if(sheet)prefill=singleCellReference(sheet.getSheetName(),{startRow:source.location.row,endRow:source.location.row,startColumn:source.location.column,endColumn:source.location.column},false,false);}
  // Tracking needs its own explicit destination; never replace the selected source action.
  if(prefill){setTracking({name,prefill});return;}
  setEditor({name:parsed?.name??name,target:captureTarget(cell),editing});setInspect(false);
 };
 const [tracking,setTracking]=useState<{name:string;prefill:string}|null>(null);
 const refresh=(selected:boolean)=>{if(!activeSession?.tableRuntime)return;activeSession.tableRuntime.refresh(selected?selection.readKeys:undefined);activeSession.univerAPI.getFormula().executeCalculation();};
 const openReview=()=>run('Checking selected actions…',async session=>{
  const runtime=session.tableRuntime!;if(runtime.calculating)throw new Error('Wait for calculation to finish.');
  const cells=getTableSelection(session).actionCells;if(!cells.length)throw new Error('Select action cells to review.');
  const snapshot=snapshotFingerprint(session.saveSnapshot()),owner=workspace.getState().document?.documentId;if(!owner)return;
  const rows=await preflightRows(cells,runtime,wallet);
  if(currentSession.current!==session)return;
  if(snapshotFingerprint(session.saveSnapshot())!==snapshot)throw new Error('Workbook changed during preflight. Open a new review.');
  setReview({rows,snapshot,owner,plan:null,finished:false});
 });
 useEffect(()=>{
  const handler=(event:Event)=>{const command=(event as CustomEvent<string>).detail;
   if(command.startsWith('function:'))openFunction(command.slice(9));
   if(command==='edit')openFunction('',true);
   if(command==='refresh:selected'&&!busy)refresh(true);
   if((command==='refresh:all'||command==='refresh')&&!busy)refresh(false);
   if(command==='inspect'){setInspect(true);setHistory(false);}
   if(command==='review'&&!busy)void openReview();
  };window.addEventListener('nearsheets:command',handler);return()=>window.removeEventListener('nearsheets:command',handler);
 });
 useEffect(()=>{if(!activeSession)return;activeSession.univerAPI.updateMenuConfig(Object.fromEntries(BLOCKCHAIN_TOOLS.map(tool=>[ribbonCommandId(tool.key),{disabled:!selection.ready||busy||(tool.key==='review'&&(!selection.actionCells.length||selection.calculating)),...(tool.key==='review'?{title:selection.actionCells.length?`Review ${selection.actionCells.length} actions`:'Review actions',tooltip:`${selection.operations.length} actions ready for review · ${selection.attention} need attention`}:{})}])));activeSession.univerAPI.updateMenuConfig({'nearsheets.edit':{disabled:!selection.single||!parseFunction(selection.cells[0]?.formula??'')}});},[activeSession,busy,selection]);
 const selectedIds=new Set(selection.operations.map(op=>op.id));
 const records=Object.values(workspace.getState().document?.executions??{}).filter(record=>history||selectedIds.has(record.id));
 const included=review?.rows.filter(row=>row.included)??[],operations=included.flatMap(row=>row.operation?[row.operation]:[]);
 const stale=!!review&&!!activeSession&&snapshotFingerprint(activeSession.saveSnapshot())!==review.snapshot;
 const assertCurrent=(session:WorkbookSession)=>{if(!review||currentSession.current!==session||snapshotFingerprint(session.saveSnapshot())!==review.snapshot)throw new Error('Reviewed inputs changed. Close this review and review the selection again.');};
 const reconcile=(record:Execution)=>run('Checking transaction…',async session=>{const documentId=workspace.getState().document?.documentId;if(!documentId||!session.tableRuntime)return;await workspace.recordExecution(await reconcileExecution(record,session.tableRuntime),documentId);if(currentSession.current!==session)return;session.tableRuntime.executions=workspace.getState().document?.executions??{};session.univerAPI.getFormula().executeCalculation();});
 return <>{children}
  {editor&&activeSession&&<FunctionArguments key={editor.target.original+editor.name+editor.target.label} session={activeSession} target={editor.target} functionName={editor.name} editing={editor.editing} prefill={editor.prefill} onClose={closeEditor}/>}
  {tracking&&<div className="reference-picker" role="region" aria-label="Tracking destination"><span>Select a destination cell for {getFunction(tracking.name)?.title}. Source: {tracking.prefill}</span><button onClick={()=>{const cell=activeSession?.getWorkbook()?.getActiveCell();if(!cell)return;const destination=singleCellReference(cell.getSheetName(),cell.getRange(),false,false);if(destination===tracking.prefill){setError(toProblem(new Error('Choose a different destination cell to preserve the action.')));return;}setEditor({name:tracking.name,target:captureTarget(cell),editing:false,prefill:tracking.prefill});setTracking(null);}}>Use destination</button><button onClick={()=>setTracking(null)}>Cancel</button></div>}
  <Dialog open={inspect} onOpenChange={setInspect} title="Inspect selected cells" description={`${selection.operations.length} actions ready for review · ${selection.attention} need attention. Permissions are checked in review.`}>
   <p>{selection.label} · {selection.readCount} cells with read dependencies</p>
   {selection.single&&(parseFunction(selection.cells[0]?.formula??'')?<button onClick={()=>openFunction('',true)}>Edit arguments</button>:selection.cells[0]?.formula&&<p>Use the formula bar to edit wrapped calls and other expressions.</p>)}
   <button disabled={busy||!selection.readKeys.size} onClick={()=>refresh(true)}>Refresh selected reads</button>
   {selection.allCells.slice(page*30,(page+1)*30).map(cell=><section key={cell.address}><h3>{cell.address}</h3><code>{cell.formula}</code><p>Value: {String(cell.value??'')}</p>{cell.problems.map((problem,i)=><ProblemNotice key={i} problem={problem}/>)}{cell.args.length>0&&<details><summary>Resolved arguments</summary><pre>{JSON.stringify(cell.args,null,2)}</pre></details>}{cell.operation&&<p>{cell.operation.amount} {cell.operation.asset} · {cell.operation.baseUnits} base units</p>}{cell.readKeys.map(key=>{const read=activeSession?.tableRuntime?.evidence.get(key);return read?<ReadDetails key={key} readKey={key} read={read}/>:null;})}</section>)}
   {selection.cellCount>30&&<p><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button> Page {page+1} of {Math.ceil(selection.cellCount/30)} · {selection.cellCount} cells <button disabled={(page+1)*30>=selection.cellCount} onClick={()=>setPage(p=>p+1)}>Next</button></p>}
   <label><input type="checkbox" checked={history} onChange={e=>setHistory(e.target.checked)}/>Workbook-wide history and reads</label>
   {history&&[...(activeSession?.tableRuntime?.evidence??[])].map(([key,read])=><ReadDetails key={key} readKey={key} read={read}/>)}
   {records.map(record=><section key={record.id}><p>{record.id}: {record.state}</p><p>{record.transactionHash??'No hash returned. Check wallet transaction history before preparing a replacement.'}</p>{executionProblem(record)&&<ProblemNotice problem={executionProblem(record)!}/>}<button disabled={busy||!record.transactionHash} onClick={()=>void reconcile(record)}>Check transaction</button></section>)}
   {error&&<ProblemNotice problem={error}/>}
  </Dialog>
  <Dialog open={!!review} onOpenChange={open=>{if(!busy&&!open){setReview(null);setError(null);}}} title={review?.finished?'Action outcomes':'Review selected actions'} description="Each included row is a separate wallet request. Proposal submission still awaits DAO governance; Intents provider progress is tracked separately." className="batch-review" suspendModal={busy}>
   {review&&<>
    <p>{included.length} included · {review.rows.length-included.length} excluded · {review.rows.length} selected actions</p>
    {review.rows.some(r=>r.issues.length||r.duplicate)&&!review.plan&&!review.finished&&<p>Some rows need attention. Explicitly choose an eligible subset. Copies share an identity; only one can be included.</p>}
    {stale&&<p role="alert">Reviewed inputs changed. Close and start a new review.</p>}
    <div className="review-table-scroll"><table className="review-table"><thead><tr>{['Include / Cell','Source DAO','Operation','Recipient / Proposal','Asset','Amount','Readiness / Outcome'].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{review.rows.map(row=><tr key={row.key}>
     <td><label><input type="checkbox" checked={row.included} disabled={busy||review.finished||!!row.issues.length||stale} onChange={e=>setReview({...review,rows:includeRow(review.rows,row.key,e.target.checked),plan:null})}/>{row.source.address}</label></td>
     <td>{row.operation?.source??'—'}<small>{row.operation?.network}</small></td><td>{getFunction(row.operation?.kind??'')?.title??'Invalid draft'}</td><td>{row.operation?.recipient||String(row.operation?.transaction.actions[0]?.params.args.id??'—')}</td><td>{row.operation?.asset||'—'}</td><td>{row.operation?.amount||'—'}</td>
     <td>{outcomeLabel(row,review.finished)}{row.duplicate&&<p>Duplicate reference</p>}{row.previous&&<p>Previous attempt: {row.previous.state}</p>}
      <details><summary>Exact details</summary>{row.operation&&<><p>{row.operation.baseUnits} base units · {row.operation.decimals} decimals</p><p>Proposal bond (wallet-funded): {row.operation.kind==='SPUTNIK_VOTE'?'0':row.operation.transaction.actions[0]?.params.deposit??'Available after preparation'} yoctoNEAR</p>{row.operation.intents&&<><p>Provider: {row.operation.intents.stage} · expires {row.operation.intents.expiresAt}</p><p>Expired routes require a new proposal. Sputnik transfers cannot enforce the deadline against approval from another client.</p><pre>{JSON.stringify(row.operation.intents,null,2)}</pre></>}<pre>{JSON.stringify(row.operation.transaction,null,2)}</pre></>}{row.source.problems.map((problem,i)=><ProblemNotice key={i} problem={problem}/>)}</details>
      {row.outcome&&executionProblem(row.outcome)&&<ProblemNotice problem={executionProblem(row.outcome)!}/>} {row.outcome?.transactionHash&&<button disabled={busy} onClick={()=>void reconcile(row.outcome!)}>Check transaction</button>}
     </td>
    </tr>)}</tbody></table></div>
    {groupedAmounts(operations).map(g=><p key={JSON.stringify([g.network,g.source,g.asset,g.kind])}>{g.network} · {g.source} · {g.kind}: {g.amount} {g.asset} DAO-funded</p>)}
    <p>Proposal bonds are wallet-funded and shown separately per row. {included.length} wallet requests. Network fees vary; the wallet shows each fee.</p>
    {!review.finished&&<>
     {operations.some(op=>op.intents&&op.intents.stage!=='prepared')&&<button disabled={busy||stale||!included.length} onClick={()=>void run('Preparing selected swap routes…',async session=>{assertCurrent(session);const rows=[...review.rows];for(let i=0;i<rows.length;i++){const row=rows[i]!;if(row.included&&row.operation?.intents){const operation=await session.tableRuntime!.prepare(row.operation);assertCurrent(session);rows[i]={...row,operation};}}setReview({...review,rows,plan:null});})}>Prepare selected swaps</button>}
     {!review.plan?<button disabled={busy||stale||!included.length||operations.some(op=>op.intents&&op.intents.stage!=='prepared')} onClick={()=>{try{if(!activeSession)return;assertCurrent(activeSession);setReview({...review,plan:reviewPlan(operations,activeSession.saveSnapshot(),wallet)});setError(null);}catch(cause){setError(toProblem(cause));}}}>Confirm included actions for signing</button>:<button className="primary-button" disabled={busy||stale} onClick={()=>void run('Waiting for wallet…',async session=>{
      assertCurrent(session);const plan=review.plan!;flushSync(()=>setBusy(true));const outcomes=new Map<string,Execution>();
      try{await executePlan({plan,wallet,runtime:session.tableRuntime!,snapshot:()=>{if(currentSession.current!==session)throw new Error('Document changed. Start a new review.');return session.saveSnapshot();},journal:()=>workspace.getState().document?.executions??{},record:async record=>{await workspace.recordExecution(record,review.owner);outcomes.set(record.id,record);}});}
      finally{if(currentSession.current===session){session.tableRuntime!.executions=workspace.getState().document?.executions??{};setReview({...review,finished:true,rows:review.rows.map(row=>({...row,outcome:row.included&&row.operation?outcomes.get(row.operation.id):undefined}))});session.univerAPI.getFormula().executeCalculation();}}
     })}>{busy?'Waiting for wallet…':signingLabel(operations)}</button>}
    </>}
    {review.finished&&<p>Remaining rows were not attempted. Close this dialog and start a new review to continue.</p>}
   </>}
   {error&&<ProblemNotice problem={error}/>}
  </Dialog>
  {error&&!review&&!inspect&&<Dialog open onOpenChange={open=>{if(!open)setError(null);}} title="Operation needs attention"><ProblemNotice problem={error}/></Dialog>}
 </>;
}
