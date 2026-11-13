import { z } from 'zod';
import type { WalletController } from '../wallet/application/wallet-controller';
import { WalletCancelledError } from '../../integrations/wallet/gateway';
import { parseTransactionOutcome } from '../treasury/model/proposal-submissions';
import type { Operation, TableRuntime } from './runtime';
import { checkRouteExpiry } from './runtime';
import { invalidInput, staleData, unavailable, TableProblem } from './problems';
import type { Problem } from './problems';
export const executionSchema = z.object({
  id:z.string(), revision:z.string(), account:z.string(), at:z.iso.datetime(),
  attempts:z.array(z.object({at:z.iso.datetime(),revision:z.string(),state:z.string(),transactionHash:z.string().nullable()})).optional(),
  state:z.enum(['awaiting-wallet','indeterminate','confirmed','failed','cancelled']),
  transactionHash:z.string().nullable(), message:z.string().nullable(),
  technicalDetails:z.string().optional(),
});
export type Execution = z.infer<typeof executionSchema>;
export type ExecutionJournal = Record<string, Execution>;
export function executionProblem(record:Execution):Problem|null {
  if(record.state==='confirmed')return null;
  const unknown=record.state==='indeterminate'||record.state==='awaiting-wallet';
  return {code:unknown?'unknown-outcome':record.state,title:unknown?'Transaction outcome unknown':record.state==='cancelled'?'Wallet request cancelled':'Transaction failed',
    message:unknown?'This attempt has no confirmed outcome.':record.state==='cancelled'?'The wallet request was cancelled.':'The recorded transaction failed.',
    recovery:unknown?'Check the recorded transaction or wallet history before preparing a replacement.':record.state==='cancelled'?'You can review the action again when you are ready.':'Inspect the transaction details and correct the cause before reviewing a replacement.',
    cellError:'#N/A',details:record.technicalDetails ?? record.message ?? undefined};
}
export interface ReviewedPlan { operations: Operation[]; snapshot: string; account: string; network: string }

export function snapshotFingerprint(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') return JSON.stringify(snapshot);
  const data = snapshot as {resources?: Array<{name:string}>};
  return JSON.stringify({...data,resources:data.resources?.filter(item=>item.name !== 'nearsheets.table')});
}

/** Freeze the exact payload and all dependencies, including policy and current proposal state. */
export function reviewPlan(operations: Operation[], snapshot: unknown, wallet: WalletController, allowEstimated = false): ReviewedPlan {
  const state = wallet.getState();
  if (!state.connection || state.status !== 'connected') throw invalidInput('Connect a wallet to review execution.', 'Use the wallet control to connect, then review the selected actions again.');
  if (!operations.length) throw invalidInput('Select actionable cells first.', 'Select cells containing action drafts, then choose Review actions.');
  const ids = new Set<string>();
  for (const op of operations) {
    if (!allowEstimated && op.intents && (op.intents.stage !== 'prepared' || Date.parse(op.intents.expiresAt) <= Date.now())) throw staleData('Prepare a current Intents quote before review.');
    if (ids.has(op.id)) throw invalidInput('Duplicate action reference in selection. Copies represent the same action.', 'Select one copy of each action, or use a new reference for an intentionally separate action.');
    ids.add(op.id);
    if (op.network !== state.network) throw invalidInput('The wallet and action networks differ.', 'Connect the wallet on the action’s network, then review again.');
    const policy = z.object({roles:z.array(z.object({kind:z.unknown(), permissions:z.array(z.string())}))}).parse(op.policy);
    const action = op.kind === 'SPUTNIK_VOTE' ? String(op.transaction.actions[0]?.params.args.action) : 'AddProposal';
    const proposalKind = z.object({kind:z.record(z.string(),z.unknown())}).safeParse(op.proposal);
    const votedKind = proposalKind.success ? (proposalKind.data.kind.Transfer ? 'transfer' : proposalKind.data.kind.FunctionCall ? 'call' : '*') : '*';
    const kind = op.kind === 'SPUTNIK_VOTE' ? votedKind : ['SPUTNIK_CALL','SPUTNIK_STAKE'].includes(op.kind) ? 'call' : 'transfer';
    const authorized = policy.roles.some(role => {
      const group = z.object({Group:z.array(z.string())}).safeParse(role.kind);
      const member = role.kind === 'Everyone' || z.object({Everyone:z.object({})}).safeParse(role.kind).success || (group.success && group.data.Group.includes(state.connection!.accountId));
      return member && role.permissions.some(permission => [`${kind}:${action}`,`*:${action}`,`${kind}:*`,'*:*'].includes(permission));
    });
    if (!authorized) throw invalidInput('Current policy does not establish signing permission for this account.', 'Connect an account whose permissions can be verified against the DAO policy.');
  }
  return structuredClone({operations,snapshot:snapshotFingerprint(snapshot),account:state.connection.accountId,network:state.network});
}

/** Called exclusively by the execution dialog. Persist before invoking any wallet. */
export async function executePlan(options: {
  plan: ReviewedPlan; wallet: WalletController; runtime: TableRuntime;
  snapshot(): unknown; journal(): ExecutionJournal;
  record(record: Execution): Promise<void>;
}) {
  const {plan,wallet,runtime} = options;
  const unchanged = () => {
    const state = wallet.getState();
    if (snapshotFingerprint(options.snapshot()) !== plan.snapshot || state.connection?.accountId !== plan.account || state.network !== plan.network)
      throw staleData('Preview is stale. Review the changed spreadsheet or account again.');
  };
  unchanged();
  for (const op of plan.operations) {
    if (op.intents && Date.parse(op.intents.expiresAt) <= Date.now()) throw staleData('Quote expired. A new route requires a new review and proposal.');
    const previous = options.journal()[op.id];
    if (previous && previous.state !== 'cancelled' && previous.state !== 'failed')
      throw invalidInput('This action already has an execution attempt. Reconcile its transaction before resubmitting.', 'Use Inspect to check the recorded transaction. If no hash was returned, check wallet history.');
    // A new policy/proposal read is compared with the reviewed values; it cannot alter the approved payload.
    runtime.query.removeQueries({queryKey:[op.network,op.source,'get_policy'],exact:false});
    runtime.query.removeQueries({queryKey:[op.network,op.source,'get_proposal'],exact:false});
    if(op.asset&&op.asset!=='near')runtime.query.removeQueries({queryKey:[op.network,op.asset,'ft_metadata'],exact:false});
    const policy = await runtime.read(op.network,op.source,'get_policy');
    if (JSON.stringify(policy) !== JSON.stringify(op.policy)) throw staleData('DAO policy changed. Review again.');
    if (op.kind === 'SPUTNIK_VOTE') {
      const proposal = await runtime.read(op.network,op.source,'get_proposal',{id:op.transaction.actions[0]?.params.args.id});
      if (!z.object({status:z.literal('InProgress')}).safeParse(proposal).success) throw staleData('Proposal is no longer open. Review again.');
      checkRouteExpiry(proposal,String(op.transaction.actions[0]?.params.args.action));
      if (JSON.stringify(proposal) !== JSON.stringify(op.proposal)) throw staleData('Proposal state changed. Review again.');
    }
    if (op.asset && op.asset !== 'near') {
      const metadata = z.object({decimals:z.number()}).parse(await runtime.read(op.network,op.asset,'ft_metadata'));
      if (metadata.decimals !== op.decimals) throw staleData('Token metadata changed. Review again.');
    }
    unchanged();
    const pending: Execution = {attempts:previous ? [...(previous.attempts ?? []),{at:previous.at,revision:previous.revision,state:previous.state,transactionHash:previous.transactionHash}] : [],id:op.id,revision:op.revision,account:plan.account,at:new Date().toISOString(),state:'awaiting-wallet',transactionHash:null,message:null};
    await options.record(pending);
    try {
      unchanged();
      if (op.intents && Date.parse(op.intents.expiresAt) <= Date.now()) throw staleData('Quote expired before opening the wallet. Prepare and review again.');
    } catch(cause) {
      await options.record({...pending,state:'cancelled',message:'Preflight changed before the wallet was opened. Nothing was signed.'});
      throw cause;
    }
    let result: Execution;
    try {
      const outcome = parseTransactionOutcome(await wallet.signAndSendTransaction(op.transaction));
      result = {...pending,state:outcome.kind === 'success' ? 'confirmed' : outcome.kind === 'failure' ? 'failed' : 'indeterminate',transactionHash:outcome.transactionHash,message:outcome.message};
    } catch (cause) {
      const cancelled=cause instanceof WalletCancelledError;
      result = {...pending,state:cancelled ? 'cancelled' : 'indeterminate',
        message:cancelled ? 'The wallet request was cancelled.' : 'The wallet response was interrupted. The transaction outcome is unknown. Check the transaction or wallet history before preparing a replacement.',
        technicalDetails:cause instanceof Error ? cause.message : String(cause)};
    }
    await options.record(result);
    if (result.state !== 'confirmed') break;
  }
}

export async function reconcileExecution(record:Execution,runtime:TableRuntime):Promise<Execution> {
  if (!record.transactionHash) throw new TableProblem({code:'unknown-outcome',title:'Transaction outcome unknown',message:'No transaction hash was returned. This attempt remains indeterminate; verify it in the wallet before any replacement.',recovery:'Check your wallet transaction history. Do not submit a replacement until the original attempt is resolved.',cellError:'#N/A'});
  if (!runtime.ports.transaction) throw unavailable('Transaction reconciliation is unavailable.');
  const operation = JSON.parse(record.revision) as Operation;
  const raw = await runtime.ports.transaction(operation.network,record.transactionHash,record.account);
  const transaction = z.object({transaction:z.object({hash:z.string(),signer_id:z.string(),receiver_id:z.string()})}).parse(raw).transaction;
  if (transaction.hash !== record.transactionHash || transaction.signer_id !== record.account || transaction.receiver_id !== operation.source) throw new Error('The transaction does not match the recorded execution.');
  const outcome = parseTransactionOutcome(raw);
  return {...record,state:outcome.kind==='success'?'confirmed':outcome.kind==='failure'?'failed':'indeterminate',message:outcome.message};
}
