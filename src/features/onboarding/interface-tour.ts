import { driver } from 'driver.js';
import type { Config, Driver, PopoverDOM } from 'driver.js';

export const TOUR_ENDED_EVENT = 'nearsheets:tour-ended';
let activeTours = 0;
export const hasActiveTour = () => activeTours > 0;

export interface InterfaceTourStep {
  align?: 'start' | 'center' | 'end';
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
  let frame = 0;
  let popover: PopoverDOM | undefined;
  let previousBounds = '';
  activeTours++;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
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
      steps: steps.map(step => ({ element: step.element, popover: { description: step.text, side: 'bottom', align: step.align ?? 'start' } })),
      animate: false, overlayOpacity: 0.3, stagePadding: 5, stageRadius: 6,
      popoverClass: 'nearsheets-guide',
      showProgress: true, progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next', prevBtnText: 'Back', doneBtnText: 'Done', closeBtnLabel: 'Skip tour',
      disableActiveInteraction: true,
      allowClose: true, overlayClickBehavior: 'none', allowKeyboardControl: true,
      waitForElement: 2500,
      onPopoverRender: value => {
        popover = value; previousBounds = '';
        // Driver 1.11 focuses its first button after this hook (the close X).
        // Move focus to the primary action before paint, including each new step.
        queueMicrotask(() => {
          if (!stopped && popover === value && value.wrapper.isConnected) {
            value.nextButton.focus({ preventScroll: true });
          }
        });
      },
      onElementMissing: () => { fail(); return false; },
      onDestroyed: (_element, _step, options) => {
        if (stopped) return;
        cleanup();
        if (options.reason === 'done' || options.reason === 'close' || options.reason === 'escape' || options.reason === 'overlay') onDismissed?.();
        onStopped();
      },
    });
    instance.drive();
    // Ribbon tabs can move after first paint (fonts, File placement, overflow).
    // Follow their actual bounds rather than retaining the initial arrow position.
    const followTarget = () => {
      if (stopped) return;
      const target = instance?.getActiveElement();
      if (target && popover) {
        const rect = target.getBoundingClientRect();
        const bounds = `${rect.left},${rect.top},${rect.width},${rect.height}`;
        if (bounds !== previousBounds) { previousBounds = bounds; instance?.refresh(); }
        const box = popover.wrapper.getBoundingClientRect();
        const arrow = popover.arrow;
        if (arrow.classList.contains('driver-popover-arrow-side-bottom') || arrow.classList.contains('driver-popover-arrow-side-top')) {
          arrow.style.left = `${Math.max(16, Math.min(box.width - 26, rect.left + rect.width / 2 - box.left - 5))}px`;
        }
      }
      frame = requestAnimationFrame(followTarget);
    };
    if (!stopped) frame = requestAnimationFrame(followTarget);
  } catch { fail(); }
  return cleanup;
}

/** Wait for visible controls and for the loading screen to leave the workspace. */
export function startInterfaceTourWhenReady(options: InterfaceTourOptions) {
  let stopped = false, frame = 0;
  let stopTour: (() => void) | undefined;
  const observer = new MutationObserver(() => schedule());
  const tryStart = () => {
    frame = 0;
    if (stopped || stopTour || hasActiveTour() || document.querySelector('.workspace-loading, [role="dialog"], [role="menu"][data-state="open"]')) return;
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
    align: 'center',
    text: 'Use this tab to connect spreadsheet cells with NEAR data and actions.' },
  { element: '[data-guide-wallet]',
    text: 'Connect a wallet here when you need to review and sign an action. Reading and editing do not require sign-in.' },
  { element: '[data-document-menu-trigger]',
    text: 'Spreadsheets save automatically in this browser. File lets you open saved spreadsheets, import files or download a backup.' },
];

export function gettingStartedInterfaceSteps(transactionSheetId?: string): InterfaceTourStep[] {
  const steps = [{
    element: () => [...document.querySelectorAll('.workbook-session canvas')].find(canvas => canvas.getBoundingClientRect().height > 100)!,
    text: transactionSheetId
      ? 'Start with these cells. Try the editable account and token inputs to see the balances change.'
      : 'Use cells to combine live data, formulas and action drafts. Arrange this spreadsheet however you need.',
  }, ...GETTING_STARTED_INTERFACE_STEPS];
  if (transactionSheetId) steps.push({
    element: `.workbook-session [data-u-comp="slide-tab-item"][data-id="${CSS.escape(transactionSheetId)}"]`,
    text: 'When you’re done here, open Try a transaction for the next guide. It walks through an optional payment proposal.',
  });
  return steps;
}
