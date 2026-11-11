import { env } from '../../config/env';
import { OneClick } from '../../integrations/intents/one-click';
import type { QuoteInput } from '../../integrations/intents/one-click';
import type { ExecutionJournal } from './execution';
import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { NearNetwork } from '../../integrations/near/network';
import { createNearProvider } from '../../integrations/near/client';
import { amountFromBaseUnits, parseExactAmount } from '../treasury/model/exact-amount';
import { checkNearAccountId } from '../treasury/model/near-account';
import type { WalletTransaction } from '../../integrations/wallet/gateway';

export type CellValue = string | number | boolean | null;
export type TableResult = CellValue | CellValue[][];
/** Univer's facade parses numeric-looking strings unless explicitly quoted. */
export function formulaResult(value: TableResult): TableResult {
  const encode = (cell:CellValue):CellValue => typeof cell === 'string' ? '"' + cell.replaceAll('"','""') + '"' : cell;
  return Array.isArray(value) ? value.map(row=>row.map(encode)) : encode(value);
}
export interface Operation {
  id: string;
  revision: string;
  kind: string;
  network: NearNetwork;
  source: string;
  recipient: string;
  asset: string;
  decimals: number;
  amount: string;
  baseUnits: string;
  transaction: WalletTransaction;
  policy?: unknown;
  proposal?: unknown;
  intents?: {input:QuoteInput; stage:'estimated'|'prepared'; quote:unknown; expiresAt:string; depositAddress?:string; providerId:string};
}
export interface ReadEvidence { network: NearNetwork; fetchedAt: string; value: unknown }
export interface TablePorts {
  view(network: NearNetwork, contract: string, method: string, args: Record<string, unknown>): Promise<unknown>;
  transaction?(network: NearNetwork, hash: string, signer: string): Promise<unknown>;
  balance(network: NearNetwork, account: string): Promise<string>;
}
export const rpcPorts: TablePorts = {
  transaction: (network,txHash,accountId) => createNearProvider(undefined,network).viewTransactionStatus({txHash,accountId,waitUntil:'FINAL'}),
  view: (network, contractId, method, args) => createNearProvider(undefined, network).callFunction({contractId, method, args}),
  balance: async (network, accountId) => (await createNearProvider(undefined, network).viewAccount({accountId})).amount.toString(),
};
const networkSchema = z.enum(['mainnet', 'testnet']);
const metadataSchema = z.object({spec: z.literal('ft-1.0.0'), name: z.string(), symbol: z.string().min(1), decimals: z.number().int().min(0).max(24)});
const account = (value: unknown) => {
  const checked = checkNearAccountId(value);
  if (!checked.ok) throw new Error(checked.reason ?? "Invalid account.");
  return checked.accountId;
};
const text = (value: unknown) => String(value ?? '');
const jsonArgs = (value: unknown) => z.record(z.string(), z.unknown()).parse(JSON.parse(text(value)));
const scalar = (value: unknown): CellValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  return JSON.stringify(value);
};
const positiveAmount = (value: unknown, decimals: number) => {
  const parsed = parseExactAmount(value, decimals);
  if (!parsed.ok) throw new Error(parsed.message);
  if (parsed.amount.baseUnits === '0') throw new Error('An action amount must be positive.');
  return parsed.amount;
};
export const TABLE_FUNCTIONS = [
  ['SPUTNIK_CALL', 'reference, dao, contract, method, JSON args, gas units, attached NEAR, network', '=SPUTNIK_CALL("call-1","dao.sputnikv2.testnet","app.testnet","method","{}","50000000000000","0","testnet")'],
  ['SPUTNIK_STAKE', 'reference, dao, staking pool, exact NEAR amount, network', '=SPUTNIK_STAKE("stake-1","dao.sputnikv2.testnet","validator.pool.f863973.m0","1","testnet")'],
  ['INTENTS_SWAP', 'reference, dao, origin asset, output asset, exact amount, output chain, recipient, refund DAO, slippage bps, network', '=INTENTS_SWAP("swap-1","dao.sputnik-dao.near","nep141:wrap.near","output-asset-id","1","eth","0x0000000000000000000000000000000000000001","dao.sputnik-dao.near",100,"mainnet")'],
  ['INTENTS_QUOTE', 'origin asset ID, output asset ID, exact amount, output chain, recipient, refund address, slippage bps', '=INTENTS_QUOTE("origin-asset-id","output-asset-id","1","eth","0x0000000000000000000000000000000000000001","alice.near",100)'],
  ['NEAR_BALANCE', 'account, network', '=NEAR_BALANCE("alice.testnet","testnet")'],
  ['FT_BALANCE', 'token, account, network', '=FT_BALANCE("wrap.testnet","alice.testnet","testnet")'],
  ['NEAR_VIEW', 'contract, method, JSON arguments, network', '=NEAR_VIEW("dao.sputnikv2.testnet","get_last_proposal_id","{}","testnet")'],
  ['SPUTNIK_PROPOSALS', 'dao, network', '=SPUTNIK_PROPOSALS("dao.sputnikv2.testnet","testnet")'],
  ['SPUTNIK_TRANSFER', 'reference, dao, recipient, exact amount, asset (near or token contract), network', '=SPUTNIK_TRANSFER("invoice-1","dao.sputnikv2.testnet","alice.testnet","1.25","near","testnet")'],
  ['SPUTNIK_VOTE', 'reference, dao, proposal id, decision, network', '=SPUTNIK_VOTE("vote-1","dao.sputnikv2.testnet",0,"VoteApprove","testnet")'],
  ['INTENTS_STATUS', 'swap action cell', '=INTENTS_STATUS(A1)'],
  ['NS_RECEIPT', 'action cell', '=NS_RECEIPT(A1)'],
  ['NS_STATUS', 'action cell', '=NS_STATUS(A1)'],
  ['NS_FIELD', 'draft cell, field name', '=NS_FIELD(A1,"amount")'],
] as const;

/** One runtime per workbook. It has no signing capability. */
export class TableRuntime {
  executions: ExecutionJournal = {};
  calculating = true;
  readonly errors = new Map<string,string>();
  readonly operations = new Map<string, Operation>();
  readonly evidence = new Map<string, ReadEvidence>();
  private epoch = 0;
  private disposed = false;
  requestVersion() { return this.epoch; }
  accept(version:number) { if(this.disposed || this.epoch!==version)throw new Error('Read superseded. Refresh the cell.'); }
  constructor(readonly ports: TablePorts = rpcPorts, readonly query = new QueryClient(), readonly intents:OneClick|null = env.VITE_INTENTS_API_URL ? new OneClick(env.VITE_INTENTS_API_URL) : null) {}
  async read(network: NearNetwork, contract: string, method: string, args: Record<string, unknown> = {}) {
    const key = [network, contract, method, args];
    const epoch = this.epoch;
    const value = await this.query.fetchQuery({queryKey: key, staleTime: 30_000,
      queryFn: () => this.ports.view(network, contract, method, args)});
    if (this.disposed || epoch !== this.epoch) throw new Error('Read superseded. Recalculate.');
    this.evidence.set(JSON.stringify(key), {network, value, fetchedAt: new Date(this.query.getQueryState(key)?.dataUpdatedAt ?? Date.now()).toISOString()});
    return value;
  }
  async calculate(name: string, args: unknown[]): Promise<TableResult> {
    if (this.disposed) throw new Error('Workbook closed.');
    args=args.map(value=>Array.isArray(value)&&value.length===1&&Array.isArray(value[0])&&value[0].length===1?value[0][0]:value);
    const signature=TABLE_FUNCTIONS.find(entry=>entry[0]===name);
    if(!signature || args.length!==signature[1].split(',').length)throw new Error('Wrong argument count. Use the function argument hints.');
    if (name === 'INTENTS_STATUS' || name === 'NS_RECEIPT') {
      const op = this.operations.get(text(args[0]));
      if (!op) throw new Error('Recalculate the action cell first.');
      const record = this.executions[op.id];
      if (!record) return 'Not submitted';
      if (name === 'NS_RECEIPT') return [['Attempt state','Transaction','Signer','Recorded at'],[record.state,record.transactionHash,record.account,record.at]];
      const prior = JSON.parse(record.revision) as Operation;
      if (!prior.intents?.depositAddress) throw new Error('No prepared Intents deposit is recorded.');
      if (!this.intents) throw new Error('Intents is not configured.');
      const result = await this.intents.status(prior.intents.depositAddress);
      return [['Provider stage','Updated at','Details'],[result.status,result.updatedAt,JSON.stringify(result.swapDetails ?? {})]];
    }
    if (name === 'NS_STATUS') {
      const op = this.operations.get(text(args[0]));
      if (!op) throw new Error('Recalculate the action cell first.');
      const record = this.executions[op.id];
      if (!record) return 'Draft · not submitted';
      return record.state === 'confirmed' ? (op.kind !== 'SPUTNIK_VOTE' ? 'Proposal submitted · awaiting governance' : 'Vote confirmed') : record.state;
    }
    if (name === 'NS_FIELD') {
      const draft = this.operations.get(text(args[0]));
      if (!draft) throw new Error('Draft not available; recalculate the source cell.');
      const field = text(args[1]);
      if (!['amount','baseUnits','recipient','asset','source','network','kind'].includes(field)) throw new Error('Unknown draft field.');
      return scalar(draft[field as keyof Operation]);
    }
    if (name === 'INTENTS_QUOTE') {
      if (!this.intents) throw new Error('The Intents provider is not configured.');
      const input = {originAsset:text(args[0]),destinationAsset:text(args[1]),amount:text(args[2]),destinationChain:text(args[3]),recipient:text(args[4]),refundTo:text(args[5]),slippageTolerance:Number(args[6])};
      const quote = await this.query.fetchQuery({queryKey:['intents-estimate',input],staleTime:5000,queryFn:()=>this.intents!.estimate(input)});
      if (Date.parse(quote.response.quote.deadline) <= Date.now()) throw new Error('Quote expired. Refresh the estimate.');
      return [['Estimate · no funding instructions','Value'],['Input base units',quote.response.quote.amountIn],['Output base units',quote.response.quote.amountOut],['Minimum output base units',quote.response.quote.minAmountOut],['Expires',quote.response.quote.deadline],['Slippage (bps)',input.slippageTolerance],['Provider quote',quote.response.correlationId],['Fees','Included in provider output estimate; network fees additional']];
    }
    const network = networkSchema.parse(args.at(-1));
    if (name === 'NEAR_BALANCE') {
      const id = account(args[0]);
      const units = await this.query.fetchQuery({queryKey: [network,id,'balance'], staleTime:30_000, queryFn: () => this.ports.balance(network,id)});
      const amount = amountFromBaseUnits(units,24);
      if (!amount) throw new Error('Invalid native balance.');
      this.evidence.set(JSON.stringify([network,id,'balance']), {network, fetchedAt: new Date(this.query.getQueryState([network,id,'balance'])?.dataUpdatedAt ?? Date.now()).toISOString(), value: amount});
      return Number(amount.display);
    }
    if (name === 'FT_BALANCE') {
      const token = account(args[0]), owner = account(args[1]);
      const metadata = metadataSchema.parse(await this.read(network,token,'ft_metadata'));
      const units = z.string().regex(/^\d+$/).parse(await this.read(network,token,'ft_balance_of',{account_id:owner}));
      return Number(amountFromBaseUnits(units,metadata.decimals)!.display);
    }
    if (name === 'NEAR_VIEW') {
      const result = await this.read(network,account(args[0]),text(args[1]),jsonArgs(args[2]));
      if (Array.isArray(result)) {
        if (result.length === 0) return [['No records']];
        if (result.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
          const keys = [...new Set(result.flatMap(item => Object.keys(item)))].sort();
          return [keys, ...result.map(item => keys.map(key => scalar(item[key])))];
        }
        return result.map(item => [scalar(item)]);
      }
      if (result && typeof result === 'object') return Object.entries(result).map(([key,value]) => [key,scalar(value)]);
      return scalar(result);
    }
    if (name === 'SPUTNIK_PROPOSALS') {
      const dao = account(args[0]);
      const proposals = z.array(z.object({id:z.number().int(),description:z.string(),status:z.string(),proposer:z.string()})).parse(
        await this.read(network,dao,'get_proposals',{from_index:0,limit:100}));
      return [['ID','Description','Status','Proposer'],...proposals.map(p => [p.id,p.description,p.status,p.proposer])];
    }
    const reference = z.string().trim().min(1).max(64).parse(args[0]);
    const source = account(args[1]);
    const id = `${network}:${source}:${reference}`;
    const policy = await this.read(network,source,'get_policy');
    let recipient = '', asset = '', decimals = 0, amount = '', baseUnits = '';
    let method = '', callArgs: Record<string,unknown> = {}, deposit = '0';
    let proposalState: unknown;
    if (name === 'SPUTNIK_CALL' || name === 'SPUTNIK_STAKE') {
      recipient = account(args[2]);asset = 'near';decimals = 24;
      const isStake = name === 'SPUTNIK_STAKE';
      const targetMethod = isStake ? 'deposit_and_stake' : z.string().min(1).max(256).parse(args[3]);
      const targetArgs = isStake ? {} : jsonArgs(args[4]);
      const gas = isStake ? '100000000000000' : z.string().regex(/^\d+$/).parse(text(args[5]));
      if (BigInt(gas) <= 0n || BigInt(gas) > 250000000000000n) throw new Error('Target gas must be between 1 and 250 Tgas in gas units.');
      const parsed = parseExactAmount(isStake ? args[3] : args[6],24);
      if (!parsed.ok) throw new Error(parsed.message);
      ({display:amount,baseUnits} = parsed.amount);
      if(isStake) {
        positiveAmount(args[3],24);
        z.string().regex(/^\d+$/).parse(await this.read(network,recipient,'get_account_staked_balance',{account_id:source}));
      }
      const bond = z.object({proposal_bond:z.string().regex(/^\d+$/)}).parse(policy).proposal_bond;
      const bytes = new TextEncoder().encode(JSON.stringify(targetArgs));
      const encoded = btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
      const transaction:WalletTransaction = {receiverId:source,actions:[{type:'FunctionCall',params:{methodName:'add_proposal',args:{proposal:{description:`NearSheets ${reference}`,kind:{FunctionCall:{receiver_id:recipient,actions:[{method_name:targetMethod,args:encoded,gas,deposit:baseUnits}]}}}},gas:'200000000000000',deposit:bond}}]};
      const data = {id,kind:name,network,source,recipient,asset,decimals,amount,baseUnits,policy,transaction};
      const label = `Draft · ${isStake ? 'Stake' : targetMethod} · ${amount} NEAR → ${recipient} · ${source} · ${reference}`;
      this.operations.set(label,{...data,revision:JSON.stringify(data)});return label;
    }
    if (name === 'INTENTS_SWAP') {
      if (network !== 'mainnet') throw new Error('1Click has no testnet route.');
      if (!this.intents) throw new Error('The Intents provider is not configured.');
      const input:QuoteInput = {originAsset:text(args[2]),destinationAsset:text(args[3]),amount:text(args[4]),destinationChain:text(args[5]),recipient:text(args[6]),refundTo:account(args[7]),slippageTolerance:Number(args[8])};
      if (input.refundTo !== source) throw new Error('DAO-funded swaps must refund to the source DAO.');
      const estimate = await this.intents.estimate(input);
      if (estimate.origin.blockchain !== 'near' || !input.originAsset.startsWith('nep141:')) throw new Error('DAO funding currently supports NEAR fungible tokens only.');
      asset = account(input.originAsset.slice(7));
      const meta = metadataSchema.parse(await this.read(network,asset,'ft_metadata'));
      if (meta.decimals !== estimate.origin.decimals) throw new Error('Provider and NEAR token precision differ.');
      decimals = meta.decimals; recipient = input.recipient;
      ({display:amount,baseUnits} = positiveAmount(input.amount,decimals));
      const data = {id,kind:name,network,source,recipient,asset,decimals,amount,baseUnits,policy,
        transaction:{receiverId:source,actions:[]} as WalletTransaction,
        intents:{input,stage:'estimated' as const,quote:estimate.response,expiresAt:estimate.response.quote.deadline,providerId:estimate.response.correlationId}};
      const op = {...data,revision:JSON.stringify(data)};
      const label = `Swap draft · ${amount} ${asset} → ${recipient} · ${source} · ${reference}`;
      this.operations.set(label,op);return label;
    }
    if (name === 'SPUTNIK_TRANSFER') {
      recipient = account(args[2]); asset = text(args[4]);
      const meta = asset === 'near' ? {decimals:24} : metadataSchema.parse(await this.read(network,account(asset),'ft_metadata'));
      decimals = meta.decimals;
      ({display:amount,baseUnits} = positiveAmount(args[3],decimals));
      const bond = z.object({proposal_bond:z.string().regex(/^\d+$/)}).parse(policy).proposal_bond;
      method = 'add_proposal'; deposit = bond;
      callArgs = {proposal:{description:`NearSheets ${reference}`,kind:{Transfer:{token_id:asset === 'near' ? '' : asset,receiver_id:recipient,amount:baseUnits}}}};
    } else if (name === 'SPUTNIK_VOTE') {
      const proposalId = z.number().int().nonnegative().parse(args[2]);
      const action = z.enum(['VoteApprove','VoteReject','VoteRemove']).parse(args[3]);
      proposalState = await this.read(network,source,'get_proposal',{id:proposalId});
      z.object({status:z.literal('InProgress')}).parse(proposalState);
      checkRouteExpiry(proposalState,action);
      method = 'act_proposal'; callArgs = {id:proposalId,action};
    } else throw new Error('Unknown table function.');
    const transaction: WalletTransaction = {receiverId:source,actions:[{type:'FunctionCall',params:{methodName:method,args:callArgs,gas:'200000000000000',deposit}}]};
    const data = {id,kind:name,network,source,recipient,asset,decimals,amount,baseUnits,transaction,policy,proposal:proposalState};
    const operation: Operation = {...data,revision:JSON.stringify(data)};
    const label = `${name === 'SPUTNIK_TRANSFER' ? `Draft · ${amount} ${asset} → ${recipient}` : `Draft · ${text(args[3])} #${text(args[2])}`} · ${source} · ${network} · ${reference}`;
    this.operations.set(label,operation);
    return label;
  }
  /** Explicit preparation allocates a funding target; formulas cannot call this. */
  async prepare(op:Operation): Promise<Operation> {
    if (!op.intents) return op;
    if (this.executions[op.id] && !['cancelled','failed'].includes(this.executions[op.id]!.state)) throw new Error('This swap has an execution attempt. A replacement quote requires a new reference and proposal.');
    if (op.intents.stage === 'prepared' && Date.parse(op.intents.expiresAt) > Date.now()) return op;
    if (!this.intents) throw new Error('Intents is not configured.');
    const quote = await this.intents.prepare(op.intents.input);
    const depositAddress = account(quote.response.quote.depositAddress);
    const policy = z.object({proposal_bond:z.string().regex(/^\d+$/)}).parse(op.policy);
    const route = {...op.intents,stage:'prepared' as const,quote:quote.response,expiresAt:quote.response.quote.deadline,depositAddress,providerId:quote.response.correlationId};
    const description = 'NearSheets Intents ' + JSON.stringify({reference:op.id,expiresAt:route.expiresAt,recipient:op.recipient,input:route.input,quote:route.quote});
    const transaction:WalletTransaction = {receiverId:op.source,actions:[{type:'FunctionCall',params:{methodName:'add_proposal',args:{proposal:{description,kind:{Transfer:{token_id:op.asset,receiver_id:depositAddress,amount:op.baseUnits}}}},gas:'200000000000000',deposit:policy.proposal_bond}}]};
    const data = {...op,intents:route,transaction};
    const prepared = {...data,revision:JSON.stringify({...data,revision:undefined})};
    for (const [label,value] of this.operations) if(value.id===op.id && value.revision===op.revision)this.operations.set(label,prepared);
    return prepared;
  }
  refresh() { this.epoch++; this.operations.clear(); this.query.clear(); }
  dispose() { this.disposed = true; this.refresh(); }
}

export function checkRouteExpiry(proposal:unknown,action:string) {
  const data = z.object({description:z.string().optional()}).parse(proposal);
  if (action !== 'VoteApprove' || !data.description?.startsWith('NearSheets Intents ')) return;
  const route = z.object({expiresAt:z.iso.datetime()}).parse(JSON.parse(data.description.slice('NearSheets Intents '.length)));
  if (Date.parse(route.expiresAt) <= Date.now()) throw new Error('The approved route has expired. Remove the old proposal and prepare a new quote under a new reference.');
}
