import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Dialog } from '../components/ui/dialog';
import { Toaster } from '../components/ui/sonner';
import { WorkspaceLoading } from './WorkspaceLoading';
import { HomeTablePreview } from './HomeTablePreview';
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
import { browserNavigationHost, createSpreadsheetNavigation } from '../features/documents/application/spreadsheet-navigation';
import { SpreadsheetLinkError } from '../features/documents/components/SpreadsheetLinkError';
import { DocumentPicker } from '../features/documents/components/DocumentPicker';
import type { TemplateDialogView } from '../features/templates/TemplateDialogs';
import { TemplateDialogs } from '../features/templates/TemplateDialogs';
import { createWelcomePreference } from '../features/templates/welcome-preference';
import { HelpMenu } from './HelpMenu';
import { gettingStartedInterfaceSteps, startInterfaceTourWhenReady } from '../features/onboarding/interface-tour';
import { REPLAY_BLOCKCHAIN_TOUR_EVENT } from '../features/onboarding/blockchain-tour';

export function App() {
  const [repository] = useState(()=>new DexieDocumentRepository());
  const [workspace] = useState(()=>createDocumentWorkspace({repository,treasury:{network:env.VITE_NEAR_NETWORK,accountId:null}}));
  const state = useWorkspaceState(workspace);
  const [navigation] = useState(() => createSpreadsheetNavigation(workspace, browserNavigationHost()));
  const navigationState = useSyncExternalStore(navigation.subscribe, navigation.getState, navigation.getState);
  const {wallet} = useIntegrations();
  const walletState = useWalletState(wallet);
  const [failedWalletIcon, setFailedWalletIcon] = useState<string | null>(null);
  const [accountOpen,setAccountOpen]=useState(false);
  const [readyEditor,setReadyEditor]=useState<{documentId:string;session:WorkbookSession}|null>(null);
  const [startupComplete, setStartupComplete] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const activeSession=readyEditor?.documentId===state.document?.documentId && workspace.getSession()===readyEditor?.session?readyEditor?.session??null:null;
  const [welcomePreference] = useState(() => createWelcomePreference());
  const [welcomePending, setWelcomePending] = useState(() => !welcomePreference.isDismissed());
  const [templateView, setTemplateView] = useState<TemplateDialogView>(null);
  const [homePreviewReady, setHomePreviewReady] = useState(false);
  const showHomeBackdrop = navigationState.status === 'ready' && !state.document && templateView !== null;
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
    if (navigationState.status !== 'ready') return;
    setWelcomePending(false);
    if (!workspace.getState().document) setStartupComplete(true);
    if (navigationState.error) { setTemplateView(null); return; }
    if (navigationState.route.kind === 'home') {
      setTemplateView(view => workspace.getState().documentCount === 0 ? 'welcome' : view === 'templates' ? view : 'documents');
    } else setTemplateView(null);
  }, [navigationState, workspace]);
  useLayoutEffect(() => {
    if (navigationState.status === 'ready' && navigationState.route.kind === 'home' && !navigationState.error && state.documentCount === 0) {
      setTemplateView('welcome');
    }
  }, [state.documentCount, navigationState.status, navigationState.route.kind, navigationState.error]);
  const changeTemplateView = (view: TemplateDialogView) => {
    if (view === null && templateView === 'welcome' && !workspace.getState().document) return;
    if (templateView === 'welcome' || view === 'documents') welcomePreference.dismiss();
    if (view === 'documents' && navigationState.error) {
      void navigation.goHome().then(() => setTemplateView('documents'));
      return;
    }
    setTemplateView(view ?? (workspace.getState().document ? null : 'documents'));
  };
  const generation = useRef(0);
  useEffect(()=>{
    const mounted = ++generation.current;
    void navigation.start();
    return ()=>{
      void workspace.flush();
      queueMicrotask(()=>{
        if(generation.current === mounted) {navigation.dispose();workspace.dispose();repository.close();}
      });
    };
  },[workspace,repository,navigation]);
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
    {(navigationState.status !== 'ready' || !!state.document || showHomeBackdrop) && <header className="app-shell__header" inert={showHomeBackdrop || !startupComplete || navigationState.status !== 'ready'} aria-hidden={showHomeBackdrop || undefined} data-editor-ready={!!activeSession || (showHomeBackdrop && homePreviewReady)}>
      <h1 className="brand" title="NearSheets"><img className="brand__mark" src={`${import.meta.env.BASE_URL}near-sheets-mark.svg`} width={32} height={27} alt=""/><span>NearSheets</span></h1>
      <DocumentBar workspace={workspace} state={state} ribbonMenu={(state.status === 'ready' && !!state.document) || (showHomeBackdrop && homePreviewReady)} onWelcome={() => setTemplateView('welcome')} onDocuments={() => changeTemplateView('documents')}/>
      <HelpMenu onGettingStarted={() => { void workspace.createFromTemplate('getting-started').then(created => { if (created) rememberGuide(true); }); }}
        onInterfaceTour={activeSession ? () => rememberGuide() : undefined}
        onBlockchainTour={activeSession ? () => window.dispatchEvent(new Event(REPLAY_BLOCKCHAIN_TOUR_EVENT)) : undefined}/>
      <button type="button" data-guide-wallet className={`account-control ${walletState.connection ? 'account-control--connected' : 'account-control--connect'}`} onClick={()=>{wallet.clearFeedback();setAccountOpen(true);}} aria-label={walletState.connection ? `Wallet account ${walletState.connection.accountId}` : 'Sign In'} title={walletState.connection?.accountId}>
        {walletState.connection ? <span className="account-control__wallet-icon" aria-hidden="true">{walletState.connection.walletIcon && walletState.connection.walletIcon !== failedWalletIcon ? <img src={walletState.connection.walletIcon} alt="" onError={() => setFailedWalletIcon(walletState.connection?.walletIcon ?? null)}/> : <WalletIcon size={20}/>}</span> : null}
        <span>{walletState.connection?.accountId ?? (walletState.status === 'connecting' ? 'Connecting…' : 'Sign In')}</span>
      </button>
      <Dialog className="account-dialog" open={accountOpen} onOpenChange={open=>{if(!open)wallet.clearFeedback();setAccountOpen(open);}} title={walletState.connection ? 'Your account' : 'Continue with'} showClose={false} suspendModal={walletState.status === 'connecting'} initialFocusContent><WalletPanel wallet={wallet} state={walletState}/></Dialog>
    </header>}
    <main className="app-shell__main" inert={showHomeBackdrop || navigationState.status !== 'ready'}>
      {showHomeBackdrop && <HomeTablePreview onReady={setHomePreviewReady}/>}
      {state.status === 'ready' && state.document ? <WorkbookEditor key={state.document.documentId} documentId={state.document.documentId} initialWorkbook={state.document.workbook} executions={state.document.executions} loadingCovered={!startupComplete || welcomePending || !!templateView}
        onStartupError={(error,id)=>{if(workspace.getState().document?.documentId===id)setStartupError(error);}}
        onSessionReady={(session,id)=>{
          if(workspace.getState().document?.documentId!==id)return;
          workspace.attachSession(session,id);
          setReadyEditor({documentId:id,session});
          setStartupError(null);
          setStartupComplete(true);
        }}/>:null}
      {state.status === 'ready' && !state.document && !templateView && !navigationState.error && navigationState.status === 'ready' && <div className="spreadsheet-empty"><p>Open or create a spreadsheet to get started.</p><button onClick={() => changeTemplateView('documents')}>Spreadsheets manager</button></div>}
      {!welcomePending && !templateView && !navigationState.error && <WorkspaceLoading active={!startupComplete || navigationState.status === 'loading'} error={state.status === 'error' ? state.notice?.message ?? 'Documents could not be opened.' : startupError}/>}
      {startupComplete && state.status === 'error' && <WorkspaceLoading error={state.notice?.message ?? 'Documents could not be opened.'}/>}
    </main>
    </TableActions>
    <DocumentPicker workspace={workspace} onOpenDocument={navigation.openDocument} open={navigationState.status === 'ready' && templateView === 'documents'} onOpenChange={open => setTemplateView(open ? 'documents' : null)} onTemplates={() => changeTemplateView('templates')}/>
    <TemplateDialogs workspace={workspace} view={navigationState.status === 'ready' ? templateView : null} onViewChange={changeTemplateView} onGuideCreated={() => rememberGuide(true)}/>
    {navigationState.status === 'ready' && navigationState.error && <SpreadsheetLinkError workspace={workspace} error={navigationState.error} onHome={() => changeTemplateView('documents')}/>}
    <Toaster/>
  </div>;
}
