import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BLOCKCHAIN_TOOLS,ribbonCommandId } from '../spreadsheet/univer/blockchain-ribbon';
import type { WorkbookSession } from '../spreadsheet/univer/create-workbook-session';
import { getTableSelection } from './selection';
import { ReadDetails } from './ReadDetails';
import { FunctionArguments, functionHelp } from './FunctionArguments';
import type { FRange } from '@univerjs/sheets/facade';
import { Dialog } from '../../components/ui/dialog';
import type { DocumentWorkspace } from '../documents/application/document-workspace';
import type { WalletController } from '../wallet/application/wallet-controller';
import { executePlan, reviewPlan, reconcileExecution, executionProblem } from './execution';
import type { ReviewedPlan } from './execution';
import { toProblem } from './problems';
import type { Problem } from './problems';
import { ProblemNotice } from './ProblemNotice';

export function TableActions({workspace,wallet,activeSession,children}:{workspace:DocumentWorkspace;wallet:WalletController;activeSession:WorkbookSession|null;children:ReactNode}) {
  const [help,setHelp] = useState(false);
  const [inspect,setInspect] = useState(false);
  const [owner,setOwner] = useState<string|null>(null);
  const [plan,setPlan] = useState<ReviewedPlan|null>(null);
  const [error,setError] = useState<Problem|null>(null);
  const [busy,setBusy] = useState(false);
  const [initialFunction,setInitialFunction]=useState('NEAR_BALANCE');
  const [insertTarget,setInsertTarget]=useState<FRange|null>(null);
  const [selection,setSelection]=useState(()=>getTableSelection(null));
  const openFunctions=(name='NEAR_BALANCE')=>{const cell=session()?.getWorkbook()?.getActiveCell();if(!cell)return;setInsertTarget(cell);setInitialFunction(name);setHelp(true);};
  const refresh=()=>{session()?.tableRuntime?.refresh();session()?.univerAPI.getFormula().executeCalculation();};
  useEffect(()=>{
    if(!activeSession){setSelection(getTableSelection(null));return;}
    let active=true,queued=false;
    const update=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;if(active)setSelection(getTableSelection(activeSession));});};
    const workbook=activeSession.getWorkbook();
    const listeners=[workbook?.onSelectionChange(update),workbook?.onCommandExecuted(update),activeSession.univerAPI.getFormula().calculationStart(update),activeSession.univerAPI.getFormula().calculationEnd(update)];
    update();
    return()=>{active=false;listeners.forEach(listener=>listener?.dispose());};
  },[activeSession]);
  const session = () => workspace.getSession();
  const review = async () => {
    setBusy(true);
    try {
      const current = session();
      const runtime = current?.tableRuntime;
      if (!runtime) throw new Error('The spreadsheet is still starting.');
      if (runtime.calculating) throw new Error('Wait for formula calculation to finish before review.');
      const {operations}=getTableSelection(current);
      const snapshot = current.saveSnapshot();
      setOwner(workspace.getState().document?.documentId ?? null);
      const prepared = [];
      for (const operation of operations) prepared.push(await runtime.prepare(operation));
      setPlan(reviewPlan(prepared,snapshot,wallet));
      setError(null);
    } catch (cause) { setError(toProblem(cause)); }
    finally { setBusy(false); }
  };
  useEffect(()=>{
    const handle=(event:Event)=>{
      const command=(event as CustomEvent<string>).detail;
      if(command==='functions')openFunctions();
      if(command.startsWith('function:'))openFunctions(command.slice('function:'.length));
      if(command==='refresh'&&!busy)refresh();
      if(command==='inspect')setInspect(true);
      if(command==='review'&&!busy)void review();
    };
    window.addEventListener('nearsheets:command',handle);
    return()=>window.removeEventListener('nearsheets:command',handle);
  });
  useEffect(()=>{
    if(!activeSession)return;
    const config=Object.fromEntries(BLOCKCHAIN_TOOLS.map(tool=>[ribbonCommandId(tool.key),{
      disabled:!selection.ready||busy||(tool.key==='review'&&(!selection.operations.length||selection.calculating)),
      ...(tool.key==='review'?{title:selection.operations.length?'Review '+selection.operations.length+' action'+(selection.operations.length===1?'':'s'):'Review actions'}:{}),
    }]));
    activeSession.univerAPI.updateMenuConfig(config);
  },[activeSession,busy,selection.ready,selection.operations.length,selection.calculating]);
  return <>
    {children}
    <Dialog open={inspect} onOpenChange={setInspect} title="Cell data and receipts" description="Balance cells use approximate spreadsheet numbers. Exact decimal amounts and base units are retained in the read details below. Refresh to request current chain state.">
      <section aria-label="Selected cells">
        <h3>Selected cells · {selection.label}</h3>
        {selection.cells.length ? selection.cells.map(cell=><dl key={cell.address}>
          <dt>Cell</dt><dd>{cell.address}</dd>
          {cell.formula && <><dt>Formula</dt><dd><code>{cell.formula}</code></dd></>}
          <dt>Underlying value</dt><dd>{String(cell.value ?? '')}</dd>
          {cell.problems.map((problem,index)=><dd key={index}><ProblemNotice problem={problem}/></dd>)}
          {cell.operation && <><dt>Exact action amount</dt><dd>{cell.operation.amount} {cell.operation.asset}</dd><dt>Base units</dt><dd>{cell.operation.baseUnits}</dd></>}
        </dl>) : <p>No populated cells selected.</p>}
        {selection.cellCount>selection.cells.length && <p>Showing the first {selection.cells.length} of {selection.cellCount} populated cells.</p>}
      </section>
      <details><summary>Workbook read details</summary>
      {[...(session()?.tableRuntime?.evidence ?? [])].map(([key,read])=><ReadDetails key={key} readKey={key} read={read}/>)}
      </details>
      {Object.values(workspace.getState().document?.executions ?? {}).map(record=><section key={record.id}><p>{record.id}: {record.state}</p><p>{record.transactionHash ?? 'No transaction hash returned'}</p>
      {executionProblem(record) && <ProblemNotice problem={executionProblem(record)!}/>}
      <button disabled={busy||!record.transactionHash} onClick={async()=>{
        const current=session(),documentId=workspace.getState().document?.documentId;if(!current?.tableRuntime||!documentId)return;setBusy(true);
        try{await workspace.recordExecution(await reconcileExecution(record,current.tableRuntime),documentId);current.tableRuntime.executions=workspace.getState().document?.executions ?? {};current.univerAPI.getFormula().executeCalculation();setError(null);}catch(cause){setError(toProblem(cause));}finally{setBusy(false);}
      }}>Check transaction</button></section>)}
      {error&&<ProblemNotice problem={error}/>}
    </Dialog>
    <Dialog open={help} onOpenChange={setHelp} title={functionHelp[initialFunction]?.title ?? 'Insert a function'} description={`${functionHelp[initialFunction]?.description ?? 'Fill in the arguments and insert the formula.'} Use =A1 to reference a cell.`}>
      <FunctionArguments key={initialFunction} functionName={initialFunction} target={insertTarget?.getA1Notation()??'the selected cell'} onInsert={formula=>{insertTarget?.setValue({f:formula});setHelp(false);}}/>
    </Dialog>
    <Dialog open={Boolean(plan)} onOpenChange={open=>{if(!busy&&!open)setPlan(null);}} title="Review exact execution" description="Each action is a separate wallet request. A confirmed proposal or vote is not a completed payment. Changes require a new review.">
      {plan?.operations.map(op=><section className="operation-preview" key={op.id}>
        <h3>{op.kind === 'SPUTNIK_VOTE' ? 'Sputnik vote' : `${op.kind.replace('SPUTNIK_','').replace('INTENTS_','')} · ${op.amount} ${op.asset} → ${op.recipient}`}</h3>
        <dl><dt>Source DAO</dt><dd>{op.source}</dd><dt>Network / signer</dt><dd>{op.network} / {plan.account}</dd>
          <dt>Exact base units</dt><dd>{op.baseUnits || 'Not applicable'}</dd>
          <dt>Gas / deposit (yoctoNEAR)</dt><dd>{op.transaction.actions[0]?.params.gas} / {op.transaction.actions[0]?.params.deposit}</dd>
          <dt>Network fee</dt><dd>Variable; wallet displays the transaction fee.</dd>
        </dl>{op.intents && <><p>1Click route {op.intents.providerId} · expires {op.intents.expiresAt}. Refunds return to {op.intents.input.refundTo}. Output: {op.intents.input.destinationAsset} on {op.intents.input.destinationChain}; slippage {op.intents.input.slippageTolerance} bps.</p><p>Expired quotes require a new proposal. Sputnik transfers do not enforce quote deadlines on chain; do not approve an expired deposit from another client.</p><details><summary>Exact quote, limits and route</summary><pre>{JSON.stringify(op.intents,null,2)}</pre></details></>}
        <details><summary>Actual contract call</summary><pre>{JSON.stringify(op.transaction,null,2)}</pre></details>
      </section>)}
      {error && <ProblemNotice problem={error}/>}
      <button disabled={busy} onClick={async()=>{
        const current = session();if(!plan||!current?.tableRuntime)return;
        setBusy(true);setError(null);
        try {
          await executePlan({plan,wallet,runtime:current.tableRuntime,snapshot:()=>current.saveSnapshot(),journal:()=>workspace.getState().document?.executions ?? {},record:record=>workspace.recordExecution(record,owner ?? undefined)});
          current.tableRuntime.executions = workspace.getState().document?.executions ?? {};
          current.univerAPI.getFormula().executeCalculation();
          const unsuccessful=plan.operations.map(op=>current.tableRuntime!.executions[op.id]).find(record=>record && record.state!=='confirmed');
          if(unsuccessful)setError(executionProblem(unsuccessful));
          setPlan(null);
        } catch(cause){setError(toProblem(cause));}
        finally{setBusy(false);}
      }}>{busy ? 'Waiting for wallet…' : 'Sign reviewed actions'}</button>
    </Dialog>
    {error&&!plan&&!inspect&&<Dialog open={Boolean(error)} onOpenChange={open=>{if(!open)setError(null);}} title="Operation needs attention" description="Resolve the issue below before continuing."><ProblemNotice problem={error}/></Dialog>}
  </>;
}
