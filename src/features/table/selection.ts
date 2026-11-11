import type { WorkbookSession } from '../spreadsheet/univer/create-workbook-session';
import type { Operation } from './runtime';

/** Read only populated cells, including disjoint selections, without allocating a full-column matrix. */
export function getTableSelection(session:WorkbookSession|null) {
  const workbook=session?.getWorkbook();
  const sheet=workbook?.getActiveSheet();
  const ranges=sheet?.getSelection()?.getActiveRangeList() ?? [];
  const bounds=ranges.map(range=>range.getRange());
  const operations:Operation[]=[];
  if(sheet && session?.tableRuntime && bounds.length) {
    sheet.getSheet().getCellMatrix().forValue((row,column)=>{
      if(!bounds.some(range=>row>=range.startRow && row<=range.endRow && column>=range.startColumn && column<=range.endColumn))return;
      const value=sheet.getRange(row,column).getValue();
      const operation=session.tableRuntime!.operations.get(String(value));
      if(operation)operations.push(operation);
    });
  }
  return {
    label:ranges.map(range=>range.getA1Notation()).join(', ') || 'Select a cell',
    operations,
    calculating:session?.tableRuntime?.calculating ?? false,
    ready:Boolean(session),
  };
}
