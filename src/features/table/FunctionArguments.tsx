import { useMemo, useState } from 'react';
import { env } from '../../config/env';
import { TABLE_FUNCTIONS } from './runtime';
export const functionHelp:Record<string,{title:string;description:string;group:string}>={
 NEAR_BALANCE:{title:'NEAR balance',description:'Read an account balance into the selected cell. Use the result in calculations.',group:'Read data'},
 FT_BALANCE:{title:'Token balance',description:'Read a fungible-token balance using the token contract’s verified precision.',group:'Read data'},
 SPUTNIK_PROPOSALS:{title:'DAO proposals',description:'Insert a proposal table with IDs, descriptions, statuses and proposers. Leave room below and to the right.',group:'Read data'},
 NEAR_VIEW:{title:'Contract data',description:'Call a read-only contract method. Records and tables fill a range starting at the selected cell.',group:'Read data'},
 SPUTNIK_TRANSFER:{title:'DAO transfer proposal',description:'Prepare a native NEAR or token transfer. Creating the formula does not submit a proposal or move funds.',group:'Prepare an action'},
 SPUTNIK_VOTE:{title:'DAO vote',description:'Prepare an approval, rejection or removal vote. Select the cell and review it before signing.',group:'Prepare an action'},
 SPUTNIK_CALL:{title:'DAO contract call',description:'Prepare a proposal for a contract call, with exact arguments, gas and attached NEAR.',group:'Prepare an action'},
 SPUTNIK_STAKE:{title:'DAO staking proposal',description:'Prepare a deposit-and-stake proposal for a compatible staking pool.',group:'Prepare an action'},
 INTENTS_QUOTE:{title:'Cross-chain estimate',description:'Get a quote with minimum output, slippage and expiry. This does not allocate deposit instructions.',group:'Read data'},
 INTENTS_SWAP:{title:'DAO cross-chain swap',description:'Prepare a swap from a NEAR token owned by a DAO. Funding instructions are created only when you choose Prepare & review.',group:'Prepare an action'},
 NS_FIELD:{title:'Action field',description:'Read an action’s amount, baseUnits, recipient, asset, source, network or kind.',group:'Use results'},
 NS_STATUS:{title:'Action status',description:'Show the recorded execution state alongside an action.',group:'Use results'},
 NS_RECEIPT:{title:'Action receipt',description:'Show the recorded transaction, signer and time in a range.',group:'Use results'},
 INTENTS_STATUS:{title:'Cross-chain progress',description:'Track deposit, settlement or refund separately from DAO approval.',group:'Use results'},
};
function defaultValue(name:string) {
 if(name==='network')return env.VITE_NEAR_NETWORK;
 if(name==='reference')return 'action-'+crypto.randomUUID().slice(0,8);
 if(name.includes('slippage'))return '100';
 if(name.includes('JSON'))return '{}';
 if(name.includes('gas units'))return '50000000000000';
 if(name==='attached NEAR')return '0';
 if(name.includes('decision'))return 'VoteApprove';
 if(name.startsWith('asset ('))return 'near';
 if(name.includes('exact amount')||name.includes('exact NEAR'))return '1';
 return '';
}
export function FunctionArguments({target,onInsert,functionName}:{target:string;onInsert(formula:string):void;functionName:string}) {
 const name=functionName;
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries((TABLE_FUNCTIONS.find(entry=>entry[0]===functionName)??TABLE_FUNCTIONS[0])[1].split(',').map(parameter=>{const key=parameter.trim();return[key,defaultValue(key)];})));
 const [submitted,setSubmitted]=useState(false);
 const entry=TABLE_FUNCTIONS.find(item=>item[0]===name)!;
 const parameters=entry[1].split(',').map(value=>value.trim());
 const fieldError=(parameter:string)=>{
  const value=values[parameter]??'';
  if(!value.trim())return 'This field is required.';
  if(value.startsWith('=')&&!value.slice(1).trim())return 'Enter a cell reference after =.';
  if(!value.startsWith('=')&&(parameter.toLowerCase()==='proposal id'||parameter==='slippage bps')&&!/^\d+$/.test(value))return 'Enter a whole number or a cell reference.';
  return null;
 };
 const formula=useMemo(()=>{
  try{return '='+name+'('+parameters.map(parameter=>{
   const value=values[parameter]??'';
   if(value.startsWith('=')) {if(!value.slice(1).trim())throw new Error('Enter a cell reference after =.');return value.slice(1);}
   if(parameter.toLowerCase()==='proposal id'||parameter==='slippage bps'){
    if(!/^\d+$/.test(value))throw new Error('Enter a whole number or cell reference.');return value;
   }
   return JSON.stringify(value);
  }).join(',')+')';}catch{return '';}
 },[name,values,parameters]);
 return <div className="function-arguments">
  <form className="function-arguments__arguments" noValidate onSubmit={event=>{event.preventDefault();setSubmitted(true);const invalid=parameters.find(parameter=>fieldError(parameter));if(invalid){(event.currentTarget.elements.namedItem(invalid) as HTMLElement|null)?.focus();return;}if(formula)onInsert(formula);}}>
   {parameters.map((parameter,index)=>{const error=submitted?fieldError(parameter):null;const errorId=`argument-error-${index}`;return <label key={name+parameter}>{parameter[0]?.toUpperCase()+parameter.slice(1)}
    {parameter==='network'?<select name={parameter} aria-invalid={Boolean(error)} aria-describedby={error?errorId:undefined} value={values[parameter]??env.VITE_NEAR_NETWORK} onChange={event=>setValues({...values,[parameter]:event.target.value})}><option value="testnet">Testnet</option><option value="mainnet">Mainnet</option></select>:
     <input name={parameter} aria-invalid={Boolean(error)} aria-describedby={error?errorId:undefined} spellCheck={false} autoComplete="off" value={values[parameter]??''} placeholder={parameter.includes('amount')?'Exact decimal, e.g. 1.25':parameter.includes('account')||parameter==='dao'?'account.near or =A1':parameter.includes('cell')?'=A1':undefined} onChange={event=>setValues({...values,[parameter]:event.target.value})}/>}
    {error&&<span className="function-arguments__error" id={errorId} role="alert">{error}</span>}
   </label>;})}
   <div className="formula-preview"><span>Formula · {target}</span><code>{formula||'Complete the arguments to build a formula.'}</code></div>
   <button className="primary-button" type="submit">Insert</button>
  </form>
 </div>;
}
