import type { Problem } from '../../table/problems';
import type { CellAlertType } from '@univerjs/preset-sheets-core';
// Pinned Univer 1.4 CellAlertType.ERROR; avoid importing UI facade side effects into core tests.
const ERROR_ALERT:CellAlertType=2;
import { referencedProblems } from '../../table/referenced-problems';
import type { FUniver } from '@univerjs/core/facade';
import type { CellAlertManagerService } from '@univerjs/preset-sheets-core';
import type { TableRuntime } from '../../table/runtime';

function popupMessage(problem:Problem) {
  const detail=problem.details?.trim();
  return problem.message+' '+problem.recovery+(detail?' Details: '+(detail.length>350?detail.slice(0,350)+'… Use Inspect for the full response.':detail):'');
}

/** Enrich Univer 1.4's existing error popup; native selection/editing owns its lifecycle. */
export function registerCellErrorAlerts(api:FUniver, alerts:CellAlertManagerService, runtime:TableRuntime, editing?:{isVisible():{visible:boolean};visible$:{subscribe(callback:()=>void):{unsubscribe():void}}}) {
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
        const [problem]=referencedProblems(api,runtime,{unitId,sheetId:subUnitId,row,column:col},range.getFormula(),range.getRawValue());
        if(!problem)continue;
        const message=popupMessage(problem);
        if(alert.title===problem.title && alert.message===message)continue;
        alerts.showAlert({...alert,title:problem.title,message,width:360,height:150});
      }
    } finally { updating=false; }
  };
  const subscription=alerts.currentAlert$.subscribe(update);
  let disposed=false,queued=false;
  const fallbackKey='nearsheets.blockchain-error:'+api.getActiveWorkbook?.()?.getId();
  const removeFallback=()=>{if(alerts.currentAlert.has(fallbackKey))alerts.removeAlert(fallbackKey);};
  const selected=()=>{
    if(disposed)return;
    const book=api.getActiveWorkbook?.(),cell=book?.getActiveCell();
    if(!book||!cell||editing?.isVisible().visible){removeFallback();return;}
    const location={unitId:book.getId(),sheetId:cell.getSheetId(),row:cell.getRow(),column:cell.getColumn()};
    const formula=cell.getFormula(),value=cell.getValue?.()??cell.getRawValue();
    if(!formula||!['#CONNECT!','#VALUE!','#ERROR!','#N/A'].includes(String(value))){removeFallback();return;}
    const native=alerts.currentAlert.get('SHEET_FORMULA_ALERT:'+book.getId())?.alert;
    if(native&&native.location.subUnitId===location.sheetId&&native.location.row===location.row&&native.location.col===location.column){removeFallback();update();return;}
    const problem=referencedProblems(api,runtime,location,formula,value)[0];
    const title=problem?.title??(value==='#CONNECT!'?'Data connection failed':'Formula needs attention');
    const message=problem?popupMessage(problem):'The formula returned '+value+'. Use Blockchain → Inspect for available details, or refresh the data request.';
    const previous=alerts.currentAlert.get(fallbackKey)?.alert;
    if(previous?.location.row===location.row&&previous.location.col===location.column&&previous.location.subUnitId===location.sheetId&&previous.message===message)return;
    alerts.showAlert({key:fallbackKey,type:ERROR_ALERT,title,message,width:360,height:150,location:{unitId:location.unitId,subUnitId:location.sheetId,row:location.row,col:location.column}});
  };
  const schedule=()=>{if(queued||disposed)return;queued=true;queueMicrotask(()=>{queued=false;selected();});};
  const book=api.getActiveWorkbook?.();
  const listeners=[book?.onSelectionChange(schedule),book?.onCommandExecuted(schedule),api.getFormula?.().calculationEnd(schedule)];
  const editor=editing?.visible$.subscribe(schedule);
  const diagnostics=runtime.diagnostics.subscribe(()=>{update();schedule();});
  schedule();
  return {dispose(){disposed=true;subscription.unsubscribe();diagnostics.dispose();listeners.forEach(l=>l?.dispose());editor?.unsubscribe();removeFallback();}};
}
