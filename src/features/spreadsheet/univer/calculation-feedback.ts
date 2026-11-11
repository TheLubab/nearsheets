import type { Univer } from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { IUIPartsService, SheetsUIPart, TriggerCalculationController, SetFormulaCalculationStopMutation } from '@univerjs/preset-sheets-core';
import { of } from 'rxjs';
import type { Observable } from 'rxjs';
import { loadingToast, TOAST_IDS } from '../../../components/ui/toast';

/** Follow the engine's progress, including cancellation and overlapping work.
 * Its stream already suppresses calculations shorter than one second. */
export function observeCalculationFeedback(
  progress: Observable<{ count: number; done: number }>,
  stop: () => void,
) {
  let finish: (() => void) | undefined;
  const clear = () => { finish?.(); finish = undefined; };
  const subscription = progress.subscribe({
    next: ({ count, done }) => {
      if (count > 0 && done < count) {
        finish ??= loadingToast(TOAST_IDS.calculation, 'Calculating…', {
          action: { label: 'Stop', onClick: stop },
        });
      } else clear();
    },
    complete: clear,
    error: clear,
  });
  return { dispose: () => { subscription.unsubscribe(); clear(); } };
}

export function registerCalculationFeedback(univer: Univer) {
  const injector = univer.__getInjector();
  const parts = injector.get(IUIPartsService);
  const calculation = injector.get(TriggerCalculationController);
  const commands = injector.get(ICommandService);
  // In installed Univer 1.4 FORMULA_AUX contains only FormulaProgressBar.
  // Disable that presentation through the UI API; keep calculation untouched.
  const hidden = parts.registerDisabledUIParts([SheetsUIPart.FORMULA_AUX], of(true));
  const feedback = observeCalculationFeedback(calculation.progress$, () => {
    commands.executeCommand(SetFormulaCalculationStopMutation.id);
  });
  return { dispose: () => { feedback.dispose(); hidden.dispose(); } };
}
