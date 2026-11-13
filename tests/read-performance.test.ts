import {afterEach,describe,expect,it,vi} from 'vitest';
import {TableRuntime} from '../src/features/table/runtime';
import {boundedRead,READ_TIMEOUT_MS} from '../src/integrations/http/request';
import {OneClick} from '../src/integrations/intents/one-click';

describe('read scheduling and lifetime',()=>{
  afterEach(()=>vi.useRealTimers());
  it('starts token balance and metadata together, then retains metadata across balance expiry',async()=>{
    let metadata!:(value:unknown)=>void;
    const view=vi.fn(async(_n:string,_c:string,method:string)=>method==='ft_metadata'?new Promise(resolve=>{metadata=resolve;}):'1000000');
    const runtime=new TableRuntime({view,balance:async()=> '0'},undefined,null);
    try {
      const pending=runtime.calculate('FT_BALANCE',['token.near','alice.near','mainnet']);
      expect(view.mock.calls.map(call=>call[2])).toEqual(['ft_metadata','ft_balance_of']);
      metadata({spec:'ft-1.0.0',name:'Token',symbol:'TOK',decimals:6});
      expect(await pending).toBe(1);
      vi.useFakeTimers();vi.setSystemTime(Date.now()+31_000);
      expect(await runtime.calculate('FT_BALANCE',['token.near','alice.near','mainnet'])).toBe(1);
      expect(view.mock.calls.filter(call=>call[2]==='ft_metadata')).toHaveLength(1);
      expect(view.mock.calls.filter(call=>call[2]==='ft_balance_of')).toHaveLength(2);
    }finally{runtime.dispose();}
  });
  it('refreshes a selected key without cancelling or superseding another pending read',async()=>{
    const pending=new Map<string,{resolve:(value:string)=>void;signal?:AbortSignal}>();
    const balance=vi.fn((_n:string,account:string,signal?:AbortSignal)=>new Promise<string>(resolve=>{pending.set(account,{resolve,signal});}));
    const runtime=new TableRuntime({view:async()=>null,balance},undefined,null);
    try {
      const selected=runtime.calculate('NEAR_BALANCE',['selected.near','mainnet']);
      const rejected=expect(selected).rejects.toThrow();
      const other=runtime.calculate('NEAR_BALANCE',['other.near','mainnet']);
      runtime.refresh(new Set([JSON.stringify(['mainnet','selected.near','balance'])]));
      expect(pending.get('selected.near')!.signal!.aborted).toBe(true);
      expect(pending.get('other.near')!.signal!.aborted).toBe(false);
      pending.get('other.near')!.resolve('2000000000000000000000000');
      expect(await other).toBe(2);await rejected;
      expect(await runtime.calculate('NEAR_BALANCE',['other.near','mainnet'])).toBe(2);
      expect(balance).toHaveBeenCalledTimes(2);
    }finally{runtime.dispose();}
  });
  it('times out reads even when a port ignores cancellation, and aborts on workbook disposal',async()=>{
    vi.useFakeTimers();let signal!:AbortSignal;
    const read=boundedRead(abort=>{signal=abort;return new Promise(()=>{});});
    const rejected=expect(read).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);await rejected;expect(signal.aborted).toBe(true);
    const runtime=new TableRuntime({view:async()=>null,balance:async(_n,_a,abort)=>{signal=abort!;return new Promise(()=>{});}},undefined,null);
    const pending=runtime.calculate('NEAR_BALANCE',['alice.near','mainnet']);
    const cancelled=expect(pending).rejects.toThrow();runtime.dispose();
    await cancelled;expect(signal.aborted).toBe(true);
  });
  it('deduplicates and caches the shared provider catalog, and retries after a failed catalog read',async()=>{
    let release!:(value:Response)=>void;
    const request=vi.fn<typeof fetch>(()=>new Promise(resolve=>{release=resolve;}));
    const api=new OneClick('https://provider.invalid',request);
    try {
      const a=api.tokens(),b=api.tokens();expect(request).toHaveBeenCalledTimes(1);
      release(new Response('[]'));expect(await a).toEqual([]);expect(await b).toEqual([]);
      await api.tokens();expect(request).toHaveBeenCalledTimes(1);
      api.clearCache();request.mockResolvedValueOnce(new Response('unavailable',{status:503}));
      await expect(api.tokens()).rejects.toThrow(/503/);
      request.mockResolvedValueOnce(new Response('[]'));await expect(api.tokens()).resolves.toEqual([]);
      expect(request).toHaveBeenCalledTimes(3);
    }finally{api.clearCache();}
  });
});
