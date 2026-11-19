import type {FUniver} from '@univerjs/core/facade';
import {SetTriggerFormulaCalculationStartMutation} from '@univerjs/engine-formula';
import type {CellLocation} from '../../table/cell-diagnostics';
import { TABLE_FUNCTIONS } from '../../table/function-registry';

const tableCall = new RegExp('\\b(?:' + TABLE_FUNCTIONS.map(([name]) => name).join('|') + ')\\s*\\(', 'i');

/** Univer 1.4's trigger merges these dirty ranges with pending edits and follows dependencies. */
export function recalculateTableCells(api:FUniver,cells:CellLocation[]) {
  if(!cells.length)return;
  void api.executeCommand(SetTriggerFormulaCalculationStartMutation.id,{
    forceCalculation:false,
    dirtyRanges:cells.map(cell=>({unitId:cell.unitId,sheetId:cell.sheetId,range:{startRow:cell.row,endRow:cell.row,startColumn:cell.column,endColumn:cell.column}})),
  },{onlyLocal:true});
}

/** Univer's normal startup skips formulas that already have a saved value. */
export function rebindSavedTableCells(api: FUniver) {
  const workbook = api.getActiveWorkbook();
  if (!workbook) return;
  const unitId = workbook.getId();
  const cells: CellLocation[] = [];
  for (const sheet of workbook.getSheets()) {
    const sheetId = sheet.getSheetId();
    sheet.getSheet().getCellMatrix().forValue((row, column, cell) => {
      const formula = cell?.f ?? (cell?.si ? sheet.getRange(row, column).getFormula() : '');
      if (tableCall.test(formula)) cells.push({ unitId, sheetId, row, column });
    });
  }
  recalculateTableCells(api, cells);
}
