import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { toast, TOAST_IDS } from '../src/components/ui/toast';
import { observeCalculationFeedback } from '../src/features/spreadsheet/univer/calculation-feedback';

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
});
