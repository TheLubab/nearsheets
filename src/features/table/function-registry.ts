/** Shared public contract for discovery, editors, runtime and native help. */
export type Workflow = 'Read data' | 'Prepare action' | 'Track results';
export type ArgumentKind = 'text'|'account'|'token'|'asset'|'amount'|'json'|'gas'|'slippage'|'network'|'reference'|'vote'|'field'|'integer'|'cell';
export interface ArgumentDefinition { name:string; label:string; kind:ArgumentKind; choices?:readonly string[] }
export interface FunctionDefinition { name:string; signature:string; example:string; title:string; description:string; category:Workflow; arguments:ArgumentDefinition[]; output:string; provider:boolean; hidden?:boolean }
const signatures = [
  ['SPUTNIK_CALL', 'reference, dao, contract, method, JSON args, gas units, attached NEAR, network', '=SPUTNIK_CALL("call-1","dao.sputnikv2.testnet","app.testnet","method","{}","50000000000000","0","testnet")'],
  ['SPUTNIK_STAKE', 'reference, dao, staking pool, exact NEAR amount, network', '=SPUTNIK_STAKE("stake-1","dao.sputnikv2.testnet","validator.pool.f863973.m0","1","testnet")'],
  ['INTENTS_SWAP', 'reference, dao, origin asset, output asset, exact amount, output chain, recipient, refund DAO, slippage bps, network', '=INTENTS_SWAP("swap-1","dao.sputnik-dao.near","nep141:wrap.near","output-asset-id","1","eth","0x0000000000000000000000000000000000000001","dao.sputnik-dao.near",100,"mainnet")'],
  ['INTENTS_QUOTE', 'origin asset ID, output asset ID, exact amount, output chain, recipient, refund address, slippage bps', '=INTENTS_QUOTE("origin-asset-id","output-asset-id","1","eth","0x0000000000000000000000000000000000000001","alice.near",100)'],
  ['NEAR_BALANCE', 'account, network', '=NEAR_BALANCE("alice.testnet","testnet")'],
  ['FT_BALANCE', 'token, account, network', '=FT_BALANCE("wrap.testnet","alice.testnet","testnet")'],
  ['NEAR_BALANCE_EXACT', 'account, network', '=NEAR_BALANCE_EXACT("alice.testnet","testnet")'],
  ['FT_BALANCE_EXACT', 'token, account, network', '=FT_BALANCE_EXACT("wrap.testnet","alice.testnet","testnet")'],
  ['NEAR_VIEW', 'contract, method, JSON arguments, network', '=NEAR_VIEW("dao.sputnikv2.testnet","get_last_proposal_id","{}","testnet")'],
  ['SPUTNIK_PROPOSALS', 'dao, network', '=SPUTNIK_PROPOSALS("dao.sputnikv2.testnet","testnet")'],
  ['SPUTNIK_TRANSFER', 'reference, dao, recipient, exact amount, asset (near or token contract), network', '=SPUTNIK_TRANSFER("invoice-1","dao.sputnikv2.testnet","alice.testnet","1.25","near","testnet")'],
  ['SPUTNIK_VOTE', 'reference, dao, proposal id, decision, network', '=SPUTNIK_VOTE("vote-1","dao.sputnikv2.testnet",0,"VoteApprove","testnet")'],
  ['INTENTS_STATUS', 'swap action cell', '=INTENTS_STATUS(A1)'],
  ['NS_RECEIPT', 'action cell', '=NS_RECEIPT(A1)'],
  ['NS_STATUS', 'action cell', '=NS_STATUS(A1)'],
  ['NS_FIELD', 'draft cell, field name', '=NS_FIELD(A1,"amount")'],
] as const;
const labels:Record<(typeof signatures)[number][0],{title:string;description:string;group:string}>={
 NEAR_BALANCE:{title:'NEAR balance',description:'Read an account balance into the selected cell. Use the result in calculations.',group:'Read data'},
 FT_BALANCE:{title:'Token balance',description:'Read a fungible-token balance using the token contract’s verified precision.',group:'Read data'},
 NEAR_BALANCE_EXACT:{title:'Exact NEAR balance',description:'Return the full NEAR balance as decimal text for transaction amounts. Ordinary balance functions return approximate numbers for calculations.',group:'Read data'},
 FT_BALANCE_EXACT:{title:'Exact token balance',description:'Return the full token balance as decimal text using verified token precision. Reference this cell in a transaction amount to preserve every digit.',group:'Read data'},
 SPUTNIK_PROPOSALS:{title:'DAO proposals',description:'Insert a proposal table with IDs, descriptions, statuses and proposers. Leave room below and to the right.',group:'Read data'},
 NEAR_VIEW:{title:'Contract data',description:'Call a read-only contract method. Records and tables fill a range starting at the selected cell.',group:'Read data'},
 SPUTNIK_TRANSFER:{title:'DAO transfer proposal',description:'Prepare a native NEAR or token transfer. Creating the formula does not submit a proposal or move funds.',group:'Prepare action'},
 SPUTNIK_VOTE:{title:'DAO vote',description:'Prepare an approval, rejection or removal vote. Select the cell and review it before signing.',group:'Prepare action'},
 SPUTNIK_CALL:{title:'DAO contract-call proposal',description:'Prepare a proposal for a contract call, with exact arguments, gas and attached NEAR.',group:'Prepare action'},
 SPUTNIK_STAKE:{title:'DAO staking proposal',description:'Prepare a deposit-and-stake proposal for a compatible staking pool.',group:'Prepare action'},
 INTENTS_QUOTE:{title:'Swap estimate',description:'Get a quote with minimum output, slippage and expiry. This does not allocate deposit instructions.',group:'Read data'},
 INTENTS_SWAP:{title:'DAO swap proposal',description:'Prepare a swap from a NEAR token owned by a DAO. Funding instructions are created only when you choose Prepare selected swaps.',group:'Prepare action'},
 NS_FIELD:{title:'Action field',description:'Read an action’s amount, baseUnits, recipient, asset, source, network or kind.',group:'Track results'},
 NS_STATUS:{title:'Action status',description:'Show the recorded execution state alongside an action.',group:'Track results'},
 NS_RECEIPT:{title:'Transaction receipt',description:'Show the recorded transaction, signer and time in a range.',group:'Track results'},
 INTENTS_STATUS:{title:'Swap progress',description:'Track deposit, settlement or refund separately from DAO approval.',group:'Track results'},
};

function argument(name:string):ArgumentDefinition {
 const kind:ArgumentKind = name==='reference'?'reference':name==='network'?'network':name.includes('JSON')?'json':name==='gas units'?'gas':name==='slippage bps'?'slippage':name==='decision'?'vote':name==='field name'?'field':name.includes('cell')?'cell':name==='proposal id'?'integer':name.startsWith('exact')||name==='attached NEAR'?'amount':name==='token'||name.startsWith('asset (')?'token':name.includes('asset')?'asset':['account','dao','contract','staking pool','refund DAO'].includes(name)?'account':'text';
 return {name,kind,label:kind==='gas'?'Gas (Tgas)':kind==='slippage'?'Slippage (%)':name[0]!.toUpperCase()+name.slice(1),choices:kind==='vote'?['VoteApprove','VoteReject','VoteRemove']:kind==='field'?['amount','baseUnits','recipient','asset','source','network','kind']:kind==='network'?['mainnet','testnet']:undefined};
}
export const FUNCTION_REGISTRY:readonly FunctionDefinition[]=signatures.map(([name,signature,example])=>({name,signature,example,...labels[name]!,category:labels[name]!.group as Workflow,arguments:signature.split(',').map(s=>argument(s.trim())),provider:name.startsWith('INTENTS_'),hidden:name.endsWith('_EXACT'),output:name==='SPUTNIK_PROPOSALS'?'ID · Description · Status · Proposer (up to 100 rows)':name==='NEAR_VIEW'?'Variable scalar, key/value or table output':name==='INTENTS_QUOTE'?'Estimate · Value · Token / unit (variable rows)':name==='NS_RECEIPT'?'Attempt state · Transaction · Signer · Recorded at':name==='INTENTS_STATUS'?'Provider stage · Updated at · Details':labels[name]!.group==='Prepare action'?'One action draft cell':'One value'}));
export const TABLE_FUNCTIONS=FUNCTION_REGISTRY.map(f=>[f.name,f.signature,f.example] as const);
export const functionHelp=Object.fromEntries(FUNCTION_REGISTRY.map(f=>[f.name,f]));
export const getFunction=(name:string)=>FUNCTION_REGISTRY.find(f=>f.name===name);
export function availability(entry:FunctionDefinition,provider:boolean):string|null { return entry.provider&&!provider?'Configure the public Intents provider to use this function.':null; }
export function searchFunctions(category:Workflow,query:string) { const terms=query.toLowerCase().trim().split(/\s+/);return FUNCTION_REGISTRY.filter(f=>f.category===category&&!f.hidden&&terms.every(term=>(f.title+' '+f.description+' '+f.name+' '+(f.name.includes('BALANCE')?f.name+'_EXACT':'')).toLowerCase().includes(term))); }
const recentKey='nearsheets.function-recents';
export function recentFunctions(category:Workflow,storage?:Pick<Storage,'getItem'>) { try { const ids:unknown=JSON.parse((storage??localStorage).getItem(recentKey)??'[]');return Array.isArray(ids)?ids.filter((id):id is string=>typeof id==='string'&&getFunction(id)?.category===category).slice(0,5):[]; } catch {return [];} }
export function rememberFunction(name:string,storage?:Pick<Storage,'getItem'|'setItem'>) { try { const target=storage??localStorage;const current:unknown=JSON.parse(target.getItem(recentKey)??'[]');const ids=Array.isArray(current)?current.filter((id):id is string=>typeof id==='string'&&!!getFunction(id)):[];const next=[name,...ids.filter(id=>id!==name)];target.setItem(recentKey,JSON.stringify(next.filter((id,i)=>next.slice(0,i).filter(other=>getFunction(other)?.category===getFunction(id)?.category).length<5))); }catch{/* Preferences never block editing. */} }
