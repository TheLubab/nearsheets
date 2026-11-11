import { ZodError } from 'zod';
import { AccountDoesNotExistError, ContractCodeDoesNotExistError } from 'near-api-js/rpc-errors';

export interface Problem {
  code: string;
  title: string;
  message: string;
  recovery: string;
  cellError: '#VALUE!' | '#N/A' | '#CONNECT!' | '#ERROR!';
  details?: string;
}

export class TableProblem extends Error {
  constructor(readonly problem: Problem, options?: ErrorOptions) {
    super(problem.message, options);
    this.name = 'TableProblem';
  }
}

export function invalidInput(message: string, recovery = 'Check the function arguments and referenced cells.') {
  return new TableProblem({code:'invalid-input',title:'Check the input',message,recovery,cellError:'#VALUE!'});
}

export function unavailable(message:string) {
  return new TableProblem({code:'unavailable',title:'Operation unavailable',message,recovery:'Choose a supported operation or configure the required service.',cellError:'#N/A'});
}

export function staleData(message:string, recovery='Use Blockchain → Refresh, then prepare and review the action again.') {
  return new TableProblem({code:'stale-data',title:'Data needs refreshing',message,recovery,cellError:'#N/A'});
}

export function serviceProblem(cause:unknown, service:string, status?:number) {
  return new TableProblem({code:'service-failed',title:`${service} request failed`,
    message:status ? `${service} returned HTTP ${status}.` : `Could not get a response from ${service}.`,
    recovery:status && status>=400 && status<500 && status!==429 ? 'Check the request inputs. Expand technical details for the service response.' : 'Check your connection and try again later.',
    cellError:!status || status===429 || status>=500 ? '#CONNECT!' : '#ERROR!',details:cause instanceof Error ? cause.message : String(cause),
  },{cause});
}

/** Only typed RPC evidence establishes that an account/contract is missing. */
export function readProblem(cause: unknown, network: string, account: string, method?: string): TableProblem {
  if (cause instanceof TableProblem) return cause;
  const details = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof AccountDoesNotExistError) return new TableProblem({
    code:'account-not-found', title:'Account not found',
    message:`Account “${cause.accountId}” was not found on ${network}.`,
    recovery:'Check the account ID and network.',cellError:'#N/A',details,
  },{cause});
  if (cause instanceof ContractCodeDoesNotExistError) return new TableProblem({
    code:'contract-not-found', title:'Contract not found',message:`Account “${account}” has no contract on ${network}.`,
    recovery:'Check the contract account and network.',cellError:'#N/A',details,
  },{cause});
  // A network failure is different from a contract rejecting a read. Neither
  // establishes that an account is absent. Preserve the cause for inspection.
  const transport = cause instanceof TypeError || (cause instanceof Error && (/timeout|timed out|fetch failed|failed to fetch|network|429|503|502/i.test(cause.message) || ('type' in cause && cause.type==='RetriesExceeded')));
  return new TableProblem({
    code:transport?'connection-failed':'read-failed',title:transport?'Could not reach the service':'Blockchain read failed',
    message:`Could not read ${method ? `“${method}” from ` : 'the balance of '}“${account}” on ${network}.`,
    recovery:transport?'Check your connection, then use Blockchain → Refresh.':'Check the account, network and method arguments. Expand technical details for the service response.',
    cellError:transport?'#CONNECT!':'#ERROR!',details,
  },{cause});
}

export function toProblem(cause: unknown): Problem {
  if (cause instanceof TableProblem) return cause.problem;
  if (cause instanceof ZodError) return {
    code:'invalid-data',title:'Unexpected or invalid data',message:'An argument or service response does not match the required format.',
    recovery:'Check the function arguments. If they are correct, refresh and inspect the service response.',cellError:'#VALUE!',details:cause.message,
  };
  if (cause instanceof SyntaxError) return {code:'invalid-json',title:'Invalid JSON',message:'The JSON arguments could not be read.',recovery:'Use a JSON object such as {} or {"account_id":"alice.near"}.',cellError:'#VALUE!',details:cause.message};
  return {code:'operation-failed',title:'Operation needs attention',
    message:cause instanceof Error ? cause.message : 'The operation could not be completed.',
    recovery:'Check the inputs and current state before trying again.',cellError:'#VALUE!',
    ...(cause instanceof Error ? {} : {details:String(cause)})};
}
