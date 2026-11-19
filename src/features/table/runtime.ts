import { nearReadClient } from '../../integrations/near/read-client';
import { boundedRead } from '../../integrations/http/request';
import { ReadBindings } from './read-bindings';
import type { CalculationContext } from './read-bindings';
import { env } from '../../config/env';
import { estimateEvidenceSchema, OneClick, statusSchema } from '../../integrations/intents/one-click';
import type { QuoteInput } from '../../integrations/intents/one-click';
import type { ExecutionJournal } from './execution';
import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { NearNetwork } from '../../integrations/near/network';
import { createNearProvider } from '../../integrations/near/client';
import { amountFromBaseUnits, parseExactAmount } from '../treasury/model/exact-amount';
import { checkNearAccountId } from '../treasury/model/near-account';
import { CellDiagnostics } from './cell-diagnostics';
import { invalidInput, readProblem, unavailable, staleData } from './problems';
import type { WalletTransaction } from '../../integrations/wallet/gateway';

export type CellValue = string | number | boolean | null;
export type TableResult = CellValue | CellValue[][];
export interface Operation {
  id: string;
  revision: string;
  saved?: boolean;
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
export interface ReadEvidence {
  network: NearNetwork;
  fetchedAt: string;
  value: unknown;
  rawValue?: unknown;
  stale?: boolean;
  saved?: boolean;
}
export interface TablePorts {
  view(network: NearNetwork, contract: string, method: string, args: Record<string, unknown>, signal?:AbortSignal): Promise<unknown>;
  transaction?(network: NearNetwork, hash: string, signer: string): Promise<unknown>;
  balance(network: NearNetwork, account: string, signal?:AbortSignal): Promise<string>;
}
export const rpcPorts: TablePorts = {
  transaction: (network,txHash,accountId) => createNearProvider(undefined,network).viewTransactionStatus({txHash,accountId,waitUntil:'FINAL'}),
  view: (network, contractId, method, args, signal) => nearReadClient.read(network,provider=>provider.callFunction({contractId, method, args}),signal),
  balance: async (network, accountId, signal) => (await nearReadClient.read(network,provider=>provider.viewAccount({accountId}),signal)).amount.toString(),
};
const networkSchema = z.enum(['mainnet', 'testnet']);
const unitsSchema = z.string().regex(/^\d+$/);
const metadataSchema = z.object({spec: z.literal('ft-1.0.0'), name: z.string(), symbol: z.string().min(1), decimals: z.number().int().min(0).max(24)});
const account = (value: unknown) => {
  const checked = checkNearAccountId(value);
  if (!checked.ok) throw invalidInput(checked.reason ?? "Invalid account.", 'Use a valid NEAR account ID, and check the referenced cell.');
  return checked.accountId;
};
const text = (value: unknown) => String(value ?? '');
const jsonArgs = (value: unknown) => {
  let parsed:unknown;
  try { parsed=JSON.parse(text(value)); } catch { throw invalidInput('The JSON arguments could not be read.', 'Use a JSON object such as {} or {"account_id":"alice.near"}.'); }
  const checked=z.record(z.string(), z.unknown()).safeParse(parsed);
  if(!checked.success)throw invalidInput('Contract arguments must be a JSON object.', 'Use {} for a method without arguments.');
  return checked.data;
};
const scalar = (value: unknown): CellValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  return JSON.stringify(value);
};
const positiveAmount = (value: unknown, decimals: number) => {
  const parsed = parseExactAmount(value, decimals);
  if (!parsed.ok) throw invalidInput(parsed.message);
  if (parsed.amount.baseUnits === '0') throw invalidInput('An action amount must be positive.');
  return parsed.amount;
};
export { TABLE_FUNCTIONS } from './function-registry';
import { TABLE_FUNCTIONS } from './function-registry';

/** One runtime per workbook. It has no signing capability. */
export class TableRuntime {
  executions: ExecutionJournal = {};
  calculating = true;
  readonly bindings = new ReadBindings();
  readonly diagnostics = new CellDiagnostics();
  readonly operations = new Map<string, Operation>();
  readonly evidence = new Map<string, ReadEvidence>();
  private savedKeys = new Set<string>();
  private epoch = 0;
  private disposed = false;
  private keyVersions = new Map<string,number>();
  private refreshListeners = new Set<(keys?:ReadonlySet<string>,stopped?:boolean)=>void>();
  onRefresh(listener:(keys?:ReadonlySet<string>,stopped?:boolean)=>void) { this.refreshListeners.add(listener);return {dispose:()=>{this.refreshListeners.delete(listener);}}; }
  requestVersion() { return this.epoch; }
  accept(version:number) { if(this.disposed || this.epoch!==version)throw staleData('Read superseded. Refresh the cell.'); }
  constructor(readonly ports: TablePorts = rpcPorts, readonly query = new QueryClient(), readonly intents:OneClick|null = env.VITE_INTENTS_API_URL ? new OneClick(env.VITE_INTENTS_API_URL) : null) {}
  restoreReads(reads: ReadonlyMap<string, ReadEvidence>) {
    for (const [key, read] of reads) {
      this.evidence.set(key, read);
      this.savedKeys.add(key);
    }
  }
  async read(network: NearNetwork, contract: string, method: string, args: Record<string, unknown> = {}, context?: CalculationContext) {
    return this.cached([network, contract, method, args], signal => this.ports.view(network, contract, method, args, signal),
      method === 'ft_metadata' ? 300_000 : 30_000, z.unknown(), context)
      .catch(cause => { throw readProblem(cause, network, contract, method); });
  }
  private async cached<T>(key: readonly unknown[], queryFn: (signal: AbortSignal) => Promise<T>, staleTime: number, savedSchema: z.ZodType<T>, context?: CalculationContext): Promise<T> {
    const encodedKey = JSON.stringify(key);
    const version = this.epoch;
    this.accept(version);
    context?.keys.add(encodedKey);
    const saved = this.savedKeys.has(encodedKey) ? this.evidence.get(encodedKey) : undefined;
    if (context && saved) {
      const decoded = savedSchema.safeParse(saved.rawValue === undefined ? saved.value : saved.rawValue);
      if (decoded.success) {
        context.savedKeys.add(encodedKey);
        return decoded.data;
      }
      this.savedKeys.delete(encodedKey);
    }

    const keyVersion = this.keyVersions.get(encodedKey);
    const value = await this.query.fetchQuery({ queryKey: key, queryFn: ({ signal }) => boundedRead(queryFn, signal), staleTime, retry: false });
    this.accept(version);
    if (keyVersion !== this.keyVersions.get(encodedKey)) throw staleData('Read superseded. Refresh the cell.');
    // Live checks have their own cache; they must not relabel saved formula results.
    if (!saved || !this.savedKeys.has(encodedKey)) this.evidence.set(encodedKey, {
      network: key[0] === 'testnet' ? 'testnet' : 'mainnet',
      value,
      fetchedAt: new Date(this.query.getQueryState(key)?.dataUpdatedAt ?? Date.now()).toISOString(),
    });
    return value;
  }
  private recordBalance(key: readonly unknown[], units: string, value: unknown) {
    const encodedKey = JSON.stringify(key);
    const read = this.evidence.get(encodedKey);
    if (read && (read.rawValue ?? read.value) === units) {
      this.evidence.set(encodedKey, { ...read, rawValue: units, value });
    }
  }
  private intentsProvider() {
    if (!this.intents) throw unavailable('The Intents provider is not configured.');
    return this.intents;
  }
  private recordOperation(label: string, data: Omit<Operation, 'revision' | 'saved'>, context?: CalculationContext) {
    const operation = { ...data, revision: JSON.stringify(data) };
    this.operations.set(label, context?.savedKeys.size ? { ...operation, saved: true } : operation);
    return label;
  }
  async calculate(name:string,args:unknown[],context?:CalculationContext):Promise<TableResult> {
    const version=this.epoch;
    const result=await this.calculateValue(name,args,context);this.accept(version);
    if(context) {if(!this.bindings.current(context))throw staleData('Cell calculation superseded.');context.rows=Array.isArray(result)?result.length:1;context.columns=Array.isArray(result)?result[0]?.length??1:1;}
    return result;
  }
  private async calculateValue(name: string, args: unknown[], context?:CalculationContext): Promise<TableResult> {
    const version=this.epoch;
    const read=(network:NearNetwork,contract:string,method:string,args:Record<string,unknown>={})=>this.read(network,contract,method,args,context);
    const accept=()=>{this.accept(version);if(context&&!this.bindings.current(context))throw staleData('Cell calculation superseded.');};
    if (this.disposed) throw new Error('Spreadsheet closed.');
    args=args.map(value=>Array.isArray(value)&&value.length===1&&Array.isArray(value[0])&&value[0].length===1?value[0][0]:value);
    const signature=TABLE_FUNCTIONS.find(entry=>entry[0]===name);
    if(!signature || args.length!==signature[1].split(',').length)throw invalidInput('Wrong argument count.', 'Use the function argument hints to supply all required arguments.');
    if (name === 'INTENTS_STATUS' || name === 'NS_RECEIPT') {
      const op = this.operations.get(text(args[0]));
      if (!op) throw staleData('Recalculate the action cell first.');
      const record = this.executions[op.id];
      if (!record) return 'Not submitted';
      if (name === 'NS_RECEIPT') return [['Attempt state','Transaction','Signer','Recorded at'],[record.state,record.transactionHash,record.account,record.at]];
      const prior = JSON.parse(record.revision) as Operation;
      if (!prior.intents?.depositAddress) throw new Error('No prepared Intents deposit is recorded.');
      const depositAddress = prior.intents.depositAddress;
      const key = ['intents-status',depositAddress];
      const result = await this.cached(key,signal=>this.intentsProvider().status(depositAddress,undefined,signal),5000,statusSchema,context);
      return [[context?.savedKeys.has(JSON.stringify(key)) ? 'Saved provider stage' : 'Provider stage','Updated at','Details'],[result.status,result.updatedAt,JSON.stringify(result.swapDetails ?? {})]];
    }
    if (name === 'NS_STATUS') {
      const op = this.operations.get(text(args[0]));
      if (!op) throw staleData('Recalculate the action cell first.');
      const record = this.executions[op.id];
      if (!record) return 'Draft · not submitted';
      return record.state === 'confirmed' ? (op.kind !== 'SPUTNIK_VOTE' ? 'Proposal submitted · awaiting governance' : 'Vote confirmed') : record.state;
    }
    if (name === 'NS_FIELD') {
      const draft = this.operations.get(text(args[0]));
      if (!draft) throw staleData('Draft not available; recalculate the source cell.');
      const field = text(args[1]);
      if (!['amount','baseUnits','recipient','asset','source','network','kind'].includes(field)) throw invalidInput('Unknown draft field.', 'Use amount, baseUnits, recipient, asset, source, network or kind.');
      return scalar(draft[field as keyof Operation]);
    }
    if (name === 'INTENTS_QUOTE') {
      const input = {originAsset:text(args[0]),destinationAsset:text(args[1]),amount:text(args[2]),destinationChain:text(args[3]),recipient:text(args[4]),refundTo:text(args[5]),slippageTolerance:Number(args[6])};
      const key = ['intents-estimate', input];
      const quote = await this.cached(key,signal=>this.intentsProvider().estimate(input,signal),5000,estimateEvidenceSchema,context);
      const saved = context?.savedKeys.has(JSON.stringify(key));
      if (!saved && Date.parse(quote.expiresAt) <= Date.now()) throw staleData('Quote expired. Refresh the estimate.');
      const amounts = quote.response.quote;
      return [[saved ? 'Saved estimate · no funding instructions' : 'Estimate · no funding instructions','Value','Token / unit'],
        ['Input amount',amountFromBaseUnits(amounts.amountIn,quote.origin.decimals)!.display,quote.origin.symbol],
        ['Output amount',amountFromBaseUnits(amounts.amountOut,quote.destination.decimals)!.display,quote.destination.symbol],
        ['Minimum output',amountFromBaseUnits(amounts.minAmountOut,quote.destination.decimals)!.display,quote.destination.symbol],
        ['Input asset',quote.origin.assetId,quote.origin.blockchain],
        ['Output asset',quote.destination.assetId,quote.destination.blockchain],
        [quote.expirySource==='provider'?'Expires':'Estimate cutoff (requested)',quote.expiresAt,'UTC'],['Slippage',input.slippageTolerance,'bps'],
        ['Input base units',amounts.amountIn,quote.origin.symbol],
        ['Output base units',amounts.amountOut,quote.destination.symbol],
        ['Minimum output base units',amounts.minAmountOut,quote.destination.symbol],
        ['Provider quote',quote.response.correlationId,''],['Fees','Included in provider output estimate; network fees additional','']];
    }
    const checkedNetwork = networkSchema.safeParse(args.at(-1));
    if(!checkedNetwork.success)throw invalidInput('The network must be “mainnet” or “testnet”.');
    const network = checkedNetwork.data;
    if (name === 'NEAR_BALANCE' || name === 'NEAR_BALANCE_EXACT') {
      const id = account(args[0]);
      const key = [network, id, 'balance'];
      const units = await this.cached(key, signal => this.ports.balance(network,id,signal), 30_000, unitsSchema, context)
        .catch(cause => { throw readProblem(cause, network, id); });
      const amount = amountFromBaseUnits(units,24);
      if (!amount) throw new Error('Invalid native balance.');
      accept();this.recordBalance(key, units, {...amount, asset:'near', symbol:'NEAR', account:id, numericValueIsApproximate:true});
      return name === 'NEAR_BALANCE_EXACT' ? amount.display : Number(amount.display);
    }
    if (name === 'FT_BALANCE' || name === 'FT_BALANCE_EXACT') {
      const token = account(args[0]), owner = account(args[1]);
      const [rawMetadata,rawUnits] = await Promise.all([read(network,token,'ft_metadata'),read(network,token,'ft_balance_of',{account_id:owner})]);
      const metadata = metadataSchema.parse(rawMetadata);
      const units = unitsSchema.parse(rawUnits);
      const amount = amountFromBaseUnits(units,metadata.decimals)!;
      const balanceKey = [network,token,'ft_balance_of',{account_id:owner}];
      accept();this.recordBalance(balanceKey, units, {...amount, asset:token, symbol:metadata.symbol, name:metadata.name, account:owner, numericValueIsApproximate:true});
      return name === 'FT_BALANCE_EXACT' ? amount.display : Number(amount.display);
    }
    if (name === 'NEAR_VIEW') {
      const result = await read(network,account(args[0]),text(args[1]),jsonArgs(args[2]));
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
        await read(network,dao,'get_proposals',{from_index:0,limit:100}));
      return [['ID','Description','Status','Proposer'],...proposals.map(p => [p.id,p.description,p.status,p.proposer])];
    }
    const reference = z.string().trim().min(1).max(64).parse(args[0]);
    const source = account(args[1]);
    const id = `${network}:${source}:${reference}`;
    const policy = await read(network,source,'get_policy');
    let recipient = '', asset = '', decimals = 0, amount = '', baseUnits = '';
    let method = '', callArgs: Record<string,unknown> = {}, deposit = '0';
    let proposalState: unknown;
    if (name === 'SPUTNIK_CALL' || name === 'SPUTNIK_STAKE') {
      recipient = account(args[2]);asset = 'near';decimals = 24;
      const isStake = name === 'SPUTNIK_STAKE';
      const targetMethod = isStake ? 'deposit_and_stake' : z.string().min(1).max(256).parse(args[3]);
      const targetArgs = isStake ? {} : jsonArgs(args[4]);
      const gas = isStake ? '100000000000000' : z.string().regex(/^\d+$/).parse(text(args[5]));
      if (BigInt(gas) <= 0n || BigInt(gas) > 250000000000000n) throw invalidInput('Target gas must be between 1 and 250 Tgas in gas units.');
      const parsed = parseExactAmount(isStake ? args[3] : args[6],24);
      if (!parsed.ok) throw invalidInput(parsed.message);
      ({display:amount,baseUnits} = parsed.amount);
      if(isStake) {
        positiveAmount(args[3],24);
        z.string().regex(/^\d+$/).parse(await read(network,recipient,'get_account_staked_balance',{account_id:source}));
      }
      const bond = z.object({proposal_bond:z.string().regex(/^\d+$/)}).parse(policy).proposal_bond;
      const bytes = new TextEncoder().encode(JSON.stringify(targetArgs));
      const encoded = btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
      const transaction:WalletTransaction = {receiverId:source,actions:[{type:'FunctionCall',params:{methodName:'add_proposal',args:{proposal:{description:`NearSheets ${reference}`,kind:{FunctionCall:{receiver_id:recipient,actions:[{method_name:targetMethod,args:encoded,gas,deposit:baseUnits}]}}}},gas:'200000000000000',deposit:bond}}]};
      const data = {id,kind:name,network,source,recipient,asset,decimals,amount,baseUnits,policy,transaction};
      const label = `Draft · ${isStake ? 'Stake' : targetMethod} · ${amount} NEAR → ${recipient} · ${source} · ${reference}`;
      accept();
      return this.recordOperation(label, data, context);
    }
    if (name === 'INTENTS_SWAP') {
      if (network !== 'mainnet') throw unavailable('1Click has no testnet route.');
      const input:QuoteInput = {originAsset:text(args[2]),destinationAsset:text(args[3]),amount:text(args[4]),destinationChain:text(args[5]),recipient:text(args[6]),refundTo:account(args[7]),slippageTolerance:Number(args[8])};
      if (input.refundTo !== source) throw invalidInput('DAO-funded swaps must refund to the source DAO.');
      const estimate = await this.cached(['intents-estimate',input],signal=>this.intentsProvider().estimate(input,signal),5000,estimateEvidenceSchema,context);
      if (estimate.origin.blockchain !== 'near' || !input.originAsset.startsWith('nep141:')) throw unavailable('DAO funding currently supports NEAR fungible tokens only.');
      asset = account(input.originAsset.slice(7));
      const meta = metadataSchema.parse(await read(network,asset,'ft_metadata'));
      if (meta.decimals !== estimate.origin.decimals) throw new Error('Provider and NEAR token precision differ.');
      decimals = meta.decimals; recipient = input.recipient;
      ({display:amount,baseUnits} = positiveAmount(input.amount,decimals));
      const data = {id,kind:name,network,source,recipient,asset,decimals,amount,baseUnits,policy,
        transaction:{receiverId:source,actions:[]} as WalletTransaction,
        intents:{input,stage:'estimated' as const,quote:estimate.response,expiresAt:estimate.expiresAt,providerId:estimate.response.correlationId}};
      const label = `Swap draft · ${amount} ${asset} → ${recipient} · ${source} · ${reference}`;
      accept();
      return this.recordOperation(label, data, context);
    }
    if (name === 'SPUTNIK_TRANSFER') {
      recipient = account(args[2]); asset = text(args[4]);
      const meta = asset === 'near' ? {decimals:24} : metadataSchema.parse(await read(network,account(asset),'ft_metadata'));
      decimals = meta.decimals;
      ({display:amount,baseUnits} = positiveAmount(args[3],decimals));
      const bond = z.object({proposal_bond:z.string().regex(/^\d+$/)}).parse(policy).proposal_bond;
      method = 'add_proposal'; deposit = bond;
      callArgs = {proposal:{description:`NearSheets ${reference}`,kind:{Transfer:{token_id:asset === 'near' ? '' : asset,receiver_id:recipient,amount:baseUnits}}}};
    } else if (name === 'SPUTNIK_VOTE') {
      const proposalId = z.number().int().nonnegative().parse(args[2]);
      const action = z.enum(['VoteApprove','VoteReject','VoteRemove']).parse(args[3]);
      proposalState = await read(network,source,'get_proposal',{id:proposalId});
      z.object({status:z.literal('InProgress')}).parse(proposalState);
      if (!context?.savedKeys.has(JSON.stringify([network,source,'get_proposal',{id:proposalId}]))) {
        checkRouteExpiry(proposalState,action);
      }
      method = 'act_proposal'; callArgs = {id:proposalId,action};
    } else throw new Error('Unknown table function.');
    const transaction: WalletTransaction = {receiverId:source,actions:[{type:'FunctionCall',params:{methodName:method,args:callArgs,gas:'200000000000000',deposit}}]};
    const data = {id,kind:name,network,source,recipient,asset,decimals,amount,baseUnits,transaction,policy,proposal:proposalState};
    const label = `${name === 'SPUTNIK_TRANSFER' ? `Draft · ${amount} ${asset} → ${recipient}` : `Draft · ${text(args[3])} #${text(args[2])}`} · ${source} · ${network} · ${reference}`;
    accept();
    return this.recordOperation(label, data, context);
  }
  /** Explicit preparation allocates a funding target; formulas cannot call this. */
  async prepare(op:Operation): Promise<Operation> {
    if (!op.intents) return op;
    if (op.saved) throw savedDraftProblem();
    if (this.executions[op.id] && !['cancelled','failed'].includes(this.executions[op.id]!.state)) throw new Error('This swap has an execution attempt. A replacement quote requires a new reference and proposal.');
    if (op.intents.stage === 'prepared' && Date.parse(op.intents.expiresAt) > Date.now()) return op;
    if (!this.intents) throw unavailable('Intents is not configured.');
    const quote = await this.intents.prepare(op.intents.input);
    const depositAddress = account(quote.response.quote.depositAddress);
    const policy = z.object({proposal_bond:z.string().regex(/^\d+$/)}).parse(op.policy);
    const route = {...op.intents,stage:'prepared' as const,quote:quote.response,expiresAt:quote.expiresAt,depositAddress,providerId:quote.response.correlationId};
    const description = 'NearSheets Intents ' + JSON.stringify({reference:op.id,expiresAt:route.expiresAt,recipient:op.recipient,input:route.input,quote:route.quote});
    const transaction:WalletTransaction = {receiverId:op.source,actions:[{type:'FunctionCall',params:{methodName:'add_proposal',args:{proposal:{description,kind:{Transfer:{token_id:op.asset,receiver_id:depositAddress,amount:op.baseUnits}}}},gas:'200000000000000',deposit:policy.proposal_bond}}]};
    const data = {...op,intents:route,transaction};
    const prepared = {...data,revision:JSON.stringify({...data,revision:undefined})};
    for (const [label,value] of this.operations) if(value.id===op.id && value.revision===op.revision)this.operations.set(label,prepared);
    return prepared;
  }
  stopReads() {
    this.epoch++;
    void this.query.cancelQueries();
    this.intents?.clearCache();
    this.refreshListeners.forEach(listener=>listener(undefined,true));
  }
  refresh(keys?:ReadonlySet<string>) {
    if(!keys) {this.epoch++;this.diagnostics.clear();this.intents?.clearCache();}
    this.refreshListeners.forEach(listener=>listener(keys));
    if(keys) {for(const key of keys){this.savedKeys.delete(key);this.keyVersions.set(key,(this.keyVersions.get(key)??0)+1);this.query.removeQueries({queryKey:JSON.parse(key) as unknown[],exact:true});const read=this.evidence.get(key);if(read)read.stale=true;}}
    else {this.savedKeys.clear();this.query.clear();for(const read of this.evidence.values())read.stale=true;}
  }
  dispose() { this.disposed = true; this.refresh();this.bindings.clear();this.operations.clear();this.refreshListeners.clear(); }
}

export function savedDraftProblem() {
  return staleData('This draft uses saved blockchain data. Refresh the source formula’s blockchain reads before reviewing it.');
}

export function checkRouteExpiry(proposal:unknown,action:string) {
  const data = z.object({description:z.string().optional()}).parse(proposal);
  if (action !== 'VoteApprove' || !data.description?.startsWith('NearSheets Intents ')) return;
  const route = z.object({expiresAt:z.iso.datetime()}).parse(JSON.parse(data.description.slice('NearSheets Intents '.length)));
  if (Date.parse(route.expiresAt) <= Date.now()) throw new Error('The approved route has expired. Remove the old proposal and prepare a new quote under a new reference.');
}
