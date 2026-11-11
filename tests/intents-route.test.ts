import { describe,expect,it,vi } from 'vitest';
import { OneClick,validateAddress } from '../src/integrations/intents/one-click';
import { checkRouteExpiry,TableRuntime } from '../src/features/table/runtime';
import { reviewPlan,executePlan } from '../src/features/table/execution';
import type { ExecutionJournal } from '../src/features/table/execution';
import type { WalletController } from '../src/features/wallet/application/wallet-controller';
const input={originAsset:'nep141:wrap.near',destinationAsset:'eth-usdc',amount:'1.000001',destinationChain:'eth',recipient:'0x0000000000000000000000000000000000000001',refundTo:'dao.near',slippageTolerance:100};
const quote={correlationId:'quote-1',timestamp:'2026-11-11T12:00:00Z',quote:{amountIn:'1000001',amountOut:'2000000',minAmountOut:'1980000',deadline:'2099-01-01T00:00:00Z',timeEstimate:30}};
function provider() {
 const requests: Array<{url:string;body?:Record<string,unknown>}>=[];
 const request=vi.fn<typeof fetch>(async (url,init)=>{
   const path=String(url);const body=init?.body?JSON.parse(String(init.body)):undefined;requests.push({url:path,body});
   let value: unknown;
   if(path.endsWith('/tokens'))value=[{assetId:'nep141:wrap.near',blockchain:'near',symbol:'wNEAR',decimals:6},{assetId:'eth-usdc',blockchain:'eth',symbol:'USDC',decimals:6}];
   else if(path.includes('/status'))value={correlationId:'quote-1',status:'REFUNDED',updatedAt:'2026-11-11T12:00:00Z',swapDetails:{refundedAmount:'1000001'}};
   else value={...quote,quote:{...quote.quote,...(body?.dry===false?{depositAddress:'deposit.near'}:{})}};
   return new Response(JSON.stringify(value),{status:200});
 });
 return {api:new OneClick('https://provider.invalid',request),request,requests};
}
describe('1Click estimation, explicit preparation and expiry',()=>{
 it('shows exact readable token quantities alongside the original quote base units',async()=>{
   const {api}=provider();
   const runtime=new TableRuntime({view:async()=>null,balance:async()=> '0'},undefined,api);
   const table=await runtime.calculate('INTENTS_QUOTE',[input.originAsset,input.destinationAsset,input.amount,input.destinationChain,input.recipient,input.refundTo,input.slippageTolerance]);
   expect(table).toContainEqual(['Input amount','1.000001','wNEAR']);
   expect(table).toContainEqual(['Output amount','2','USDC']);
   expect(table).toContainEqual(['Minimum output','1.98','USDC']);
   expect(table).toContainEqual(['Input base units','1000001','wNEAR']);
   expect(table).toContainEqual(['Output asset','eth-usdc','eth']);
   runtime.dispose();
 });
 it('runs a DAO swap from a table descriptor through reviewed proposal and refund tracking',async()=>{
   const {api,requests}=provider();
   const policy={proposal_bond:'100',roles:[{kind:{Group:['signer.near']},permissions:['*:AddProposal']}]};
   const runtime=new TableRuntime({view:async(_network,_contract,method)=>method==='get_policy'?policy:{spec:'ft-1.0.0',name:'Wrapped NEAR fixture',symbol:'wNEAR',decimals:6},balance:async()=> '0'},undefined,api);
   const label=String(await runtime.calculate('INTENTS_SWAP',['swap-1','dao.near',input.originAsset,input.destinationAsset,input.amount,'eth',input.recipient,'dao.near',100,'mainnet']));
   expect(requests.filter(request=>request.body?.dry===false)).toHaveLength(0);
   const prepared=await runtime.prepare(runtime.operations.get(label)!);
   expect(requests.filter(request=>request.body?.dry===false)).toHaveLength(1);
   const sign=vi.fn(async()=>({status:{SuccessValue:''},transaction:{hash:'hash'}}));
   const wallet={getState:()=>({status:'connected',network:'mainnet',connection:{accountId:'signer.near'}}),signAndSendTransaction:sign} as unknown as WalletController;
   const plan=reviewPlan([prepared],{},wallet),journal:ExecutionJournal={};
   await executePlan({plan,wallet,runtime,snapshot:()=>({}),journal:()=>journal,record:async record=>{journal[record.id]=record;}});
   expect(sign).toHaveBeenCalledWith(expect.objectContaining({receiverId:'dao.near'}));
   expect(JSON.stringify(prepared.transaction)).toContain('deposit.near');expect(JSON.stringify(prepared.transaction)).toContain('1000001');
   runtime.executions=journal;
   expect(await runtime.calculate('NS_STATUS',[label])).toMatch(/awaiting governance/);
   expect(await runtime.calculate('INTENTS_STATUS',[label])).toEqual([['Provider stage','Updated at','Details'],['REFUNDED','2026-11-11T12:00:00Z','{"refundedAmount":"1000001"}']]);
   await expect(runtime.prepare(prepared)).rejects.toThrow(/new reference/);
   expect(requests.filter(request=>request.body?.dry===false)).toHaveLength(1);runtime.dispose();
 });
 it('never allocates funding instructions from estimation, and binds exact units and addresses',async()=>{
   const {api,requests}=provider();const result=await api.estimate(input);
   expect(requests.at(-1)?.body).toMatchObject({dry:true,amount:'1000001',recipient:input.recipient,refundTo:'dao.near',slippageTolerance:100});
   expect(result.response.quote.depositAddress).toBeUndefined();
   const prepared=await api.prepare(input);
   expect(requests.at(-1)?.body?.dry).toBe(false);expect(prepared.response.quote.depositAddress).toBe('deposit.near');
 });
 it('rejects expired approval without requesting a replacement quote',()=>{
   const proposal={description:'NearSheets Intents '+JSON.stringify({expiresAt:'2020-01-01T00:00:00Z'})};
   expect(()=>checkRouteExpiry(proposal,'VoteApprove')).toThrow(/expired/);
   expect(()=>checkRouteExpiry(proposal,'VoteRemove')).not.toThrow();
 });
 it('retains refund outcomes separately from governance and settlement',async()=>{
   const {api,requests}=provider();const result=await api.status('deposit.near');
   expect(result.status).toBe('REFUNDED');expect(result.swapDetails).toEqual({refundedAmount:'1000001'});
   expect(requests[0]?.url).toContain('depositAddress=deposit.near');
 });
 it('validates destination chains and preserves case-sensitive Solana addresses',()=>{
   const sol='So11111111111111111111111111111111111111112';
   expect(validateAddress('sol',sol)).toBe(sol);
   expect(()=>validateAddress('eth','alice.near')).toThrow(/EVM/);
   expect(()=>validateAddress('sol','alice.near')).toThrow(/Solana/);
   expect(()=>validateAddress('unknown','whatever')).toThrow(/validator/);
 });
 it('rejects unknown assets, excessive precision and expired quotes',async()=>{
   const {api,request}=provider();
   await expect(api.estimate({...input,amount:'1.0000001'})).rejects.toThrow(/decimal/);
   await expect(api.estimate({...input,destinationAsset:'unknown'})).rejects.toThrow(/supported/);
   request.mockImplementation(async url=>new Response(JSON.stringify(String(url).endsWith('/tokens')?[{assetId:'nep141:wrap.near',blockchain:'near',symbol:'wNEAR',decimals:6},{assetId:'eth-usdc',blockchain:'eth',symbol:'USDC',decimals:6}]:{...quote,quote:{...quote.quote,deadline:'2020-01-01T00:00:00Z'}}),{status:200}));
   await expect(api.estimate(input)).rejects.toThrow(/expired/);
 });
});
