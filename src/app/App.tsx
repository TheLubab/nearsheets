import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../components/ui/dialog';
import { Toaster } from '../components/ui/sonner';
import { loadingToast, TOAST_IDS } from '../components/ui/toast';
import { WalletIcon } from '@solar-icons/react/linear/wallet';
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
import { TemplateDialogs } from '../features/templates/TemplateDialogs';
import { createWelcomePreference } from '../features/templates/welcome-preference';
import { HelpMenu } from './HelpMenu';

export function App() {
  const [repository] = useState(()=>new DexieDocumentRepository());
  const [workspace] = useState(()=>createDocumentWorkspace({repository,treasury:{network:env.VITE_NEAR_NETWORK,accountId:null}}));
  const state = useWorkspaceState(workspace);
  const {wallet} = useIntegrations();
  const walletState = useWalletState(wallet);
  const [failedWalletIcon, setFailedWalletIcon] = useState<string | null>(null);
  const [accountOpen,setAccountOpen]=useState(false);
  const [readyEditor,setReadyEditor]=useState<{documentId:string;session:WorkbookSession}|null>(null);
  const activeSession=readyEditor?.documentId===state.document?.documentId?readyEditor?.session??null:null;
  const [welcomePreference] = useState(() => createWelcomePreference());
  const [templateView, setTemplateView] = useState<'welcome' | 'templates' | null>(null);
  const welcomeConsidered = useRef(false);
  useEffect(() => {
    // Shown as soon as the workspace knows this is a new, saveable one. Gating
    // on the editor session too would hold the welcome back until Univer has
    // mounted and reached its steady stage, which is the slowest startup step
    // and has nothing to do with whether the intro should appear.
    if (welcomeConsidered.current || state.status !== 'ready') return;
    welcomeConsidered.current = true;
    if (state.isNewWorkspace && state.saveStatus !== 'error' && !welcomePreference.isDismissed()) setTemplateView('welcome');
  }, [state.status, state.isNewWorkspace, state.saveStatus, welcomePreference]);
  const changeTemplateView = (view: 'welcome' | 'templates' | null) => {
    if (templateView === 'welcome') welcomePreference.dismiss();
    setTemplateView(view);
  };
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
  useEffect(() => {
    // Document loading is a toast, not a centred placeholder. A fatal error
    // still renders in the canvas because there is nothing else to show.
    if (state.status !== 'loading') {
      return;
    }
    return loadingToast(TOAST_IDS.documents, 'Opening documents…');
  }, [state.status]);
  return <div className="app-shell">
    <TableActions key={state.document?.documentId} workspace={workspace} wallet={wallet} activeSession={activeSession}>
    <header className="app-shell__header">
      <h1 className="brand" title="NearSheets"><img className="brand__mark" src={`${import.meta.env.BASE_URL}near-sheets-mark.svg`} width={32} height={27} alt=""/><span>NearSheets</span></h1>
      <DocumentBar workspace={workspace} state={state} ribbonMenu={state.status === 'ready' && !!state.document} onTemplates={() => changeTemplateView('templates')} onWelcome={() => setTemplateView('welcome')}/>
      <HelpMenu/>
      <button type="button" className={`account-control ${walletState.connection ? 'account-control--connected' : 'account-control--connect'}`} onClick={()=>{wallet.clearFeedback();setAccountOpen(true);}} aria-label={walletState.connection ? `Wallet account ${walletState.connection.accountId}` : 'Sign In'} title={walletState.connection?.accountId}>
        {walletState.connection ? <span className="account-control__wallet-icon" aria-hidden="true">{walletState.connection.walletIcon && walletState.connection.walletIcon !== failedWalletIcon ? <img src={walletState.connection.walletIcon} alt="" onError={() => setFailedWalletIcon(walletState.connection?.walletIcon ?? null)}/> : <WalletIcon size={20}/>}</span> : null}
        <span>{walletState.connection?.accountId ?? (walletState.status === 'connecting' ? 'Connecting…' : 'Sign In')}</span>
      </button>
      <Dialog className="account-dialog" open={accountOpen} onOpenChange={open=>{if(!open)wallet.clearFeedback();setAccountOpen(open);}} title={walletState.connection ? 'Your account' : 'Continue with'} showClose={false} suspendModal={walletState.status === 'connecting'} initialFocusContent><WalletPanel wallet={wallet} state={walletState}/></Dialog>
    </header>
    <main className="app-shell__main">
      {state.status === 'ready' && state.document ? <WorkbookEditor key={state.document.documentId} documentId={state.document.documentId} initialWorkbook={state.document.workbook} executions={state.document.executions} onSessionReady={(session,id)=>{workspace.attachSession(session,id);setReadyEditor({documentId:id,session});}}/> : null}
      {state.status === 'error' ? <div className="workbook-status" role="alert">{state.notice?.message ?? 'Documents could not be opened.'}</div> : null}
    </main>
    </TableActions>
    <TemplateDialogs workspace={workspace} view={templateView} onViewChange={changeTemplateView}/>
    <Toaster/>
  </div>;
}
