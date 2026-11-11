import type { FUniver } from "@univerjs/core/facade";
import type { IDisposable, IWorkbookData, Univer } from "@univerjs/core";
import { LocaleType, createUniver, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import "@univerjs/sheets/facade";
import "@univerjs/preset-sheets-core/lib/index.css";

/**
 * Everything that is specific to Univer, isolated from session lifecycle.
 * Keeping this boundary explicit lets lifecycle behavior be tested without a
 * browser while the real engine stays a thin adapter.
 */
export interface WorkbookEngine {
  readonly univer: Univer;
  readonly univerAPI: FUniver;
  /**
   * Wrapper element this engine mounted into. The session detaches it during
   * cleanup so a remount cannot be painted over by the outgoing instance.
   */
  readonly mountElement: HTMLElement;
  /** Whether formula controllers can already accept edits. */
  hasReachedSteadyStage(): boolean;
  /** Calls `callback` once, when the editor reaches the steady stage. */
  onSteadyStage(callback: () => void): IDisposable;
  dispose(): void;
}

export interface WorkbookEngineOptions {
  container: HTMLElement;
  initialWorkbook?: Partial<IWorkbookData>;
}

export type WorkbookEngineFactory = (
  options: WorkbookEngineOptions,
) => WorkbookEngine;

/**
 * Real Univer engine: one Univer instance, one sheets-core editor, open source
 * packages only.
 */
export function createUniverEngine(
  options: WorkbookEngineOptions,
): WorkbookEngine {
  // Univer renders its own React root into the element it is given and unmounts
  // that root from inside `univer.dispose()`. A dedicated child element keeps
  // that unmount scoped to this engine instead of the shared host.
  const mountElement = document.createElement("div");
  mountElement.className = "workbook-session";
  mountElement.style.height = "100%";
  options.container.append(mountElement);

  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
    },
    presets: [
      UniverSheetsCorePreset({
        container: mountElement,
        header: true,
        toolbar: true,
        footer: { sheetBar: true, statisticBar: true, zoomSlider: true },
      }),
    ],
  });

  univerAPI.createWorkbook(options.initialWorkbook ?? {});

  let disposed = false;

  return {
    univer,
    univerAPI,
    mountElement,
    hasReachedSteadyStage: () => {
      const steady = univerAPI.Enum.LifecycleStages.Steady;
      return univerAPI.getCurrentLifecycleStage() >= steady;
    },
    onSteadyStage: (callback) => {
      const steady = univerAPI.Enum.LifecycleStages.Steady;
      const listener = univerAPI.addEvent(
        univerAPI.Event.LifeCycleChanged,
        ({ stage }) => {
          if (stage < steady) {
            return;
          }
          listener.dispose();
          callback();
        },
      );
      return listener;
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      univer.dispose();
    },
  };
}

export type { FUniver };