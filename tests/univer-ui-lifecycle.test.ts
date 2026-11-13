import { afterEach, describe, expect, it, vi } from 'vitest';
import { SingleUnitUIController } from '@univerjs/preset-sheets-core';

// Exercise the installed, patched controller without rendering a browser UI.
class TestController extends SingleUnitUIController {
  private renderCallback!: (content: HTMLElement, container: HTMLElement) => void;
  bootstrap(callback: (content: HTMLElement, container: HTMLElement) => void) {
    this.renderCallback = callback;
    return { dispose() {} };
  }
  boot() { this._bootstrapWorkbench(); }
  async render() { await this.renderCallback({} as HTMLElement, {} as HTMLElement); }
}
function fixture() {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout });
  let ready!: () => void;
  const stage = new Promise<void>(resolve => { ready = resolve; });
  const lifecycle = { onStage: vi.fn(() => stage) };
  const renders = { getRenderAll: vi.fn(() => new Map()) };
  const controller = new TestController(
    { get: () => undefined } as never,
    {} as never,
    { registerRootContainerElement: () => ({ dispose() {} }), registerContentElement: () => ({ dispose() {} }) } as never,
    lifecycle as never,
    renders as never,
  );
  controller.boot();
  return { controller, lifecycle, renders, ready };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Univer 1.4 workbench disposal race', () => {
  it('ignores a React render callback arriving after disposal', async () => {
    const f = fixture();
    f.controller.dispose();
    await expect(f.controller.render()).resolves.toBeUndefined();
    expect(f.lifecycle.onStage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not queue rendering when Ready resolves after disposal', async () => {
    const f = fixture();
    const rendering = f.controller.render();
    expect(f.lifecycle.onStage).toHaveBeenCalledOnce();
    f.controller.dispose();
    f.ready();
    await rendering;
    await vi.runAllTimersAsync();
    expect(f.renders.getRenderAll).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the render timer when disposed during its 300ms delay', async () => {
    const f = fixture();
    f.ready();
    await f.controller.render();
    expect(vi.getTimerCount()).toBe(1);
    f.controller.dispose();
    await vi.runAllTimersAsync();
    expect(f.renders.getRenderAll).not.toHaveBeenCalled();
  });
});
