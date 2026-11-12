import { LexerTreeBuilder, deserializeRangeWithSheet, sequenceNodeType } from '@univerjs/engine-formula';
import type { CellLocation } from './cell-diagnostics';
import { cellKey } from './read-bindings';
import type { WorkbookSession } from '../spreadsheet/univer/create-workbook-session';
/** Follow ordinary formula references too, so refreshing SUM(read cells) refreshes its evidence. */
export function selectionDependencies(session:WorkbookSession,cell:CellLocation,visited=new Set<string>()):Set<string> {
 const keys=new Set<string>(),key=cellKey(cell);if(visited.has(key))return keys;visited.add(key);
 const runtime=session.tableRuntime;if(!runtime)return keys;
 const bindings=runtime.bindings?.forCell(cell)??[];bindings.forEach(b=>b.keys.forEach(k=>keys.add(k)));
 const workbook=session.univerAPI?.getWorkbook(cell.unitId),sheet=workbook?.getSheetBySheetId(cell.sheetId);if(!sheet)return keys;
 const formula=sheet.getRange(cell.row,cell.column).getFormula();
 const nodes=formula?new LexerTreeBuilder().sequenceNodesBuilder(formula):[];
 for(const node of nodes??[]) {
  if(typeof node==='string'||node.nodeType!==sequenceNodeType.REFERENCE)continue;
  const ref=deserializeRangeWithSheet(node.token);if(ref.unitId&&ref.unitId!==cell.unitId)continue;
  const target=ref.sheetName?workbook?.getSheetByName(ref.sheetName):sheet;if(!target)continue;
  for(const binding of runtime.bindings?.all()??[]) {const r=ref.range;if(binding.cell.unitId===cell.unitId&&binding.cell.sheetId===target.getSheetId()&&binding.cell.row<=r.endRow&&binding.cell.row+binding.rows>r.startRow&&binding.cell.column<=r.endColumn&&binding.cell.column+binding.columns>r.startColumn)binding.keys.forEach(k=>keys.add(k));}
  target.getSheet().getCellMatrix().forValue((row,column)=>{
   const r=ref.range;if(row<r.startRow||row>r.endRow||column<r.startColumn||column>r.endColumn)return;
   selectionDependencies(session,{...cell,sheetId:target.getSheetId(),row,column},visited).forEach(k=>keys.add(k));
  });
 }
 return keys;
}
