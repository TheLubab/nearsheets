import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog } from '../components/ui/dialog';
import { Toaster } from '../components/ui/sonner';
import { WorkspaceLoading } from './WorkspaceLoading';
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
import { gettingStartedInterfaceSteps, startInterfaceTourWhenReady } from '../features/onboarding/interface-tour';
import { REPLAY_BLOCKCHAIN_TOUR_EVENT } from '../features/onboarding/blockchain-tour';

export function App() {
  const [repository] = useState(()=>new DexieDocumentRepository());
  const [workspace] = useState(()=>createDocumentWorkspace({repository,treasury:{network:env.VITE_NEAR_NETWORK,accountId:null}}));
  const state = useWorkspaceState(workspace);
  const {wallet} = useIntegrations();
  const walletState = useWalletState(wallet);
  const [failedWalletIcon, setFailedWalletIcon] = useState<string | null>(null);
  const [accountOpen,setAccountOpen]=useState(false);
  const [readyEditor,setReadyEditor]=useState<{documentId:string;session:WorkbookSession}|null>(null);
  const [startupComplete, setStartupComplete] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const activeSession=readyEditor?.documentId===state.document?.documentId?readyEditor?.session??null:null;
  const [welcomePreference] = useState(() => createWelcomePreference());
  const [welcomePending, setWelcomePending] = useState(() => !welcomePreference.isDismissed());
  const [templateView, setTemplateView] = useState<'welcome' | 'templates' | null>(null);
  const [guideDocumentId, setGuideDocumentId] = useState<string | null>(null);
  const [guideTransactionSheet, setGuideTransactionSheet] = useState<{ documentId: string; sheetId: string } | null>(null);
  const [guideRequested, setGuideRequested] = useState(false);
  const [guideRun, setGuideRun] = useState(0);
  const currentGuide = guideDocumentId === state.document?.documentId;
  const rememberGuide = (fromGettingStarted = false) => {
    const document = workspace.getState().document;
    if (!document) return;
    setGuideDocumentId(document.documentId);
    const transactionSheetId = document.workbook.sheetOrder[1];
    if (fromGettingStarted && transactionSheetId) setGuideTransactionSheet({ documentId: document.documentId, sheetId: transactionSheetId });
    setGuideRequested(true); setGuideRun(run => run + 1);
  };
  useEffect(() => {
    if (guideDocumentId && guideDocumentId !== state.document?.documentId) setGuideRequested(false);
  }, [guideDocumentId, state.document?.documentId]);
  useLayoutEffect(() => {
    if (!guideRequested || !currentGuide || state.status !== 'ready' || !activeSession || !startupComplete || templateView || accountOpen) return;
    const transactionSheetId = guideTransactionSheet?.documentId === state.document?.documentId ? guideTransactionSheet?.sheetId : undefined;
    return startInterfaceTourWhenReady({
      steps: gettingStartedInterfaceSteps(transactionSheetId),
      onStopped: () => setGuideRequested(false),
      onError: message => workspace.reportError(message),
    });
  }, [guideRequested, currentGuide, activeSession, startupComplete, templateView, accountOpen, guideRun, workspace, state.status, state.document?.documentId, guideTransactionSheet]);
  useLayoutEffect(() => {
    // Startup saves a blank workbook before the user chooses how to begin.
    // Reopening that workbook must not count as dismissing the welcome.
    // The modal covers the initializing editor; show it before editor readiness.
    // Resolve this before paint so startup messages do not flash before welcome.
    if (!welcomePending || state.status === 'loading') return;
    if (state.status === 'ready' && state.saveStatus !== 'error') setTemplateView('welcome');
    setWelcomePending(false);
  }, [state.status, state.saveStatus, welcomePending]);
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
  return <div className="app-shell">
    <TableActions key={state.document?.documentId} workspace={workspace} wallet={wallet} activeSession={activeSession}>
    <header className="app-shell__header" inert={!startupComplete} data-editor-ready={!!activeSession}>
      <h1 className="brand" title="NearSheets"><img className="brand__mark" src={`${import.meta.env.BASE_URL}near-sheets-mark.svg`} width={32} height={27} alt=""/><span>NearSheets</span></h1>
      <DocumentBar workspace={workspace} state={state} ribbonMenu={state.status === 'ready' && !!state.document} onTemplates={() => changeTemplateView('templates')} onWelcome={() => setTemplateView('welcome')}/>
      <HelpMenu onGettingStarted={() => { void workspace.createFromTemplate('getting-started').then(created => { if (created) rememberGuide(true); }); }}
        onInterfaceTour={state.status === 'ready' ? () => rememberGuide() : undefined}
        onBlockchainTour={activeSession ? () => window.dispatchEvent(new Event(REPLAY_BLOCKCHAIN_TOUR_EVENT)) : undefined}/>
      <button type="button" data-guide-wallet className={`account-control ${walletState.connection ? 'account-control--connected' : 'account-control--connect'}`} onClick={()=>{wallet.clearFeedback();setAccountOpen(true);}} aria-label={walletState.connection ? `Wallet account ${walletState.connection.accountId}` : 'Sign In'} title={walletState.connection?.accountId}>
        {walletState.connection ? <span className="account-control__wallet-icon" aria-hidden="true">{walletState.connection.walletIcon && walletState.connection.walletIcon !== failedWalletIcon ? <img src={walletState.connection.walletIcon} alt="" onError={() => setFailedWalletIcon(walletState.connection?.walletIcon ?? null)}/> : <WalletIcon size={20}/>}</span> : null}
        <span>{walletState.connection?.accountId ?? (walletState.status === 'connecting' ? 'Connecting…' : 'Sign In')}</span>
      </button>
      <Dialog className="account-dialog" open={accountOpen} onOpenChange={open=>{if(!open)wallet.clearFeedback();setAccountOpen(open);}} title={walletState.connection ? 'Your account' : 'Continue with'} showClose={false} suspendModal={walletState.status === 'connecting'} initialFocusContent><WalletPanel wallet={wallet} state={walletState}/></Dialog>
    </header>
    <main className="app-shell__main">
      {state.status === 'ready' && state.document ? <WorkbookEditor key={state.document.documentId} documentId={state.document.documentId} initialWorkbook={state.document.workbook} executions={state.document.executions} loadingCovered={!startupComplete || welcomePending || !!templateView}
        onStartupError={(error,id)=>{if(workspace.getState().document?.documentId===id)setStartupError(error);}}
        onSessionReady={(session,id)=>{
          if(workspace.getState().document?.documentId!==id)return;
          workspace.attachSession(session,id);
          setReadyEditor({documentId:id,session});
          setStartupError(null);
          setStartupComplete(true);
        }}/>:null}
      {!welcomePending && !templateView && <WorkspaceLoading active={!startupComplete} error={state.status === 'error' ? state.notice?.message ?? 'Documents could not be opened.' : startupError}/>}
      {startupComplete && state.status === 'error' && <WorkspaceLoading error={state.notice?.message ?? 'Documents could not be opened.'}/>}
    </main>
    </TableActions>
    <TemplateDialogs workspace={workspace} view={templateView} onViewChange={changeTemplateView} onGuideCreated={() => rememberGuide(true)}/>
    <Toaster/>
  </div>;
}
