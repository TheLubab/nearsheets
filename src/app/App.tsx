import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../components/ui/dialog';
import { Wallet } from 'lucide-react';
import { env } from '../config/env';
import { createDocumentWorkspace } from '../features/documents/application/document-workspace';
import { useWorkspaceState } from '../features/documents/application/use-workspace-state';
import { DocumentBar } from '../features/documents/components/DocumentBar';
import { DexieDocumentRepository } from '../features/documents/repository/dexie-document-repository';
import { WorkbookEditor } from '../features/spreadsheet/components/WorkbookEditor';
import { TableActions } from '../features/table/TableActions';
import { useWalletState } from '../features/wallet/application/use-wallet-state';
import { WalletPanel } from '../features/wallet/components/WalletPanel';
import type { WorkbookSession } from '../features/spreadsheet/univer/create-workbook-session';
import { useIntegrations } from './app-providers';

export function App() {
  const [repository] = useState(()=>new DexieDocumentRepository());
  const [workspace] = useState(()=>createDocumentWorkspace({repository,treasury:{network:env.VITE_NEAR_NETWORK,accountId:null}}));
  const state = useWorkspaceState(workspace);
  const {wallet} = useIntegrations();
  const walletState = useWalletState(wallet);
  const [accountOpen,setAccountOpen]=useState(false);
  const [readyEditor,setReadyEditor]=useState<{documentId:string;session:WorkbookSession}|null>(null);
  const activeSession=readyEditor?.documentId===state.document?.documentId?readyEditor?.session??null:null;
  const generation = useRef(0);
  useEffect(()=>{
    const mounted = ++generation.current;
    void workspace.start();
    return ()=>{
      void workspace.flush();
      queueMicrotask(()=>{
        if(generation.current === mounted) {workspace.dispose();repository.close();}
      });
    };
  },[workspace,repository]);
  useEffect(()=>{
    const flush = ()=>{void workspace.flush();};
    const visibility = ()=>{if(document.visibilityState === 'hidden')flush();};
    window.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);};
  },[workspace]);
  useEffect(() => {
    const runtime = workspace.getSession()?.tableRuntime;
    if (runtime && state.document) runtime.executions = state.document.executions;
  }, [workspace,state.document]);
  return <div className="app-shell">
    <TableActions key={state.document?.documentId} workspace={workspace} wallet={wallet} activeSession={activeSession}>
    <header className="app-shell__header">
      <h1 className="brand" title="NearSheets"><img className="brand__mark" src={`${import.meta.env.BASE_URL}near-sheets-mark.svg`} width={32} height={27} alt=""/><span>NearSheets</span></h1>
      <DocumentBar workspace={workspace} state={state}/>
      <button className="account-control" onClick={()=>setAccountOpen(true)}><Wallet size={15}/>{walletState.connection?.accountId ?? 'Connect wallet'}</button>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen} title="Account" description="Connect a wallet to sign reviewed actions. You can read data and edit local workbooks without connecting."><WalletPanel wallet={wallet} state={walletState}/></Dialog>
    </header>
    <main className="app-shell__main">
      {state.status === 'ready' && state.document ? <WorkbookEditor key={state.document.documentId} documentId={state.document.documentId} initialWorkbook={state.document.workbook} executions={state.document.executions} onSessionReady={(session,id)=>{workspace.attachSession(session,id);setReadyEditor({documentId:id,session});}}/> :
        <div className="workbook-status" role="status">{state.status === 'error' ? state.notice?.message : 'Opening documents…'}</div>}
    </main>
    </TableActions>
  </div>;
}
