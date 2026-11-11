import { registerBlockchainRibbon } from './blockchain-ribbon';
import { moveViewControlsToFooter } from './footer-view-controls';
import { TableRuntime, TABLE_FUNCTIONS, formulaResult } from '../../table/runtime';
import '@univerjs/sheets-formula/facade';
import type { FUniver } from "@univerjs/core/facade";
import type { IDisposable, IWorkbookData, Univer } from "@univerjs/core";
import { LocaleType, createUniver, mergeLocales, defaultTheme } from "@univerjs/presets";
import { BooleanNumber } from '@univerjs/core';
import { FunctionType } from '@univerjs/engine-formula';
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import {
  createCustomFunctionCatalog,
} from "../../treasury/formulas/custom-functions";
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
  tableRuntime?: TableRuntime;
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

  // Custom functions are registered through the preset so the formula engine
  // knows them before the first calculation. Registration must not run any
  // lookup: these are pure calculations.
  const customFunctions = createCustomFunctionCatalog();

  const { univer, univerAPI } = createUniver({
    theme:{...defaultTheme,primary:{50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b'}},
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
        UniverPresetSheetsCoreEnUS,
        customFunctions.localeContent,
        {ui:{...UniverPresetSheetsCoreEnUS.ui,ribbon:{...UniverPresetSheetsCoreEnUS.ui.ribbon,start:"Edit",view:"View"}}},
      ),
    },
    presets: [
      UniverSheetsCorePreset({
        container: mountElement,
        header: true,
        ribbonType: 'classic',
        formulaBar:true,
        toolbar: true,
        footer: { sheetBar: true, statisticBar: true, zoomSlider: true },
        formula: {
          function: customFunctions.functions,
          description: customFunctions.descriptions,
        },
      }),
    ],
  });

  const runtime = options.tableRuntime ?? new TableRuntime();
  const registrations: IDisposable[] = [];
  // Create the workbook before registering functions. `registerAsyncFunction`
  // schedules a calculation 10ms later by dispatching Univer's
  // `set-trigger-formula-calculation-start` command, which only exists once the
  // sheets plugins have started — and they start when the first unit is
  // created. Registering first makes that dispatch throw
  // "[CommandService]: command ... is not registered".
  univerAPI.createWorkbook(options.initialWorkbook ?? {});
  for (const [name, parameters, example] of TABLE_FUNCTIONS) {
    registrations.push(univerAPI.getFormula().registerAsyncFunction(name,
      async (...args) => {
        const version=runtime.requestVersion(),key=name+' '+JSON.stringify(args);
        try { const result=await runtime.calculate(name,args);runtime.accept(version);runtime.errors.delete(key);return formulaResult(result); }
        catch (cause) { runtime.errors.set(key, cause instanceof Error ? cause.message : String(cause)); return '#VALUE!'; }
      },
      { description: {functionName:name,functionType:FunctionType.User,description:name+'('+parameters+')',abstract:'Example: '+example,functionParameter:parameters.split(',').map(parameter=>({name:parameter.trim(),detail:parameter.trim(),example:'',require:BooleanNumber.TRUE,repeat:BooleanNumber.FALSE}))} }));
  }
  registrations.push(univerAPI.getFormula().calculationStart(() => { runtime.calculating = true; }));
  registrations.push(univerAPI.getFormula().calculationEnd(state => { runtime.calculating = state !== 3; }));
  for(const [command,title] of [['function:NEAR_BALANCE','Insert NEAR balance…'],['inspect','Inspect blockchain cells / receipts'],['review','Prepare and review selected actions']]) {
    univerAPI.createMenu({id:'nearsheets.'+command,title:title!,action:()=>window.dispatchEvent(new CustomEvent('nearsheets:command',{detail:command}))}).appendTo(['contextMenu.mainArea','contextMenu.others']);
  }

  registrations.push(registerBlockchainRibbon(univer,univerAPI));
  moveViewControlsToFooter(univer);

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
      registrations.forEach(item => item.dispose());
      runtime.dispose();
      univer.dispose();
    },
  };
}

export type { FUniver };
