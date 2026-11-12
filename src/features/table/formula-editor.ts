import { AbsoluteRefType } from '@univerjs/core';
import type { IRange } from '@univerjs/core';
import { LexerTreeBuilder, serializeRangeWithSheet, deserializeRangeWithSheet, isReferenceStrings } from '@univerjs/engine-formula';
import { getFunction } from './function-registry';
import type { ArgumentDefinition } from './function-registry';
import { parseExactAmount, amountFromBaseUnits } from '../treasury/model/exact-amount';

/** Token boundaries come from the installed engine, including strings, arrays and sheet names. */
export function parseFunction(formula:string):{name:string;args:string[]}|null {
 const tokens=new LexerTreeBuilder().sequenceNodesBuilder(formula);
 if(!tokens?.length)return null;
 const first=tokens[0];if(!first||typeof first==='string'||!getFunction(first.token.toUpperCase())||tokens[1]!=='(')return null;
 const args:string[]=[];let current='',depth=0,quoted=false,sheetQuoted=false,braces=0;
 const start=formula.indexOf('(',1);
 for(let i=start+1;i<formula.length;i++) {
  const token=formula[i]!;
  if(token==='"'&&!sheetQuoted){current+=token;if(quoted&&formula[i+1]==='"'){current+=formula[++i];continue;}quoted=!quoted;continue;}
  if(token==="'"&&!quoted){current+=token;if(sheetQuoted&&formula[i+1]==="'"){current+=formula[++i];continue;}sheetQuoted=!sheetQuoted;continue;}
  if(!quoted&&!sheetQuoted){
   if(token==='{'||token==='[')braces++;
   if(token==='}'||token===']')braces--;
   if(token===')'&&depth===0&&braces===0){if(formula.slice(i+1).trim())return null;args.push(current);const name=first.token.toUpperCase();return args.length===getFunction(name)!.arguments.length?{name,args}:null;}
   if(token===','&&depth===0&&braces===0){args.push(current);current='';continue;}
   if(token==='(')depth++;if(token===')')depth--;
  }
  current+=token;
 }
 return null;
}
export function decodeArgument(expression:string,argument:ArgumentDefinition) {
 const trimmed=expression.trim();
 if(trimmed.startsWith('"')&&trimmed.endsWith('"')) {
  const value=trimmed.slice(1,-1).replaceAll('""','"');
  if(argument.kind==='gas')return amountFromBaseUnits(value,12)?.display??'='+expression;
  if(argument.kind==='slippage')return amountFromBaseUnits(value,2)?.display??'='+expression;
  return value;
 }
 if(/^\d+$/.test(trimmed)&&argument.kind==='slippage')return amountFromBaseUnits(trimmed,2)!.display;
 if(/^\d+$/.test(trimmed)&&argument.kind==='integer')return trimmed;
 return '='+expression;
}
export function encodeArgument(value:string,argument:ArgumentDefinition) {
 if(value.startsWith('=')){if(!value.slice(1).trim())throw new Error('Enter an expression after =.');return value.slice(1);}
 if(argument.kind==='gas'||argument.kind==='slippage') {
  const amount=parseExactAmount(value,argument.kind==='gas'?12:2);if(!amount.ok)throw new Error(amount.message);
  const units=BigInt(amount.amount.baseUnits);
  if(argument.kind==='gas'&&(units<=0n||units>250000000000000n))throw new Error('Gas must be greater than zero and at most 250 Tgas.');
  if(argument.kind==='slippage'&&units>5000n)throw new Error('Slippage must be between 0% and 50%.');
  return argument.kind==='gas'?JSON.stringify(units.toString()):units.toString();
 }
 if(argument.kind==='integer'){if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('Enter a safe nonnegative whole number.');return value;}
 return '"'+value.replaceAll('"','""')+'"';
}
export function singleCellReference(sheetName:string,range:IRange,absoluteColumn:boolean,absoluteRow:boolean) {
 if(range.startRow!==range.endRow||range.startColumn!==range.endColumn)throw new Error('Choose one cell. These arguments do not accept a range.');
 const absolute=absoluteColumn?(absoluteRow?AbsoluteRefType.ALL:AbsoluteRefType.COLUMN):(absoluteRow?AbsoluteRefType.ROW:AbsoluteRefType.NONE);
 return serializeRangeWithSheet(sheetName,{...range,startAbsoluteRefType:absolute,endAbsoluteRefType:absolute});
}
export function parseCellReference(value:string) {
 try { if(!value.startsWith('=')||!isReferenceStrings(value.slice(1)))return null;const ref=deserializeRangeWithSheet(value.slice(1));const r=ref.range;return r.startRow===r.endRow&&r.startColumn===r.endColumn?ref:null; }catch{return null;}
}
