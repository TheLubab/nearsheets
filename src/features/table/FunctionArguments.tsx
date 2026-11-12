import { useEffect, useRef, useState } from 'react';
import { env } from '../../config/env';
import { Dialog } from '../../components/ui/dialog';
import { getFunction, availability, rememberFunction } from './function-registry';
import type { ArgumentDefinition } from './function-registry';
import { decodeArgument, encodeArgument, parseCellReference, parseFunction, singleCellReference } from './formula-editor';
import { checkNearAccountId } from '../treasury/model/near-account';
import { parseExactAmount } from '../treasury/model/exact-amount';
import type { WorkbookSession } from '../spreadsheet/univer/create-workbook-session';
import type { FRange } from '@univerjs/sheets/facade';
import { z } from 'zod';
import { validateAddress } from '../../integrations/intents/one-click';
export { functionHelp } from './function-registry';
export interface EditorTarget {unitId:string;sheetId:string;row:number;column:number;original:string;label:string}
export const targetFingerprint=(cell:FRange)=>cell.getFormula()?JSON.stringify({f:cell.getFormula()}):JSON.stringify({v:cell.getRawValue()??null});
export function captureTarget(cell:FRange):EditorTarget {const r=cell.getRange();return {unitId:cell.getUnitId(),sheetId:cell.getSheetId(),row:r.startRow,column:r.startColumn,original:targetFingerprint(cell),label:cell.getSheetName()+'!'+cell.getA1Notation()};}
export function resolveTarget(session:WorkbookSession,target:EditorTarget) {return session.univerAPI.getWorkbook(target.unitId)?.getSheetBySheetId(target.sheetId)?.getRange(target.row,target.column)??null;}
export function defaultArgument(arg:ArgumentDefinition) {
 switch(arg.kind){case 'network':return env.VITE_NEAR_NETWORK;case 'reference':return 'action-'+crypto.randomUUID();case 'json':return '{}';case 'gas':return '50';case 'slippage':return '1';case 'vote':return 'VoteApprove';case 'field':return 'amount';default:return arg.name==='attached NEAR'?'0':arg.kind==='token'&&arg.name!=='token'?'near':'';}
}
const metadataSchema=z.object({spec:z.literal('ft-1.0.0'),decimals:z.number().int().min(0).max(24),symbol:z.string().min(1)});
type CatalogToken={assetId:string;blockchain:string;symbol:string;decimals:number};
const supportedChains=new Set(['near','eth','base','arb','bsc','pol','op','avax','sol']);
export function FunctionArguments({session,target,functionName,editing=false,prefill,onClose}:{session:WorkbookSession;target:EditorTarget;functionName:string;editing?:boolean;prefill?:string;onClose():void}) {
 const [name,setName]=useState(functionName),entry=getFunction(name)!;
 const [values,setValues]=useState<Record<string,string>>(()=>{
  const parsed=editing?parseFunction(resolveTarget(session,target)?.getFormula()??''):null;
  return Object.fromEntries(getFunction(functionName)!.arguments.map((arg,i)=>[arg.name,parsed?decodeArgument(parsed.args[i]!,arg):arg.kind==='cell'&&prefill?'='+prefill:defaultArgument(arg)]));
 });
 const [submitted,setSubmitted]=useState(false),[error,setError]=useState(''),[overwrite,setOverwrite]=useState<string|null>(null);
 const [picking,setPicking]=useState<string|null>(null),[absoluteRow,setAbsoluteRow]=useState(false),[absoluteColumn,setAbsoluteColumn]=useState(false);
 const focusField=useRef<string|null>(null),[revision,setRevision]=useState(0);
 const [tokens,setTokens]=useState<CatalogToken[]>([]),[catalogError,setCatalogError]=useState('');
 const [metadata,setMetadata]=useState<{key:string;decimals:number;symbol:string}|null>(null),[metadataError,setMetadataError]=useState('');
 const runtime=session.tableRuntime!;
 const resolved=(value:string):unknown=>{const ref=parseCellReference(value);if(!ref)return value.startsWith('=')?undefined:value;const workbook=session.univerAPI.getWorkbook(target.unitId);const sheet=ref.sheetName?workbook?.getSheetByName(ref.sheetName):workbook?.getSheetBySheetId(target.sheetId);return sheet?.getRange(ref.range.startRow,ref.range.startColumn).getRawValue();};
 const network=resolved(values.network??env.VITE_NEAR_NETWORK);
 const tokenArg=entry.arguments.find(a=>a.kind==='token');
 const token=tokenArg?resolved(values[tokenArg.name]??''):entry.name==='INTENTS_SWAP'?String(resolved(values['origin asset']??'')).replace(/^nep141:/,''):undefined;
 const metadataKey=JSON.stringify([network,token]);
 const needsMetadata=!!tokenArg||entry.name==='INTENTS_SWAP';
 useEffect(()=>{let active=true;setMetadata(null);setMetadataError('');
  if(!needsMetadata)return;
  if(token==='near'){setMetadata({key:metadataKey,decimals:24,symbol:'NEAR'});return;}
  if(typeof token!=='string'||!checkNearAccountId(token).ok||network!=='mainnet'&&network!=='testnet'){setMetadataError('Enter a valid token contract and network to verify precision.');return;}
  const timer=setTimeout(()=>{void runtime.read(network,token,'ft_metadata').then(raw=>{const meta=metadataSchema.parse(raw);if(active)setMetadata({...meta,key:metadataKey});}).catch(cause=>{if(active)setMetadataError(cause instanceof Error?cause.message:'Token metadata unavailable.');});},300);
  return()=>{active=false;clearTimeout(timer);};
 },[runtime,metadataKey,needsMetadata,network,token]);
 useEffect(()=>{let active=true;if(!entry.provider||!runtime.intents)return;void runtime.intents.tokens().then(result=>{if(active)setTokens(result);}).catch(cause=>{if(active)setCatalogError(String(cause));});return()=>{active=false;};},[runtime,entry.provider]);
 useEffect(()=>{const listener=session.getWorkbook()?.onCommandExecuted(command=>{if(/(insert|remove|move).*(row|col|sheet)|(row|col|sheet).*(insert|remove|move)/i.test(command.id)){onClose();return;}if(!resolveTarget(session,target)){onClose();return;}setRevision(v=>v+1);});return()=>listener?.dispose();},[session,target,onClose]);
 useEffect(()=>{if(!picking&&focusField.current){const field=focusField.current;requestAnimationFrame(()=>document.getElementById('argument-'+field)?.focus());}},[picking]);
 useEffect(()=>{if(!picking)return;const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPicking(null);setError('');}};document.addEventListener('keydown',cancel,true);return()=>document.removeEventListener('keydown',cancel,true);},[picking]);
 const change=(key:string,value:string)=>{setValues(current=>({...current,[key]:value}));setOverwrite(null);};
 const precision=needsMetadata?metadata?.key===metadataKey?metadata.decimals:undefined:entry.name==='INTENTS_QUOTE'?tokens.find(t=>t.assetId===resolved(values['origin asset ID']??''))?.decimals:24;
 const fieldError=(arg:ArgumentDefinition):string|null=>{
  const value=values[arg.name]??'';if(!value.trim())return 'This field is required.';
  try {encodeArgument(value,arg);}catch(cause){return (cause as Error).message;}
  const result=resolved(value);if(value.startsWith('=')&&result===undefined)return null;
  if(arg.kind==='account'||arg.kind==='token'&&result!=='near'||arg.name==='recipient'&&name.startsWith('SPUTNIK_')) {const check=checkNearAccountId(result);if(!check.ok)return check.reason??'Enter a valid account.';}
  if(arg.kind==='json'){try{const parsed:unknown=JSON.parse(String(result));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return 'Use a JSON object.';}catch{return 'Enter valid JSON.';}}
  if(arg.kind==='asset'&&!tokens.some(t=>t.assetId===result&&supportedChains.has(t.blockchain)&&(!(name==='INTENTS_SWAP'&&arg.name.startsWith('origin'))||t.blockchain==='near'&&t.assetId.startsWith('nep141:'))))return 'Choose an asset on a currently supported route from the catalog.';
  if(entry.provider&&arg.name==='recipient'){try{validateAddress(String(resolved(values['output chain']??'')),String(result));}catch(cause){return (cause as Error).message;}}
  if(arg.kind==='amount') {if(precision===undefined)return 'Verified token precision is required.';const amount=parseExactAmount(result,precision);if(!amount.ok)return amount.message;if(arg.name!=='attached NEAR'&&amount.amount.baseUnits==='0')return 'Enter a positive amount.';}
  if(arg.choices&&!arg.choices.includes(String(result)))return 'Choose a supported value.';
  if(name==='INTENTS_SWAP'&&arg.kind==='network'&&result!=='mainnet')return 'DAO swaps require Mainnet; 1Click has no testnet route.';
  return null;
 };
 let formula='';try{formula='='+name+'('+entry.arguments.map(a=>encodeArgument(values[a.name]??'',a)).join(',')+')';}catch{/* Inline validation describes the field. */}
 const unavailable=availability(entry,!!runtime.intents),cell=resolveTarget(session,target),changed=!!cell&&targetFingerprint(cell)!==target.original;
 const verifiedTokens=[...runtime.evidence.entries()].flatMap(([key,read])=>{try{const parts:unknown[]=JSON.parse(key);const meta=metadataSchema.safeParse(read.value);return parts[0]===network&&parts[2]==='ft_metadata'&&meta.success?[{contract:String(parts[1]),symbol:meta.data.symbol}]:[];}catch{return [];}});
 return <>
 <Dialog open={!picking} onOpenChange={open=>{if(!open)onClose();}} restoreFocus={!picking} title={(editing?'Edit ':'')+entry.title} description={entry.description}>
  <form className="function-arguments function-arguments__arguments" noValidate onSubmit={event=>{event.preventDefault();setSubmitted(true);setError('');const bad=entry.arguments.find(a=>fieldError(a));if(bad){document.getElementById('argument-'+bad.name)?.focus();return;}if(unavailable)return;
   const current=resolveTarget(session,target);if(!current){onClose();return;}if(targetFingerprint(current)!==target.original&&targetFingerprint(current)!==overwrite){setError('The target changed while this dialog was open. Confirm overwrite below.');return;}
   if(!formula)return;try{current.setValue({f:formula});rememberFunction(name);onClose();}catch(cause){setError(String(cause));}
  }}>
   {name.includes('BALANCE')&&<label>Output<select value={name.endsWith('_EXACT')?'exact':'number'} onChange={event=>setName(name.replace(/_EXACT$/,'')+(event.target.value==='exact'?'_EXACT':''))}><option value="number">Spreadsheet number (approximate)</option><option value="exact">Exact decimal text</option></select></label>}
   {entry.arguments.map(arg=>{const value=values[arg.name]??'',issue=submitted?fieldError(arg):null,result=resolved(value);const numeric=arg.kind==='amount'&&typeof result==='number';const amount=arg.kind==='amount'&&precision!==undefined&&result!==undefined?parseExactAmount(result,precision):null;
    const choices=arg.choices;const attrs={id:'argument-'+arg.name,name:arg.name,value,spellCheck:false,'aria-invalid':!!issue,'aria-describedby':issue?'error-'+arg.name:undefined,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>change(arg.name,event.target.value)};
    const assetChoices=arg.kind==='asset'?tokens.filter(t=>supportedChains.has(t.blockchain)&&(!(name==='INTENTS_SWAP'&&arg.name.startsWith('origin'))||t.blockchain==='near'&&t.assetId.startsWith('nep141:'))):[];
    return <label key={arg.name} htmlFor={attrs.id}>{value.startsWith('=')&&['gas','slippage'].includes(arg.kind)?arg.name+' (expression in base units)':arg.label}
     <div className="argument-control">{arg.kind==='json'&&!value.startsWith('=')?<textarea {...attrs} rows={4}/>:choices&&!value.startsWith('=')?<select {...attrs}>{choices.map(choice=><option key={choice} value={choice}>{({VoteApprove:'Approve',VoteReject:'Reject',VoteRemove:'Remove'} as Record<string,string>)[choice]??choice}</option>)}</select>:<input {...attrs} list={arg.kind==='asset'?'catalog-'+arg.name:arg.kind==='token'?'verified-tokens':undefined} autoComplete="off" placeholder={arg.kind==='amount'?'Exact decimal amount':arg.kind==='cell'?'=A1':'Literal or =expression'}/>}
      <button type="button" aria-label={'Pick cell for '+arg.label} onClick={()=>{focusField.current=arg.name;setPicking(arg.name);setError('');}}>Pick cell</button>
      {choices&&<button type="button" onClick={()=>change(arg.name,value.startsWith('=')?defaultArgument(arg):'=')}>{value.startsWith('=')?'Choice':'Expression'}</button>}
     </div>
     {arg.kind==='asset'&&<datalist id={'catalog-'+arg.name}>{assetChoices.map(t=><option key={t.assetId} value={t.assetId}>{t.symbol} · {t.blockchain} · {t.assetId}</option>)}</datalist>}
     {value.startsWith('=')&&<small>Resolved: {result===undefined?'Calculated by the sheet when applied':String(result)}{numeric?' · Approximate numeric source; use exact decimal text to preserve all digits.':''}</small>}
     {amount?.ok&&<small>{amount.amount.baseUnits} base units · {precision} decimals{numeric?' · Numeric source is approximate':''}</small>}
     {arg.kind==='reference'&&<small>Copies sharing this reference represent the same action. Use a new reference for a new action.</small>}
     {issue&&<span id={'error-'+arg.name} role="alert" className="function-arguments__error">{issue}</span>}
    </label>;
   })}
   <datalist id="verified-tokens"><option value="near">Native NEAR</option>{verifiedTokens.map(t=><option key={t.contract} value={t.contract}>{t.symbol} · RPC verified</option>)}{tokens.filter(t=>t.blockchain==='near'&&t.assetId.startsWith('nep141:')).map(t=><option key={t.assetId} value={t.assetId.slice(7)}>{t.symbol} · Provider catalog; RPC verification required</option>)}</datalist>
   {needsMetadata&&<p role="status">{metadata?.key===metadataKey?`${metadata.symbol} · RPC-verified precision: ${metadata.decimals}`:metadataError||'Verifying token metadata…'} Suggestions include verified workbook tokens and provider assets; this is not a holdings index.</p>}
   {catalogError&&<p role="alert">Asset catalog unavailable: {catalogError}</p>}
   {unavailable&&<p role="alert">{unavailable}</p>}
   <div className="formula-preview"><span>{editing?'Edit':'Insert'} · {target.label}</span><code>{formula||'Complete the arguments.'}</code><p>Output: {entry.output}. Tables spill into free cells; Univer reports collisions.</p></div>
   {changed&&<label><input type="checkbox" checked={!!cell&&overwrite===targetFingerprint(cell)} onChange={e=>setOverwrite(e.target.checked&&cell?targetFingerprint(cell):null)}/>Overwrite the changed target cell</label>}
   {error&&<p role="alert">{error}</p>}
   <button type="submit" className="primary-button" disabled={!!unavailable||needsMetadata&&!metadata}>{editing?'Apply changes':'Insert'}</button>
  </form>
 </Dialog>
 {picking&&<div className="reference-picker" role="region" aria-label="Select a reference" data-revision={revision}><span>Select one cell for {picking}, on any sheet.</span><label><input type="checkbox" checked={absoluteColumn} onChange={e=>setAbsoluteColumn(e.target.checked)}/>Absolute column</label><label><input type="checkbox" checked={absoluteRow} onChange={e=>setAbsoluteRow(e.target.checked)}/>Absolute row</label><button onClick={()=>{try{const workbook=session.getWorkbook();const ranges=workbook?.getActiveSheet().getSelection()?.getActiveRangeList()??[];if(ranges.length!==1)throw new Error('Select exactly one cell.');const range=ranges[0]!;change(picking,'='+singleCellReference(range.getSheetName(),range.getRange(),absoluteColumn,absoluteRow));setPicking(null);setError('');}catch(cause){setError((cause as Error).message);}}}>Use selection</button><button onClick={()=>{setPicking(null);setError('');}}>Cancel</button>{error&&<span role="alert">{error}</span>}</div>}
 </>;
}
