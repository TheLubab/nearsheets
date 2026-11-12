import type { Univer } from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { IUIPartsService, SheetsUIPart, TriggerCalculationController, SetFormulaCalculationStopMutation } from '@univerjs/preset-sheets-core';
import { of, Observable } from 'rxjs';
import type { TableRuntime } from '../../table/runtime';
import { toast, TOAST_IDS } from '../../../components/ui/toast';

export type ReadActivity='blockchain'|'intents'|null;
export function observeReadActivity(runtime:TableRuntime):Observable<ReadActivity> {
 return new Observable(subscriber=>{
  const publish=()=>{
   const pending=runtime.query.getQueryCache().getAll().filter(query=>query.state.fetchStatus==='fetching');
   subscriber.next(pending.some(query=>!String(query.queryKey[0]).startsWith('intents-'))?'blockchain':pending.length?'intents':null);
  };
  const unsubscribe=runtime.query.getQueryCache().subscribe(publish);publish();return unsubscribe;
 });
}

/** Follow the engine's progress, including cancellation and overlapping work.
 * Its stream already suppresses calculations shorter than one second. */
export function observeCalculationFeedback(
  progress: Observable<{ count: number; done: number }>,
  stop: () => void,
  reads:Observable<ReadActivity>=of(null),
) {
  let timer:ReturnType<typeof setTimeout>|undefined,active=false,visible=false,lastLabel='';
  let activity:ReadActivity=null;
  const label=()=>activity==='blockchain'?'Fetching blockchain data…':activity==='intents'?'Fetching swap quotes…':'Calculating…';
  const show=()=>{
    const message=label();if(visible&&message===lastLabel)return;
    visible=true;lastLabel=message;
    toast.loading(message,{id:TOAST_IDS.calculation,action:{label:'Stop',onClick:stop}});
  };
  const clear=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;active=false;if(visible)toast.dismiss(TOAST_IDS.calculation);visible=false;lastLabel='';};
  const readSubscription=reads.subscribe(next=>{activity=next;if(active&&visible)show();});
  const subscription=progress.subscribe({
    next:({count,done})=>{
      if(count>0&&done<count){if(!active){active=true;timer=setTimeout(()=>{timer=undefined;show();},350);}}
      else clear();
    },complete:clear,error:clear,
  });
  return {dispose:()=>{subscription.unsubscribe();readSubscription.unsubscribe();clear();}};
}

export function registerCalculationFeedback(univer: Univer,runtime:TableRuntime) {
  const injector = univer.__getInjector();
  const parts = injector.get(IUIPartsService);
  const calculation = injector.get(TriggerCalculationController);
  const commands = injector.get(ICommandService);
  // In installed Univer 1.4 FORMULA_AUX contains only FormulaProgressBar.
  // Disable that presentation through the UI API; keep calculation untouched.
  const hidden = parts.registerDisabledUIParts([SheetsUIPart.FORMULA_AUX], of(true));
  const feedback = observeCalculationFeedback(calculation.progress$, () => {
    commands.executeCommand(SetFormulaCalculationStopMutation.id);
  },observeReadActivity(runtime));
  return { dispose: () => { feedback.dispose(); hidden.dispose(); } };
}
