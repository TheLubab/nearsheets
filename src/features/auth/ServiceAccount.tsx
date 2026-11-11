import { useSyncExternalStore } from 'react';
import { useIntegrations } from '../../app/app-providers';
export function ServiceAccount() {
 const {auth,wallet}=useIntegrations();
 const state=useSyncExternalStore(auth.subscribe,auth.getState,auth.getState);
 const walletState=wallet.getState();
 if(state.status==='unavailable')return null;
 return <section className="service-account" aria-label="Service session">
  {state.status==='authenticated'?<><p>Service session: {state.session?.accountId} ({state.session?.network})</p><button onClick={()=>void auth.logout()}>Sign out of service</button></>:
   <><p>{state.status==='restoring'?'Restoring service session…':'Service session: signed out'}</p><button disabled={!walletState.connection || state.status==='authenticating'} onClick={()=>{if(walletState.connection)void auth.login(walletState.connection.accountId,walletState.network);}}>{state.status==='authenticating'?'Authorizing…':'Sign in to service'}</button></>}
  {state.error&&<p role="alert">{state.error}</p>}
 </section>;
}
