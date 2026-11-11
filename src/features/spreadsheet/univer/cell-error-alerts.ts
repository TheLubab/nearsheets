import type { FUniver } from '@univerjs/core/facade';
import type { CellAlertManagerService } from '@univerjs/preset-sheets-core';
import type { TableRuntime } from '../../table/runtime';

/** Enrich Univer 1.4's existing error popup; native selection/editing owns its lifecycle. */
export function registerCellErrorAlerts(api:FUniver, alerts:CellAlertManagerService, runtime:TableRuntime) {
  let updating=false;
  const update=()=>{
    if(updating)return;
    updating=true;
    try {
      for(const [key,{alert}] of alerts.currentAlert) {
        // Only the formula alert, never validation, circular-reference actions,
        // or another plugin's alerts. This key is pinned to Univer 1.4.0.
        if(key!==`SHEET_FORMULA_ALERT:${alert.location.unitId}` || alert.action)continue;
        const {unitId,subUnitId,row,col}=alert.location;
        const range=api.getWorkbook(unitId)?.getSheetBySheetId(subUnitId)?.getRange(row,col);
        if(!range)continue;
        const [problem]=runtime.diagnostics.get({unitId,sheetId:subUnitId,row,column:col},range.getFormula(),range.getRawValue());
        if(!problem)continue;
        const message=problem.message+' '+problem.recovery;
        if(alert.title===problem.title && alert.message===message)continue;
        alerts.showAlert({...alert,title:problem.title,message,width:360,height:150});
      }
    } finally { updating=false; }
  };
  const subscription=alerts.currentAlert$.subscribe(update);
  const diagnostics=runtime.diagnostics.subscribe(update);
  return {dispose(){subscription.unsubscribe();diagnostics.dispose();}};
}
