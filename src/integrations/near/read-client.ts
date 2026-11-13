import {JsonRpcProvider} from 'near-api-js';
import {RpcError} from 'near-api-js/rpc-errors';
import {env,type AppEnv} from '../../config/env';
import {boundedRead} from '../http/request';
import {defaultRpcUrl,type NearNetwork} from './network';

const FALLBACK_RPC:Record<NearNetwork,string>={mainnet:'https://free.rpc.fastnear.com',testnet:'https://test.rpc.fastnear.com'};
const COOLDOWN_MS=30_000;
const ATTEMPT_TIMEOUT_MS=6000;

/** Fetch/CORS failures hide their HTTP status in browsers. Never fail over on contract errors. */
export function transientRpcFailure(cause:unknown):boolean {
  if(!(cause instanceof Error) || cause instanceof RpcError)return false;
  if(cause.name==='TimeoutError')return true;
  const status='cause' in cause ? cause.cause : undefined;
  if(typeof status==='number' && [408,429,500,502,503,504].includes(status))return true;
  return /failed to fetch|fetch failed|networkerror|network error|load failed|failed to load/i.test(cause.message);
}

/** Shared by endpoint, across workbooks. Limits both overlap and request start bursts. */
export class RpcReadQueue {
  private active=0;
  private nextStart=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private jobs:Array<{start:()=>void;cancel:()=>void}>=[];
  constructor(private readonly concurrency=3,private readonly interval=250) {}
  run<T>(read:()=>Promise<T>,signal?:AbortSignal):Promise<T> {
    return new Promise((resolve,reject)=>{
      const remove=()=>signal?.removeEventListener('abort',abort);
      const job={start:()=>{
        remove();this.active++;this.nextStart=Date.now()+this.interval;
        // The read owns in-flight timeout/cancellation; queued cancellation never dispatches it.
        void Promise.resolve().then(read).then(resolve,reject).finally(()=>{this.active--;this.drain();});
      },cancel:()=>{remove();reject(signal?.reason ?? new DOMException('Read cancelled','AbortError'));}};
      const abort=()=>{const index=this.jobs.indexOf(job);if(index>=0){this.jobs.splice(index,1);job.cancel();this.drain();}};
      if(signal?.aborted){job.cancel();return;}
      signal?.addEventListener('abort',abort,{once:true});this.jobs.push(job);this.drain();
    });
  }
  private drain() {
    if(this.timer!==undefined){clearTimeout(this.timer);this.timer=undefined;}
    if(!this.jobs.length || this.active>=this.concurrency)return;
    const delay=this.nextStart-Date.now();
    if(delay>0){this.timer=setTimeout(()=>{this.timer=undefined;this.drain();},delay);return;}
    this.jobs.shift()!.start();this.drain();
  }
}

class CoolingEndpoint extends Error {}
interface Endpoint {queue:RpcReadQueue;cooldownUntil:number}

/** Only read-only operations enter this client; wallet submission has no fallback path. */
export class NearReadClient {
  private endpoints=new Map<string,Endpoint>();
  constructor(private readonly config:AppEnv=env) {}
  private endpoint(url:string) {
    let endpoint=this.endpoints.get(url);
    if(!endpoint){endpoint={queue:new RpcReadQueue(),cooldownUntil:0};this.endpoints.set(url,endpoint);}
    return endpoint;
  }
  async read<T>(network:NearNetwork,read:(provider:JsonRpcProvider)=>Promise<T>,signal?:AbortSignal):Promise<T> {
    const custom=this.config.VITE_NEAR_RPC_URL && network===this.config.VITE_NEAR_NETWORK;
    const urls=custom?[this.config.VITE_NEAR_RPC_URL!]:[defaultRpcUrl(network),FALLBACK_RPC[network]];
    const ready=urls.filter(url=>this.endpoint(url).cooldownUntil<=Date.now());
    // An explicit refresh can probe again if every endpoint was unavailable.
    const candidates=ready.length?ready:urls;
    let failure:unknown;
    for(const url of candidates) {
      signal?.throwIfAborted();
      const endpoint=this.endpoint(url);
      try {
        const value=await endpoint.queue.run(()=>{
          if(endpoint.cooldownUntil>Date.now() && candidates.some(other=>other!==url && this.endpoint(other).cooldownUntil<=Date.now()))throw new CoolingEndpoint('RPC endpoint is cooling down.');
          return boundedRead(()=>read(new JsonRpcProvider({url},{retries:1})),signal,ATTEMPT_TIMEOUT_MS);
        },signal);
        endpoint.cooldownUntil=0;return value;
      }catch(cause){
        signal?.throwIfAborted();
        if(!(cause instanceof CoolingEndpoint) && !transientRpcFailure(cause))throw cause;
        failure=cause;endpoint.cooldownUntil=Date.now()+COOLDOWN_MS;
      }
    }
    throw failure;
  }
}

export const nearReadClient=new NearReadClient();
