import type { IDisposable, IWorkbookData } from "@univerjs/core";
import type { FUniver, WorkbookEngineFactory } from "./create-univer-engine";
import type { FWorkbook } from "@univerjs/sheets/facade";
import { createUniverEngine } from "./create-univer-engine";

export interface CreateWorkbookSessionOptions {
  /** Element that owns the editor. */
  container: HTMLElement;
  /** Optional starting snapshot; a blank worksheet is used when omitted. */
  initialWorkbook?: Partial<IWorkbookData>;
  /** Called once the editor reaches the steady lifecycle stage. */
  onReady?: (session: WorkbookSession) => void;
  /** Injection point for tests. Defaults to the real Univer engine. */
  createEngine?: WorkbookEngineFactory;
}

/**
 * A mounted spreadsheet editor plus the application-facing surface.
 *
 * Lifecycle rules this type guarantees:
 * - `dispose()` is idempotent, so React Strict Mode may clean up twice.
 * - Cleanup detaches the engine's DOM immediately, so a remount never inherits
 *   a half-torn-down canvas.
 * - The engine is disposed asynchronously because Univer synchronously
 *   unmounts its internal React root, which React refuses during teardown.
 * - Pending readiness promises resolve instead of hanging after disposal.
 */
export interface WorkbookSession {
  readonly univerAPI: FUniver;
  /** Current workbook, or `null` while none is active. */
  getWorkbook(): FWorkbook | null;
  /** Lossless Univer snapshot of the active workbook. */
  saveSnapshot(): IWorkbookData | null;
  /** Resolves when formula controllers can accept edits. */
  whenReady(): Promise<void>;
  /** Idempotent teardown. Safe to call during a React effect cleanup. */
  dispose(): void;
}

export function createWorkbookSession(
  options: CreateWorkbookSessionOptions,
): WorkbookSession {
  const createEngine = options.createEngine ?? createUniverEngine;
  const engine = createEngine({
    container: options.container,
    initialWorkbook: options.initialWorkbook,
  });
  const { univerAPI } = engine;

  let disposed = false;
  let readyPromise: Promise<void> | null = null;
  let lifecycleListener: IDisposable | null = null;
  const pendingReady: Array<() => void> = [];

  const settleReady = () => {
    for (const resolve of pendingReady.splice(0)) {
      resolve();
    }
  };

  const waitForSteadyStage = (): Promise<void> => {
    if (disposed || engine.hasReachedSteadyStage()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      pendingReady.push(resolve);
      lifecycleListener = engine.onSteadyStage(() => {
        lifecycleListener = null;
        settleReady();
      });
    });
  };

  const getWorkbook = () => univerAPI.getActiveWorkbook();

  const session: WorkbookSession = {
    univerAPI,
    getWorkbook,
    saveSnapshot: () => getWorkbook()?.save() ?? null,
    whenReady: () => {
      readyPromise ??= waitForSteadyStage().then(() => {
        if (!disposed) {
          options.onReady?.(session);
        }
      });
      return readyPromise;
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      lifecycleListener?.dispose();
      lifecycleListener = null;
      settleReady();

      // Detach first, then let Univer tear down after the current React pass.
      engine.mountElement.remove();
      queueMicrotask(() => {
        engine.dispose();
      });
    },
  };

  return session;
}