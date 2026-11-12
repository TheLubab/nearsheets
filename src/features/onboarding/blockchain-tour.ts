import type { IRibbonService } from '@univerjs/preset-sheets-core';
import { blockchainTourPreference } from './tour-preference';
import { hasActiveTour, startInterfaceTour, TOUR_ENDED_EVENT } from './interface-tour';
import type { InterfaceTourOptions, InterfaceTourStep } from './interface-tour';

export const REPLAY_BLOCKCHAIN_TOUR_EVENT = 'nearsheets:tour:blockchain';
const BLOCKCHAIN_TAB = 'ribbon.blockchain';

/** Locate real rendered controls, excluding Univer's hidden measurement copy. */
export function blockchainToolTarget(root: HTMLElement, commands: string[]): Element | null {
  const toolbar = root.querySelector('[data-u-comp="ribbon-toolbar"][aria-label="Blockchain"], [data-u-comp="ribbon-grid-toolbar"]');
  if (!toolbar) return null;
  const controls = commands.map(key => toolbar.querySelector(`[data-u-command="nearsheets.blockchain.${key}"]`));
  const visible = controls.filter((element): element is Element => !!element && element.getBoundingClientRect().width > 0);
  if (visible.length !== commands.length) return toolbar.querySelector('[data-u-comp="ribbon-overflow"]') ?? toolbar;
  let group = visible[0]!;
  while (group.parentElement && group.parentElement !== toolbar && !visible.every(control => group.contains(control))) group = group.parentElement;
  return group;
}

export function blockchainInterfaceSteps(root: HTMLElement): InterfaceTourStep[] {
  return [
    { element: () => blockchainToolTarget(root, ['read'])!,
      text: 'Bring balances, token holdings and contract data into cells without connecting a wallet.' },
    { element: () => blockchainToolTarget(root, ['prepare'])!,
      text: 'Build payment proposals, votes and other action drafts from cell values. Creating a draft does not submit a transaction.' },
    { element: () => blockchainToolTarget(root, ['track'])!,
      text: 'Keep submission status and transaction receipts beside the work that created them.' },
    { element: () => blockchainToolTarget(root, ['refresh', 'details'])!,
      text: 'Fetch fresh values for selected cells, or inspect their source, errors and recorded transactions.' },
    { element: () => blockchainToolTarget(root, ['review'])!,
      text: 'Check amounts, recipients, fees and calls for selected drafts before choosing what to sign.' },
  ];
}

interface BlockchainTourOptions {
  root: HTMLElement;
  ribbon: Pick<IRibbonService, 'activatedTab$' | 'setActivatedTab'>;
  onError(message: string): void;
  preference?: Pick<typeof blockchainTourPreference, 'isDismissed' | 'dismiss'>;
  startTour?: (options: InterfaceTourOptions) => () => void;
}

export function registerBlockchainTour({ root, ribbon, onError, preference = blockchainTourPreference, startTour = startInterfaceTour }: BlockchainTourOptions) {
  let disposed = false, activeTab = '', requested = false, manual = false;
  let stopTour: (() => void) | null = null;
  let frame = 0;
  const observer = new MutationObserver(() => schedule());
  const schedule = () => {
    if (disposed || !requested || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; tryStart(); });
  };
  const request = (force: boolean) => {
    manual = force;
    requested = force || !preference.isDismissed();
    if (!requested) return;
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'aria-label', 'aria-modal'] });
    schedule();
  };
  const tryStart = () => {
    if (disposed || !requested || activeTab !== BLOCKCHAIN_TAB || stopTour) return;
    if (!manual && preference.isDismissed()) { requested = false; observer.disconnect(); return; }
    if (!root.isConnected || hasActiveTour() || document.querySelector('[role="dialog"], [role="menu"][data-state="open"]')) return;
    if (!root.querySelector('[data-u-comp="ribbon-toolbar"][aria-label="Blockchain"], [data-u-comp="ribbon-grid-toolbar"]')) return;
    observer.disconnect(); requested = false; manual = false;
    let stoppedDuringStart = false;
    const cleanup = startTour({
      steps: blockchainInterfaceSteps(root), onError,
      onDismissed: () => preference.dismiss(),
      onStopped: () => { stoppedDuringStart = true; stopTour = null; },
    });
    stopTour = stoppedDuringStart ? null : cleanup;
  };
  const subscription = ribbon.activatedTab$.subscribe(tab => {
    activeTab = tab;
    if (tab === BLOCKCHAIN_TAB) request(false);
    else {
      requested = false; manual = false; observer.disconnect();
      stopTour?.(); stopTour = null;
    }
  });
  const replay = () => {
    stopTour?.(); stopTour = null;
    ribbon.setActivatedTab(BLOCKCHAIN_TAB);
    request(true);
  };
  window.addEventListener(REPLAY_BLOCKCHAIN_TOUR_EVENT, replay);
  window.addEventListener(TOUR_ENDED_EVENT, schedule);
  return { dispose() {
    if (disposed) return;
    disposed = true; observer.disconnect(); cancelAnimationFrame(frame);
    subscription.unsubscribe(); stopTour?.(); stopTour = null;
    window.removeEventListener(REPLAY_BLOCKCHAIN_TOUR_EVENT, replay);
    window.removeEventListener(TOUR_ENDED_EVENT, schedule);
  } };
}
