import { driver } from 'driver.js';
import type { Config, Driver } from 'driver.js';

export const TOUR_ENDED_EVENT = 'nearsheets:tour-ended';
let activeTours = 0;
export const hasActiveTour = () => activeTours > 0;

export interface InterfaceTourStep {
  element: string | (() => Element);
  text: string;
}
export interface InterfaceTourOptions {
  steps: InterfaceTourStep[];
  onStopped(): void;
  onDismissed?(): void;
  onError(message: string): void;
  createDriver?: (config: Config) => Driver;
}

/** Interface orientation only: no workbook commands, cell edits or wallet access. */
export function startInterfaceTour({ steps, onStopped, onDismissed, onError, createDriver = driver }: InterfaceTourOptions) {
  let instance: Driver | undefined;
  let stopped = false;
  activeTours++;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    activeTours--;
    instance?.destroy();
    window.dispatchEvent(new Event(TOUR_ENDED_EVENT));
  };
  const fail = () => {
    cleanup();
    onError('The interface guide could not open. You can try it again from Help.');
    onStopped();
  };
  try {
    instance = createDriver({
      steps: steps.map(step => ({ element: step.element, popover: { description: step.text, side: 'bottom', align: 'start' } })),
      animate: false, overlayOpacity: 0.3, stagePadding: 5, stageRadius: 6,
      popoverClass: 'nearsheets-guide',
      showProgress: true, progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next', prevBtnText: 'Back', doneBtnText: 'Done', closeBtnLabel: 'Skip tour',
      disableActiveInteraction: true,
      allowClose: true, overlayClickBehavior: 'none', allowKeyboardControl: true,
      waitForElement: 2500,
      onElementMissing: () => { fail(); return false; },
      onDestroyed: (_element, _step, options) => {
        if (stopped) return;
        cleanup();
        if (options.reason === 'done' || options.reason === 'close' || options.reason === 'escape' || options.reason === 'overlay') onDismissed?.();
        onStopped();
      },
    });
    instance.drive();
  } catch { fail(); }
  return cleanup;
}

/** Start on visible UI, without waiting for Univer's delayed Steady stage. */
export function startInterfaceTourWhenReady(options: InterfaceTourOptions) {
  let stopped = false, frame = 0;
  let stopTour: (() => void) | undefined;
  const observer = new MutationObserver(() => schedule());
  const tryStart = () => {
    frame = 0;
    if (stopped || stopTour || hasActiveTour() || document.querySelector('[role="dialog"], [role="menu"][data-state="open"]')) return;
    const target = options.steps[0]?.element;
    const element = typeof target === 'function' ? target() : target ? document.querySelector(target) : null;
    if (!element || !element.getBoundingClientRect().width) return;
    if (![...document.querySelectorAll('.workbook-session canvas')].some(canvas => canvas.getBoundingClientRect().height > 100)) return;
    observer.disconnect();
    window.removeEventListener(TOUR_ENDED_EVENT, schedule);
    stopTour = startInterfaceTour(options);
  };
  const schedule = () => {
    if (!stopped && !stopTour && !frame) frame = requestAnimationFrame(tryStart);
  };
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-state'] });
  window.addEventListener(TOUR_ENDED_EVENT, schedule);
  schedule();
  return () => {
    stopped = true; observer.disconnect(); cancelAnimationFrame(frame);
    window.removeEventListener(TOUR_ENDED_EVENT, schedule);
    stopTour?.();
  };
}

export const GETTING_STARTED_INTERFACE_STEPS: InterfaceTourStep[] = [
  { element: '.workbook-session [data-u-comp="ribbon-header-menu"] [role="tab"][title="Blockchain"]',
    text: 'Use this tab to connect spreadsheet cells with NEAR data and actions.' },
  { element: '[data-guide-wallet]',
    text: 'Connect a wallet here when you need to review and sign an action. Reading and editing do not require sign-in.' },
  { element: '[data-document-menu-trigger]',
    text: 'Workbooks save automatically in this browser. File lets you open saved workbooks, import files or export a backup.' },
];

export function gettingStartedInterfaceSteps(transactionSheetId?: string): InterfaceTourStep[] {
  const steps = [...GETTING_STARTED_INTERFACE_STEPS, {
    element: () => [...document.querySelectorAll('.workbook-session canvas')].find(canvas => canvas.getBoundingClientRect().height > 100)!,
    text: transactionSheetId
      ? 'Continue with the guide in this sheet. Try the editable account and token inputs to see the balances change.'
      : 'Your workbook holds live data, formulas and action drafts together. The cells remain yours to arrange and edit.',
  }];
  if (transactionSheetId) steps.push({
    element: `.workbook-session [data-u-comp="slide-tab-item"][data-id="${CSS.escape(transactionSheetId)}"]`,
    text: 'When you’re done here, open Try a transaction for the next guide. It walks through an optional payment proposal.',
  });
  return steps;
}
