import { z } from 'zod';
import { checkNearAccountId } from '../../features/treasury/model/near-account';
import { parseExactAmount } from '../../features/treasury/model/exact-amount';
const tokenSchema = z.object({assetId:z.string(),decimals:z.number().int().min(0).max(24),blockchain:z.string(),symbol:z.string()});
const units = z.string().regex(/^\d+$/);
export const quoteSchema = z.object({correlationId:z.string(),timestamp:z.string(),quote:z.object({amountIn:units,amountOut:units,minAmountOut:units,deadline:z.iso.datetime(),timeEstimate:z.number(),depositAddress:z.string().optional()})});
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
  throw new Error(`Destination chain ${chain} has no verified address validator in NearSheets.`);
}
/** Public API only. Secret partner credentials require the unresolved server boundary. */
export class OneClick {
  constructor(readonly baseUrl:string,readonly request:typeof fetch=fetch) {}
  private async json(path:string,init?:RequestInit) {
    const response=await this.request(`${this.baseUrl.replace(/\/$/,'')}/v0/${path}`,init);
    if(!response.ok)throw new Error(`Intents request failed (${response.status}).`);
    return response.json() as Promise<unknown>;
  }
  async tokens(){return z.array(tokenSchema).parse(await this.json('tokens'));}
  async estimate(input:QuoteInput) { return this.quote(input,true); }
  async prepare(input:QuoteInput) { return this.quote(input,false); }
  private async quote(input:QuoteInput,dry:boolean) {
    const tokens=await this.tokens();
    const origin=tokens.find(t=>t.assetId===input.originAsset),destination=tokens.find(t=>t.assetId===input.destinationAsset && t.blockchain===input.destinationChain);
    if(!origin||!destination)throw new Error('Asset/chain is not supported by the current provider catalog.');
    const amount=parseExactAmount(input.amount,origin.decimals);
    if(!amount.ok)throw new Error(amount.message);
    if(amount.amount.baseUnits==='0')throw new Error('Quote input must be positive.');
    const recipient=validateAddress(destination.blockchain,input.recipient),refundTo=validateAddress(origin.blockchain,input.refundTo);
    const slippageTolerance=z.number().int().min(0).max(5000).parse(input.slippageTolerance);
    const body={dry,swapType:'EXACT_INPUT',originAsset:origin.assetId,destinationAsset:destination.assetId,amount:amount.amount.baseUnits,recipient,refundTo,slippageTolerance,depositType:'ORIGIN_CHAIN',recipientType:'DESTINATION_CHAIN',refundType:'ORIGIN_CHAIN'};
    const response=quoteSchema.parse(await this.json('quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
    if(dry && response.quote.depositAddress)throw new Error('Estimation unexpectedly returned funding instructions.');
    if(!dry && !response.quote.depositAddress)throw new Error('No deposit address was allocated.');
    if(response.quote.amountIn !== amount.amount.baseUnits)throw new Error('Provider changed the input amount.');
    if(Date.parse(response.quote.deadline)<=Date.now())throw new Error('The quote has expired. Request another estimate.');
    return {input:body,origin,destination,response};
  }
  async status(depositAddress:string,depositMemo?:string){
    const query=new URLSearchParams({depositAddress,...(depositMemo?{depositMemo}:{})});
    return z.object({correlationId:z.string(),status:z.enum(['PENDING_DEPOSIT','KNOWN_DEPOSIT_TX','PROCESSING','SUCCESS','INCOMPLETE_DEPOSIT','REFUNDED','FAILED']),updatedAt:z.string(),swapDetails:z.unknown().optional()}).parse(await this.json(`status?${query}`));
  }
}
