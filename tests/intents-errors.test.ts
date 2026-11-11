import {describe,it,expect,vi} from 'vitest';
import {OneClick} from '../src/integrations/intents/one-click';
import {toProblem} from '../src/features/table/problems';

describe('provider error explanations',()=>{
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
