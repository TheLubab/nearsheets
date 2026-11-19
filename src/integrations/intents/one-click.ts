import { QueryClient } from '@tanstack/react-query';
import { boundedRead } from '../http/request';
import { z } from 'zod';
import { checkNearAccountId } from '../../features/treasury/model/near-account';
import { parseExactAmount } from '../../features/treasury/model/exact-amount';
import { invalidInput, unavailable, serviceProblem, staleData } from '../../features/table/problems';
const tokenSchema = z.object({assetId:z.string(),decimals:z.number().int().min(0).max(24),blockchain:z.string(),symbol:z.string()});
const units = z.string().regex(/^\d+$/);
// Explicitly supply the provider's quote/deposit window on every fresh request.
const QUOTE_WINDOW_MS = 10 * 60 * 1000;
export const quoteSchema = z.object({correlationId:z.string(),timestamp:z.string(),quote:z.object({amountIn:units,amountOut:units,minAmountOut:units,deadline:z.iso.datetime().optional(),timeEstimate:z.number(),depositAddress:z.string().optional()})});
export const estimateEvidenceSchema = z.object({
  origin: tokenSchema,
  destination: tokenSchema,
  response: quoteSchema,
  expiresAt: z.iso.datetime(),
  expirySource: z.enum(['provider', 'request']),
});
export const statusSchema = z.object({correlationId:z.string(),status:z.enum(['PENDING_DEPOSIT','KNOWN_DEPOSIT_TX','PROCESSING','SUCCESS','INCOMPLETE_DEPOSIT','REFUNDED','FAILED']),updatedAt:z.string(),swapDetails:z.unknown().optional()});
export interface QuoteInput { originAsset:string; destinationAsset:string; amount:string; destinationChain:string; recipient:string; refundTo:string; slippageTolerance:number }
export function validateAddress(chain:string,address:string): string {
  if (chain === 'near') {
    const checked=checkNearAccountId(address);if(!checked.ok)throw new Error(checked.reason ?? 'Invalid NEAR address.');return checked.accountId;
  }
  if (['eth','base','arb','bsc','pol','op','avax'].includes(chain)) {
    if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw new Error('Invalid EVM address.');return address;
  }
  if(chain === 'sol') {
    const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let decoded=0n;
    for(const char of address){const digit=alphabet.indexOf(char);if(digit<0)throw new Error('Invalid Solana address.');decoded=decoded*58n+BigInt(digit);}
    let bytes=0;while(decoded>0n){bytes++;decoded>>=8n;}
    const leading=address.match(/^1*/)?.[0].length ?? 0;
    if(bytes+leading!==32)throw new Error('Solana address must encode 32 bytes.');return address;
  }
  throw unavailable(`Destination chain ${chain} has no verified address validator in NearSheets.`);
}
/** Public API only. Secret partner credentials require the unresolved server boundary. */
export class OneClick {
  private catalog=new QueryClient();
  clearCache(){this.catalog.clear();}
  constructor(readonly baseUrl:string,readonly request:typeof fetch=(input,init)=>globalThis.fetch(input,init)) {}
  private async json(path:string,init?:RequestInit,signal?:AbortSignal) {
    return boundedRead(async abort=>{
    let response:Response;
    const url=`${this.baseUrl.replace(/\/$/,'')}/v0/${path}`;
    try { response=await this.request(url,{...init,signal:abort}); }
    catch(cause) {
      const error=serviceProblem(cause,'Intents');
      error.problem.details=`${init?.method??'GET'} ${url}\n${cause instanceof Error?cause.name+': '+cause.message:String(cause)}`;
      throw error;
    }
    if(!response.ok)throw serviceProblem(await response.text(),'Intents',response.status);
    try { return await response.json() as unknown; }
    catch(cause) { throw serviceProblem(cause,'Intents',response.status); }
    },signal);
  }
  async tokens(){return this.catalog.fetchQuery({queryKey:['intents-tokens'],staleTime:300_000,retry:false,queryFn:async({signal})=>z.array(tokenSchema).parse(await this.json('tokens',undefined,signal))});}
  async estimate(input:QuoteInput,signal?:AbortSignal) { return this.quote(input,true,signal); }
  async prepare(input:QuoteInput) { return this.quote(input,false); }
  private async quote(input:QuoteInput,dry:boolean,signal?:AbortSignal) {
    const tokens=await this.tokens();
    const origin=tokens.find(t=>t.assetId===input.originAsset),destination=tokens.find(t=>t.assetId===input.destinationAsset && t.blockchain===input.destinationChain);
    if(!origin||!destination)throw unavailable('Asset/chain is not supported by the current provider catalog.');
    const amount=parseExactAmount(input.amount,origin.decimals);
    if(!amount.ok)throw invalidInput(amount.message);
    if(amount.amount.baseUnits==='0')throw invalidInput('Quote input must be positive.');
    const recipient=validateAddress(destination.blockchain,input.recipient),refundTo=validateAddress(origin.blockchain,input.refundTo);
    const slippageTolerance=z.number().int().min(0).max(5000).parse(input.slippageTolerance);
    const deadline=new Date(Date.now()+QUOTE_WINDOW_MS).toISOString();
    const body={dry,swapType:'EXACT_INPUT',originAsset:origin.assetId,destinationAsset:destination.assetId,amount:amount.amount.baseUnits,recipient,refundTo,slippageTolerance,depositType:'ORIGIN_CHAIN',recipientType:'DESTINATION_CHAIN',refundType:'ORIGIN_CHAIN',deadline};
    const response=quoteSchema.parse(await this.json('quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},signal));
    if(dry && response.quote.depositAddress)throw new Error('Estimation unexpectedly returned funding instructions.');
    if(!dry && !response.quote.depositAddress)throw new Error('No deposit address was allocated.');
    if(response.quote.amountIn !== amount.amount.baseUnits)throw new Error('Provider changed the input amount.');
    if(!dry&&!response.quote.deadline)throw unavailable('The prepared route has no provider deadline. Do not fund it; request a new route.');
    const expiresAt=response.quote.deadline??deadline;
    if(Date.parse(expiresAt)<=Date.now())throw staleData('The quote has expired. Request another estimate.');
    return {input:body,origin,destination,response,expiresAt,expirySource:response.quote.deadline?'provider' as const:'request' as const};
  }
  async status(depositAddress:string,depositMemo?:string,signal?:AbortSignal){
    const query=new URLSearchParams({depositAddress,...(depositMemo?{depositMemo}:{})});
    return statusSchema.parse(await this.json(`status?${query}`,undefined,signal));
  }
}
