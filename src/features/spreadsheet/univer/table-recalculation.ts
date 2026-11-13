import type {FUniver} from '@univerjs/core/facade';
import {SetTriggerFormulaCalculationStartMutation} from '@univerjs/engine-formula';
import type {CellLocation} from '../../table/cell-diagnostics';

/** Univer 1.4's trigger merges these dirty ranges with pending edits and follows dependencies. */
export function recalculateTableCells(api:FUniver,cells:CellLocation[]) {
  if(!cells.length)return;
  void api.executeCommand(SetTriggerFormulaCalculationStartMutation.id,{
    forceCalculation:false,
    dirtyRanges:cells.map(cell=>({unitId:cell.unitId,sheetId:cell.sheetId,range:{startRow:cell.row,endRow:cell.row,startColumn:cell.column,endColumn:cell.column}})),
  },{onlyLocal:true});
}
