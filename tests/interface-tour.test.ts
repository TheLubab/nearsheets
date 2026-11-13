import { afterEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import type { Config, Driver, HookOpts, PopoverDOM } from 'driver.js';
import { GETTING_STARTED_INTERFACE_STEPS, hasActiveTour, startInterfaceTour, startInterfaceTourWhenReady } from '../src/features/onboarding/interface-tour';
import type { InterfaceTourOptions } from '../src/features/onboarding/interface-tour';
import { blockchainToolTarget, registerBlockchainTour, REPLAY_BLOCKCHAIN_TOUR_EVENT } from '../src/features/onboarding/blockchain-tour';
import { createTourPreference } from '../src/features/onboarding/tour-preference';

afterEach(() => vi.unstubAllGlobals());

function tourFixture() {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  let config: Config;
  let active = false;
  let instance: Driver;
  const destroy = vi.fn(() => { if (!active) return; active = false; destroyed('api'); });
  const destroyed = (reason: string) => config.onDestroyed?.(undefined, config.steps![0]!, { reason } as HookOpts);
  instance = { drive: () => { active = true; }, destroy } as unknown as Driver;
  const onStopped = vi.fn(), onDismissed = vi.fn(), onError = vi.fn();
  const stop = startInterfaceTour({
    steps: GETTING_STARTED_INTERFACE_STEPS, onStopped, onDismissed, onError,
    createDriver: next => { config = next; return instance; },
  });
  return { config: config!, stop, destroyed, destroy, onStopped, onDismissed, onError };
}

describe('short interface tours', () => {
  it('focuses Next instead of close and cancels deferred focus when the tour ends', async () => {
    const f = tourFixture();
    const next = vi.fn(), close = vi.fn();
    const popover = {
      wrapper: { isConnected: true },
      nextButton: { focus: next },
      closeButton: { focus: close },
    } as unknown as PopoverDOM;
    f.config.onPopoverRender?.(popover, {} as HookOpts);
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith({ preventScroll: true });
    expect(close).not.toHaveBeenCalled();
    next.mockClear();
    f.config.onPopoverRender?.(popover, {} as HookOpts);
    f.stop();
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
  });

  it('shows only one short text per step and blocks activating highlighted controls', () => {
    const f = tourFixture();
    expect(f.config.steps).toHaveLength(3);
    for (const step of f.config.steps!) {
      expect(step.popover?.title).toBeUndefined();
      expect(step.popover?.description?.length).toBeLessThan(150);
    }
    expect(f.config.disableActiveInteraction).toBe(true);
    expect(f.config.closeBtnLabel).toBe('Skip tour');
    expect(f.config.allowKeyboardControl).toBe(true);
    expect(hasActiveTour()).toBe(true);
    f.stop();
    expect(hasActiveTour()).toBe(false);
  });

  it('records an explicit finish/skip, but not cleanup when the editor is replaced', () => {
    const first = tourFixture();
    first.stop(); first.stop();
    expect(first.onDismissed).not.toHaveBeenCalled();
    expect(first.onStopped).not.toHaveBeenCalled();
    const second = tourFixture();
    second.destroyed('close');
    expect(second.onDismissed).toHaveBeenCalledOnce();
    expect(second.onStopped).toHaveBeenCalledOnce();
    expect(hasActiveTour()).toBe(false);
    second.stop();
  });

  it('offers recovery without marking a tour seen when a control is missing', () => {
    const f = tourFixture();
    f.config.onElementMissing?.(undefined, f.config.steps![0]!, {} as never);
    expect(f.onError).toHaveBeenCalledOnce();
    expect(f.onDismissed).not.toHaveBeenCalled();
    expect(f.onStopped).toHaveBeenCalledOnce();
    expect(hasActiveTour()).toBe(false);
    f.stop();
  });
});

it('waits for the loading screen to close even when the tour targets and canvas exist', () => {
  vi.stubGlobal('window', new EventTarget());
  let loading = true;
  const target = { getBoundingClientRect: () => ({ width: 100, height: 200 }) };
  vi.stubGlobal('document', {
    body: {},
    querySelector: (selector: string) => selector.includes('.workspace-loading') ? loading ? {} : null : target,
    querySelectorAll: () => [target],
  });
  let changed!: MutationCallback;
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: MutationCallback) { changed = callback; }
    observe = vi.fn(); disconnect = vi.fn();
  });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const flush = () => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); } };
  const drive = vi.fn(), destroy = vi.fn();
  const stop = startInterfaceTourWhenReady({
    steps: [{ element: '.target', text: 'Try this control.' }],
    onStopped: vi.fn(), onError: vi.fn(),
    createDriver: () => ({ drive, destroy } as unknown as Driver),
  });
  flush();
  expect(drive).not.toHaveBeenCalled();
  loading = false;
  changed([], {} as MutationObserver);
  flush();
  expect(drive).toHaveBeenCalledOnce();
  stop();
  expect(destroy).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});

function contextualFixture(preference = createTourPreference(() => ({ getItem: () => null, setItem: vi.fn() }))) {
  const events = new EventTarget();
  vi.stubGlobal('window', events);
  let modal = false, toolbarReady = true;
  const mutations: MutationCallback[] = [];
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: MutationCallback) { mutations.push(callback); }
    observe = vi.fn(); disconnect = vi.fn();
  });
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('document', { body: {}, querySelector: () => modal ? {} : null });
  const root = { isConnected: true, querySelector: () => toolbarReady ? {} : null } as unknown as HTMLElement;
  const tab = new BehaviorSubject('ribbon.start');
  const ribbon = { activatedTab$: tab, setActivatedTab: vi.fn((value: string) => tab.next(value)) };
  const cleanups: ReturnType<typeof vi.fn>[] = [];
  const startTour = vi.fn((_options: InterfaceTourOptions) => { const cleanup = vi.fn(); cleanups.push(cleanup); return cleanup; });
  const onError = vi.fn();
  const registration = registerBlockchainTour({ root, ribbon, preference, startTour, onError });
  const flush = () => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); } };
  const mutation = () => mutations.forEach(callback => callback([], {} as MutationObserver));
  return { registration, tab, ribbon, startTour, cleanups, flush, mutation, events, frames,
    modal(value: boolean) { modal = value; }, toolbar(value: boolean) { toolbarReady = value; }, preference };
}

describe('contextual Blockchain tour', () => {
  it('waits for the first Blockchain visit and toolbar render rather than starting on editor startup', () => {
    const f = contextualFixture();
    f.flush();
    expect(f.startTour).not.toHaveBeenCalled();
    f.toolbar(false); f.tab.next('ribbon.blockchain'); f.flush();
    expect(f.startTour).not.toHaveBeenCalled();
    expect(f.preference.isDismissed()).toBe(false);
    f.toolbar(true); f.mutation(); f.flush();
    expect(f.startTour).toHaveBeenCalledOnce();
    const steps = f.startTour.mock.calls[0]![0].steps;
    expect(steps).toHaveLength(5);
    expect(steps.map(step => step.text).join(' ')).toContain('what to sign');
    expect(steps.every(step => step.text.length < 150)).toBe(true);
    f.registration.dispose();
  });

  it('waits for a menu or wallet dialog to close and suppresses automatic repeats after dismissal', () => {
    const f = contextualFixture();
    f.modal(true); f.tab.next('ribbon.blockchain'); f.flush();
    expect(f.startTour).not.toHaveBeenCalled();
    f.modal(false); f.mutation(); f.flush();
    const options = f.startTour.mock.calls[0]![0];
    options.onDismissed?.(); options.onStopped();
    expect(f.preference.isDismissed()).toBe(true);
    f.tab.next('ribbon.start'); f.tab.next('ribbon.blockchain'); f.flush();
    expect(f.startTour).toHaveBeenCalledOnce();
    f.registration.dispose();
  });

  it('replays on request even after dismissal, without resetting or editing a workbook', () => {
    const f = contextualFixture();
    f.preference.dismiss();
    f.events.dispatchEvent(new Event(REPLAY_BLOCKCHAIN_TOUR_EVENT)); f.flush();
    expect(f.ribbon.setActivatedTab).toHaveBeenCalledWith('ribbon.blockchain');
    expect(f.startTour).toHaveBeenCalledOnce();
    f.registration.dispose();
    expect(f.cleanups[0]).toHaveBeenCalledOnce();
    expect(f.frames.size).toBe(0);
  });

  it('cancels on tab changes and disposes subscriptions without recording a dismissal', () => {
    const f = contextualFixture();
    f.tab.next('ribbon.blockchain'); f.flush();
    f.tab.next('ribbon.start');
    expect(f.cleanups[0]).toHaveBeenCalledOnce();
    expect(f.preference.isDismissed()).toBe(false);
    f.registration.dispose();
    f.tab.next('ribbon.blockchain'); f.flush();
    expect(f.startTour).toHaveBeenCalledOnce();
  });

  it('uses the visible overflow control when a ribbon tool is collapsed', () => {
    const overflow = {};
    const toolbar = { querySelector: (selector: string) => selector.includes('ribbon-overflow') ? overflow : null };
    const root = { querySelector: () => toolbar } as unknown as HTMLElement;
    expect(blockchainToolTarget(root, ['review'])).toBe(overflow);
  });
});

it('keeps tour preferences separate from workbooks and remembers dismissal across reloads or denied storage', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  const first = createTourPreference(() => storage);
  expect(first.isDismissed()).toBe(false);
  first.dismiss();
  expect(values.get('nearsheets.tours.blockchain.v1')).toBe('true');
  expect(createTourPreference(() => storage).isDismissed()).toBe(true);
  const unavailable = createTourPreference(() => { throw new Error('Denied'); });
  expect(unavailable.isDismissed()).toBe(false);
  unavailable.dismiss();
  expect(unavailable.isDismissed()).toBe(true);
});
