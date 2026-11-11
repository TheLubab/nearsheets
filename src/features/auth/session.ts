import { z } from 'zod';
import type { NearNetwork } from '../../integrations/near/network';
export const serviceSessionSchema=z.object({accountId:z.string().min(1),network:z.enum(['mainnet','testnet']),expiresAt:z.iso.datetime()});
export type ServiceSession=z.infer<typeof serviceSessionSchema>;
export interface AuthPorts {
  challenge(network:NearNetwork):Promise<{payload:string}>;
  authorize(payload:string,network:NearNetwork):Promise<{accountId:string;authorization:string}>;
  login(input:{accountId:string;authorization:string;network:NearNetwork}):Promise<ServiceSession>;
  me():Promise<ServiceSession|null>;
  logout():Promise<void>;
}
export interface AuthState {status:'unavailable'|'anonymous'|'restoring'|'authenticating'|'authenticated';session:ServiceSession|null;error:string|null}
/** Auth is server-verified cookie state, never a wallet/localStorage flag. */
export function createServiceAuth(ports:AuthPorts|null) {
 let state:AuthState={status:ports?'anonymous':'unavailable',session:null,error:null};
 let generation=0,disposed=false;
 const listeners=new Set<()=>void>();let expiry:ReturnType<typeof setTimeout>|undefined;
 const publish=(next:AuthState)=>{if(disposed)return;state=next;listeners.forEach(fn=>fn());};
 const accept=(session:ServiceSession|null)=>{
   clearTimeout(expiry);
   if(!session||Date.parse(session.expiresAt)<=Date.now()){publish({status:'anonymous',session:null,error:null});return;}
   publish({status:'authenticated',session,error:null});
   expiry=setTimeout(()=>{publish({status:'anonymous',session:null,error:'Service session expired. Sign in again.'});},Math.min(2147483647,Date.parse(session.expiresAt)-Date.now()));
 };
 return {
  getState:()=>state,
  subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
  restore:async()=>{
   if(!ports||disposed)return;const request=++generation;
   publish({status:'restoring',session:null,error:null});
   try{const result=await ports.me();if(request===generation)accept(result);}
   catch(cause){if(request===generation)publish({status:'anonymous',session:null,error:cause instanceof Error?cause.message:String(cause)});}
  },
  login:async(accountId:string,network:NearNetwork)=>{
   if(!ports||disposed)return;const request=++generation;
   publish({status:'authenticating',session:null,error:null});
   try {
    const {payload}=await ports.challenge(network);
    if(request!==generation)return;
    const authorized=await ports.authorize(payload,network);
    if(request!==generation)return;
    if(authorized.accountId!==accountId)throw new Error('The authorization account changed. Connect the intended account again.');
    const result=serviceSessionSchema.parse(await ports.login({...authorized,network}));
    if(request!==generation){await ports.logout();return;}
    if(result.accountId!==accountId||result.network!==network){await ports.logout();throw new Error('Backend session identity does not match the wallet.');}
    accept(result);
   } catch(cause){if(request===generation)publish({status:'anonymous',session:null,error:cause instanceof Error?cause.message:String(cause)});}
  },
  logout:async()=>{
   ++generation;clearTimeout(expiry);publish({status:ports?'anonymous':'unavailable',session:null,error:null});
   try{await ports?.logout();}catch{publish({...state,error:'Server logout failed; retry to revoke the service session.'});}
  },
  invalidate:()=>{++generation;clearTimeout(expiry);publish({status:ports?'anonymous':'unavailable',session:null,error:null});},
  dispose:()=>{disposed=true;++generation;clearTimeout(expiry);listeners.clear();},
 };
}
export function cookieAuthApi(base:string,authorize:AuthPorts['authorize'],request:typeof fetch=fetch):AuthPorts {
 const json=async(path:string,body?:unknown)=>{
  const response=await request(`${base.replace(/\/$/,'')}/auth/${path}`,{method:body===undefined?'GET':'POST',credentials:'include',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(response.status===401&&path==='me')return null;
  if(!response.ok)throw new Error(`Service authentication failed (${response.status}).`);
  return response.status===204?null:response.json();
 };
 return {authorize,challenge:async network=>z.object({payload:z.string().min(1)}).parse(await json('challenge',{network})),login:async input=>serviceSessionSchema.parse(await json('login',input)),me:async()=>{const value=await json('me');return value===null?null:serviceSessionSchema.parse(value);},logout:async()=>{await json('logout',{});}};
}
