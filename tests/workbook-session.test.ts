import { describe, expect, it, vi } from "vitest";
import type { WorkbookEngine } from "../src/features/spreadsheet/univer/create-univer-engine";
import { createWorkbookSession } from "../src/features/spreadsheet/univer/create-workbook-session";

/**
 * Minimal stand-in for the Univer engine. It records lifecycle calls so the
 * session's mount/cleanup contract can be checked without a browser, canvas or
 * WebGL context.
 */
function createFakeEngine() {
  let connected = true;
  const mountElement = {
    get isConnected() {
      return connected;
    },
    remove() {
      connected = false;
    },
  } as unknown as HTMLElement;
  const steadyListeners = new Set<() => void>();
  let steady = false;
  let disposed = false;

  const engine: WorkbookEngine = {
    // The session only calls `getActiveWorkbook` on the facade.
    univerAPI: {
      getActiveWorkbook: () => null,
    } as unknown as WorkbookEngine["univerAPI"],
    univer: {} as WorkbookEngine["univer"],
    mountElement,
    hasReachedSteadyStage: () => steady,
    onSteadyStage: (callback) => {
      steadyListeners.add(callback);
      return {
        dispose: () => {
          steadyListeners.delete(callback);
        },
      };
    },
    dispose: () => {
      disposed = true;
    },
  };

  return {
    engine,
    reachSteadyStage: () => {
      steady = true;
      for (const listener of [...steadyListeners]) {
        listener();
      }
    },
    isDisposed: () => disposed,
    steadyListenerCount: () => steadyListeners.size,
  };
}

/** The session never inspects the container; the fake engine ignores it. */
const fakeContainer = () => ({}) as HTMLElement;

describe("workbook session lifecycle", () => {
  it("reports ready once and reuses that readiness", async () => {
    const fake = createFakeEngine();
    const onReady = vi.fn();

    const session = createWorkbookSession({
      container: fakeContainer(),
      onReady,
      createEngine: () => fake.engine,
    });

    fake.reachSteadyStage();
    await session.whenReady();
    await session.whenReady();

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(session);
  });

  it("waits for the steady stage before reporting ready", async () => {
    const fake = createFakeEngine();
    const onReady = vi.fn();
    const session = createWorkbookSession({
      container: fakeContainer(),
      onReady,
      createEngine: () => fake.engine,
    });

    const ready = session.whenReady();
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();

    fake.reachSteadyStage();
    await ready;

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("tolerates the Strict Mode double cleanup without leaking listeners", () => {
    const fake = createFakeEngine();
    const session = createWorkbookSession({
      container: fakeContainer(),
      createEngine: () => fake.engine,
    });

    // First mount is cleaned up before it ever reaches the steady stage.
    session.dispose();
    session.dispose();

    expect(fake.steadyListenerCount()).toBe(0);
    expect(fake.engine.mountElement.isConnected).toBe(false);
  });

  it("detaches the editor immediately but defers engine disposal", async () => {
    const fake = createFakeEngine();
    const session = createWorkbookSession({
      container: fakeContainer(),
      createEngine: () => fake.engine,
    });

    session.dispose();

    // Detached synchronously so a remount cannot paint into the outgoing DOM.
    expect(fake.engine.mountElement.isConnected).toBe(false);
    // Disposal is deferred out of the React effect-cleanup pass.
    expect(fake.isDisposed()).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.isDisposed()).toBe(true);
  });

  it("resolves a pending readiness wait when disposed early", async () => {
    const fake = createFakeEngine();
    const session = createWorkbookSession({
      container: fakeContainer(),
      createEngine: () => fake.engine,
    });

    const ready = session.whenReady();
    session.dispose();

    await expect(ready).resolves.toBeUndefined();
  });

  it("returns null snapshots when no workbook is active", () => {
    const fake = createFakeEngine();
    const session = createWorkbookSession({
      container: fakeContainer(),
      createEngine: () => fake.engine,
    });

    expect(session.getWorkbook()).toBeNull();
    expect(session.saveSnapshot()).toBeNull();
  });
});