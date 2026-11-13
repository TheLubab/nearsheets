import { referencedProblems } from './referenced-problems';
import { selectionDependencies } from './selection-dependencies';
import type { WorkbookSession } from '../spreadsheet/univer/create-workbook-session';
import type { Operation } from './runtime';
import type { Problem } from './problems';
import type { CellLocation } from './cell-diagnostics';
import { FUNCTION_REGISTRY } from './function-registry';
export interface SelectedCell {address:string;location:CellLocation;formula:string;value:unknown;operation?:Operation;problems:Problem[];readKeys:string[];args:unknown[];action:boolean;submitted:boolean}
/** All sparse selected cells are classified; pagination is exclusively a display concern. */
export function getTableSelection(session:WorkbookSession|null) {
 const workbook=session?.getWorkbook(),sheet=workbook?.getActiveSheet();
 const ranges=sheet?.getSelection()?.getActiveRangeList()??[],bounds=ranges.map(r=>r.getRange());
 const allCells:SelectedCell[]=[],operations:Operation[]=[];const readKeys=new Set<string>();
 if(sheet&&session?.tableRuntime&&bounds.length) {
  const runtime=session.tableRuntime;
  runtime.bindings?.prune(cell=>session.univerAPI.getWorkbook(cell.unitId)?.getSheetBySheetId(cell.sheetId)?.getRange(cell.row,cell.column).getFormula()??'');
  const seen=new Set<string>();
  const visit=(row:number,column:number)=>{
   const coordinate=row+':'+column;if(seen.has(coordinate))return;seen.add(coordinate);
   if(!bounds.some(r=>row>=r.startRow&&row<=r.endRow&&column>=r.startColumn&&column<=r.endColumn))return;
   const range=sheet.getRange(row,column),value=range.getValue?.()??range.getRawValue(),formula=range.getFormula();
   const location={unitId:workbook!.getId?.()??'',sheetId:sheet.getSheetId?.()??'',row,column};
   const operation=runtime.operations.get(String(value));
   const problems=runtime.diagnostics?referencedProblems(session.univerAPI,runtime,location,formula,value):[];
   const bindings=runtime.bindings?.forCell(location)??[];
   const keys=[...selectionDependencies(session,location)];keys.forEach(key=>readKeys.add(key));
   if(operation)operations.push(operation);
   allCells.push({address:range.getA1Notation(),location,formula,value,operation,problems,readKeys:keys,args:bindings.flatMap(b=>b.args),action:!!operation||FUNCTION_REGISTRY.some(f=>f.category==='Prepare action'&&new RegExp('\\b'+f.name+'\\s*\\(','i').test(formula)),submitted:!!operation&&!!runtime.executions?.[operation.id]});
  };
  sheet.getSheet().getCellMatrix().forValue(visit);
  for(const binding of runtime.bindings?.all()??[]) {
   if(binding.cell.unitId!==workbook!.getId?.()||binding.cell.sheetId!==sheet.getSheetId?.())continue;
   for(const range of bounds)for(let row=Math.max(range.startRow,binding.cell.row);row<=Math.min(range.endRow,binding.cell.row+binding.rows-1);row++)for(let column=Math.max(range.startColumn,binding.cell.column);column<=Math.min(range.endColumn,binding.cell.column+binding.columns-1);column++)visit(row,column);
  }
 }
 const actionCells=allCells.filter(c=>c.action);
 const attention=allCells.filter(c=>c.problems.length||c.action&&!c.operation||c.submitted||typeof c.value==='string'&&/^#(VALUE!|N\/A|CONNECT!|GETTING_DATA|ERROR!|REF!|SPILL!)/.test(c.value)).length;
 return {label:ranges.map(r=>r.getA1Notation()).join(', ')||'Select a cell',single:bounds.length===1&&bounds[0]!.startRow===bounds[0]!.endRow&&bounds[0]!.startColumn===bounds[0]!.endColumn,operations,actionCells,allCells,cells:allCells.slice(0,30),cellCount:allCells.length,readKeys,attention,readCount:allCells.filter(c=>c.readKeys.length).length,calculating:session?.tableRuntime?.calculating??false,ready:Boolean(session)};
}
