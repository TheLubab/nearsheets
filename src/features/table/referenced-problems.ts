import { LexerTreeBuilder, deserializeRangeWithSheet, sequenceNodeType } from '@univerjs/engine-formula';
import type { FUniver } from '@univerjs/core/facade';
import type { CellLocation } from './cell-diagnostics';
import type { TableRuntime } from './runtime';
import type { Problem } from './problems';

/** Follow matching errors to their origin, while respecting handled errors and changed formulas. */
export function referencedProblems(api:FUniver,runtime:TableRuntime,cell:CellLocation,formula:string,value:unknown):Problem[] {
 const visited=new Set<string>();
 const walk=(location:CellLocation,expression:string,result:unknown,depth:number):Problem[]=>{
  const key=JSON.stringify(location);
  if(visited.has(key)||visited.size>=256||depth>32)return [];
  visited.add(key);
  const direct=runtime.diagnostics.get(location,expression,result);
  if(direct.length)return direct;
  if(typeof result!=='string'||!/^#(?:CONNECT!|VALUE!|ERROR!|N\/A)$/.test(result))return [];
  const book=api?.getWorkbook(location.unitId),sheet=book?.getSheetBySheetId(location.sheetId);
  if(!sheet)return [];
  const nodes=new LexerTreeBuilder().sequenceNodesBuilder(expression)??[];
  for(const node of nodes){
   if(typeof node==='string'||node.nodeType!==sequenceNodeType.REFERENCE)continue;
   const ref=deserializeRangeWithSheet(node.token);
   if(ref.unitId&&ref.unitId!==location.unitId)continue;
   const source=ref.sheetName?book?.getSheetByName(ref.sheetName):sheet;
   if(!source)continue;
   let found:Problem[]=[];
   const inspect=(row:number,column:number)=>{
    if(found.length)return;
    const range=source.getRange(row,column),raw=range.getValue?.()??range.getRawValue();
    if(raw!==result)return;
    const problems=walk({...location,sheetId:source.getSheetId(),row,column},range.getFormula(),raw,depth+1);
    if(problems.length){const label=source.getSheetName()+'!'+range.getA1Notation();found=problems.map(problem=>({...problem,message:problem.message+(problem.message.includes('Source: ')?'':` Source: ${label}.`)}));}
   };
   const r=ref.range;
   if(r.startRow===r.endRow&&r.startColumn===r.endColumn)inspect(r.startRow,r.startColumn);
   else source.getSheet().getCellMatrix().forValue((row,column)=>{if(row>=r.startRow&&row<=r.endRow&&column>=r.startColumn&&column<=r.endColumn)inspect(row,column);});
   if(found.length)return found;
  }
  return [];
 };
 return walk(cell,formula,value,0);
}
