import {readProblem} from '../src/features/table/problems';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {AccountDoesNotExistError,ContractExecutionError} from 'near-api-js/rpc-errors';
import {NearReadClient,RpcReadQueue} from '../src/integrations/near/read-client';
import {readEnv} from '../src/config/env';

describe('paced read-only RPC failover',()=>{
  beforeEach(()=>vi.useFakeTimers());
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
  it('paces request starts and bounds concurrent reads',async()=>{
    const queue=new RpcReadQueue();let active=0,maximum=0;
    const starts:number[]=[],release:Array<()=>void>=[];
    const jobs=Array.from({length:5},()=>queue.run(async()=>{
      starts.push(Date.now());maximum=Math.max(maximum,++active);
      await new Promise<void>(resolve=>release.push(resolve));active--;return true;
    }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(3);expect(maximum).toBe(3);
    expect(starts[1]!-starts[0]!).toBe(250);expect(starts[2]!-starts[1]!).toBe(250);
    release[0]!();await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(4);
    release[1]!();await vi.advanceTimersByTimeAsync(250);
    expect(starts).toHaveLength(5);expect(maximum).toBe(3);
    release.forEach(done=>done());await Promise.all(jobs);
  });
  it('removes an aborted queued read without dispatching it',async()=>{
    const queue=new RpcReadQueue(1),abort=new AbortController();let release!:()=>void;
    const first=queue.run(()=>new Promise<void>(resolve=>{release=resolve;}));
    const read=vi.fn(async()=>1),queued=queue.run(read,abort.signal);
    const cancelled=expect(queued).rejects.toMatchObject({name:'AbortError'});
    abort.abort();await cancelled;await vi.advanceTimersByTimeAsync(0);
    release();await first;await vi.advanceTimersByTimeAsync(1000);
    expect(read).not.toHaveBeenCalled();
  });
  it('handles the SDK HTTP 429 and uses the same-network fallback, then cools down the primary',async()=>{
    const fetch=vi.fn(async(url:RequestInfo|URL)=>String(url).includes('rpc.mainnet.near.org')
      ?new Response('Rate limited',{status:429})
      :new Response(JSON.stringify({jsonrpc:'2.0',id:'1',result:{amount:'10',locked:'0',code_hash:'11111111111111111111111111111111',storage_usage:0,block_height:1,block_hash:'block'}})));
    vi.stubGlobal('fetch',fetch);
    const client=new NearReadClient(readEnv({}));
    const account=await client.read('mainnet',provider=>provider.viewAccount({accountId:'alice.near'}));
    expect(account.amount.toString()).toBe('10');
    const next=client.read('mainnet',provider=>provider.viewAccount({accountId:'bob.near'}));
    await vi.advanceTimersByTimeAsync(250);await next;
    expect(fetch.mock.calls.map(call=>String(call[0]))).toEqual(['https://rpc.mainnet.near.org','https://free.rpc.fastnear.com','https://free.rpc.fastnear.com']);
  });
  it('recovers from a CORS-hidden network error without retrying every queued read on the failing endpoint',async()=>{
    const client=new NearReadClient(readEnv({}));
    const read=vi.fn(async(provider:import('near-api-js').JsonRpcProvider)=>{
      if(provider.connection.url.includes('rpc.mainnet.near.org'))throw new TypeError('NetworkError when attempting to fetch resource.');
      return 'balance';
    });
    const jobs=Array.from({length:4},()=>client.read('mainnet',read));
    await vi.advanceTimersByTimeAsync(2000);
    expect(await Promise.all(jobs)).toEqual(['balance','balance','balance','balance']);
    expect(read.mock.calls.filter(([provider])=>provider.connection.url.includes('rpc.mainnet.near.org'))).toHaveLength(1);
  });
  it.each([
    new AccountDoesNotExistError('missing.near','block',1),
    new ContractExecutionError('429: contract rejected the request','block',1),
    new SyntaxError('Malformed RPC response'),
  ])('does not mask permanent errors with provider retries',async failure=>{
    const client=new NearReadClient(readEnv({})),read=vi.fn(async()=>{throw failure;});
    await expect(client.read('mainnet',read)).rejects.toBe(failure);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('fails over on a bounded timeout, and never fails over on cancellation',async()=>{
    const client=new NearReadClient(readEnv({}));
    const read=vi.fn(async(provider:import('near-api-js').JsonRpcProvider)=>provider.connection.url.includes('rpc.testnet.near.org')?new Promise<number>(()=>{}):7);
    const result=client.read('testnet',read);
    await vi.advanceTimersByTimeAsync(6000);expect(await result).toBe(7);
    expect(read).toHaveBeenCalledTimes(2);
    const abort=new AbortController(),cancelled=client.read('mainnet',read,abort.signal);
    const rejected=expect(cancelled).rejects.toMatchObject({name:'AbortError'});
    abort.abort();await rejected;
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('stops after both providers fail and preserves a rate limit as a connection error',async()=>{
    const client=new NearReadClient(readEnv({}));
    const failure=new Error('Too many requests',{cause:429});
    const read=vi.fn(async()=>{throw failure;});
    await expect(client.read('mainnet',read)).rejects.toBe(failure);
    expect(read).toHaveBeenCalledTimes(2);
    expect(readProblem(failure,'mainnet','alice.near').problem.cellError).toBe('#CONNECT!');
  });

  it('keeps a configured custom endpoint authoritative and its network isolated',async()=>{
    const client=new NearReadClient(readEnv({VITE_NEAR_NETWORK:'mainnet',VITE_NEAR_RPC_URL:'https://private.invalid/rpc'}));
    const read=vi.fn(async()=>{throw new TypeError('Failed to fetch');});
    await expect(client.read('mainnet',read)).rejects.toThrow('Failed to fetch');
    expect(read).toHaveBeenCalledTimes(1);
    expect(await client.read('testnet',async provider=>provider.connection.url)).toBe('https://rpc.testnet.near.org');
  });
});
