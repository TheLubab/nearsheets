import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { toast, TOAST_IDS } from '../src/components/ui/toast';
import { observeCalculationFeedback,observeReadActivity } from '../src/features/spreadsheet/univer/calculation-feedback';
import type { ReadActivity } from '../src/features/spreadsheet/univer/calculation-feedback';
import { TableRuntime } from '../src/features/table/runtime';

describe('calculation feedback', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  function setup() {
    const loading = vi.spyOn(toast, 'loading').mockReturnValue('test');
    const dismiss = vi.spyOn(toast, 'dismiss').mockReturnValue('test');
    const progress = new Subject<{ count: number; done: number }>();
    const stop = vi.fn();
    const feedback = observeCalculationFeedback(progress, stop);
    return { loading, dismiss, progress, stop, feedback };
  }

  it('skips fast work and cancels its pending notification', () => {
    const { progress, loading, feedback } = setup();
    progress.next({ count: 1, done: 0 });
    vi.advanceTimersByTime(100);
    progress.next({ count: 1, done: 1 });
    vi.runAllTimers();
    expect(loading).not.toHaveBeenCalled();
    feedback.dispose();
  });

  it('shows one quiet notification across progress updates, preserves Stop, then dismisses', () => {
    const { progress, loading, dismiss, stop, feedback } = setup();
    progress.next({ count: 10, done: 0 });
    vi.advanceTimersByTime(200);
    progress.next({ count: 10, done: 2 });
    vi.advanceTimersByTime(200);
    expect(loading).toHaveBeenCalledTimes(1);
    const data = loading.mock.calls[0]?.[1];
    expect(loading.mock.calls[0]?.[0]).toBe('Calculating…');
    expect(data?.id).toBe(TOAST_IDS.calculation);
    const action = data?.action;
    if (!action || typeof action !== 'object' || !('onClick' in action)) throw new Error('Missing Stop action');
    action.onClick({} as never);
    expect(stop).toHaveBeenCalledOnce();
    progress.next({ count: 0, done: 0 });
    expect(dismiss).toHaveBeenCalledWith(TOAST_IDS.calculation);
    feedback.dispose();
  });

  it('cleans up pending and visible notifications on disposal or stream completion', () => {
    const { progress, loading, dismiss, feedback } = setup();
    progress.next({ count: 1, done: 0 });
    feedback.dispose();
    vi.runAllTimers();
    expect(loading).not.toHaveBeenCalled();
    progress.next({ count: 1, done: 0 });
    vi.runAllTimers();
    expect(loading).not.toHaveBeenCalled();
    const second = observeCalculationFeedback(progress, vi.fn());
    progress.next({ count: 1, done: 0 });
    vi.advanceTimersByTime(400);
    expect(loading).toHaveBeenCalledOnce();
    progress.complete();
    expect(dismiss).toHaveBeenCalledWith(TOAST_IDS.calculation);
    second.dispose();
  });

  it('describes pending reads and updates one stable notification as work changes',()=>{
    const loading=vi.spyOn(toast,'loading').mockReturnValue('test');
    const dismiss=vi.spyOn(toast,'dismiss').mockReturnValue('test');
    const progress=new Subject<{count:number;done:number}>(),reads=new Subject<ReadActivity>();
    const feedback=observeCalculationFeedback(progress,vi.fn(),reads);
    progress.next({count:3,done:0});reads.next('blockchain');
    vi.advanceTimersByTime(400);
    expect(loading.mock.calls[0]?.[0]).toBe('Querying blockchain…');
    reads.next('blockchain');expect(loading).toHaveBeenCalledTimes(1);
    reads.next('intents');expect(loading.mock.lastCall?.[0]).toBe('Fetching swap quotes…');
    reads.next(null);expect(loading.mock.lastCall?.[0]).toBe('Calculating…');
    expect(loading.mock.calls.every(call=>call[1]?.id===TOAST_IDS.calculation)).toBe(true);
    expect(dismiss).not.toHaveBeenCalled();
    progress.next({count:3,done:3});expect(dismiss).toHaveBeenCalledWith(TOAST_IDS.calculation);
    feedback.dispose();
  });

  it('tracks actual pending queries and leaves cached reads quiet',async()=>{
    let resolve!:(value:string)=>void;
    const runtime=new TableRuntime({view:async()=>null,balance:()=>new Promise(done=>{resolve=done;})},undefined,null);
    const values:ReadActivity[]=[];
    const listener=observeReadActivity(runtime).subscribe(value=>values.push(value));
    try {
      const pending=runtime.calculate('NEAR_BALANCE',['alice.near','mainnet']);
      expect(values.at(-1)).toBe('blockchain');
      resolve('1000000000000000000000000');await pending;
      expect(values.at(-1)).toBeNull();
      values.length=0;await runtime.calculate('NEAR_BALANCE',['alice.near','mainnet']);
      expect(values).not.toContain('blockchain');
    }finally{listener.unsubscribe();runtime.dispose();}
  });
});
