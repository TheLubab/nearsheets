import {afterEach,describe,it,expect,vi} from 'vitest';
import {OneClick} from '../src/integrations/intents/one-click';
import {toProblem} from '../src/features/table/problems';

describe('provider error explanations',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('calls browser fetch with its global receiver rather than the Intents instance',async()=>{
    const browserFetch=vi.fn(function(this:unknown){
      if(this!==globalThis)throw new TypeError('Illegal invocation');
      return Promise.resolve(new Response('[]'));
    });
    vi.stubGlobal('fetch',browserFetch);
    await expect(new OneClick('https://example.invalid').tokens()).resolves.toEqual([]);
    expect(browserFetch).toHaveBeenCalledWith('https://example.invalid/v0/tokens',undefined);
  });
  it('preserves the endpoint and underlying pre-network exception',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>{throw new TypeError('Illegal invocation');}));
    await expect(new OneClick('https://example.invalid').tokens()).rejects.toMatchObject({problem:{
      details:'GET https://example.invalid/v0/tokens\nTypeError: Illegal invocation',
    }});
  });
  it.each([400,429,503])('retains HTTP %s details with suitable recovery',async status=>{
    const request=vi.fn(async()=>new Response('Provider explanation',{status})) as unknown as typeof fetch;
    const service=new OneClick('https://example.invalid',request);
    let error:unknown;
    try {await service.tokens();}catch(cause){error=cause;}
    expect(toProblem(error)).toMatchObject({code:'service-failed',cellError:status===400?'#ERROR!':'#CONNECT!',details:'Provider explanation'});
    expect(toProblem(error).message).toContain(String(status));
  });
  it('explains a failed connection without inventing a provider rejection',async()=>{
    const request=vi.fn(async()=>{throw new TypeError('Failed to fetch');}) as unknown as typeof fetch;
    const service=new OneClick('https://example.invalid',request);
    await expect(service.tokens()).rejects.toMatchObject({problem:{code:'service-failed',cellError:'#CONNECT!'}});
  });
});
