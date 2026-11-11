import type { WorkbookSession } from '../spreadsheet/univer/create-workbook-session';
import type { Operation } from './runtime';
import type { Problem } from './problems';

/** Read only populated cells, including disjoint selections, without allocating a full-column matrix. */
export function getTableSelection(session:WorkbookSession|null) {
  const workbook=session?.getWorkbook();
  const sheet=workbook?.getActiveSheet();
  const ranges=sheet?.getSelection()?.getActiveRangeList() ?? [];
  const bounds=ranges.map(range=>range.getRange());
  const operations:Operation[]=[];
  const cells:Array<{address:string; formula:string; value:unknown; operation?:Operation; problems:Problem[]}>=[];
  let cellCount=0;
  if(sheet && session?.tableRuntime && bounds.length) {
    sheet.getSheet().getCellMatrix().forValue((row,column)=>{
      if(!bounds.some(range=>row>=range.startRow && row<=range.endRow && column>=range.startColumn && column<=range.endColumn))return;
      const range=sheet.getRange(row,column);
      const value=range.getRawValue();
      const operation=session.tableRuntime!.operations.get(String(value));
      if(operation)operations.push(operation);
      cellCount++;
      if(cells.length<30) {
        const formula=range.getFormula();
        const problems=session.tableRuntime!.diagnostics?.get({unitId:workbook!.getId(),sheetId:sheet.getSheetId(),row,column},formula,value) ?? [];
        cells.push({address:range.getA1Notation(),formula,value,operation,problems});
      }
    });
  }
  return {
    label:ranges.map(range=>range.getA1Notation()).join(', ') || 'Select a cell',
    operations,
    cells,
    cellCount,
    calculating:session?.tableRuntime?.calculating ?? false,
    ready:Boolean(session),
  };
}
