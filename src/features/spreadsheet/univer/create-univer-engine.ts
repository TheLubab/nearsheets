import { registerBlockchainRibbon } from './blockchain-ribbon';
import { registerCalculationFeedback } from './calculation-feedback';
import { registerBalanceFormatting } from './balance-format';
import { moveViewControlsToFooter } from './footer-view-controls';
import { TableRuntime, TABLE_FUNCTIONS } from '../../table/runtime';
import { createTableFunctionCatalog } from './table-functions';
import { registerCellErrorAlerts } from './cell-error-alerts';
import { withHelperDiagnostics } from './helper-diagnostics';
import type { CellLocation } from '../../table/cell-diagnostics';
import '@univerjs/sheets-formula/facade';
import type { FUniver } from "@univerjs/core/facade";
import type { IDisposable, IWorkbookData, Univer } from "@univerjs/core";
import { LocaleType, createUniver, mergeLocales, defaultTheme } from "@univerjs/presets";
import { BooleanNumber, IResourceManagerService } from '@univerjs/core';
import { FunctionType } from '@univerjs/engine-formula';
import { UniverSheetsCorePreset, CellAlertManagerService } from "@univerjs/preset-sheets-core";
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

  const runtime = options.tableRuntime ?? new TableRuntime();
  const readFormula=(cell:CellLocation):string=>univerAPI.getWorkbook(cell.unitId)?.getSheetBySheetId(cell.sheetId)?.getRange(cell.row,cell.column).getFormula() ?? '';
  const tableFunctions=createTableFunctionCatalog(runtime,readFormula);
  const helperFunctions=withHelperDiagnostics(customFunctions.functions,runtime,readFormula);
  const tableDescriptions=TABLE_FUNCTIONS.map(([name,parameters,example])=>({functionName:name,functionType:FunctionType.User,description:name+'('+parameters+')',abstract:'Example: '+example,functionParameter:parameters.split(',').map(parameter=>({name:parameter.trim(),detail:parameter.trim(),example:'',require:BooleanNumber.TRUE,repeat:BooleanNumber.FALSE}))}));
  // Univer paints selection borders on canvas, so resolve the CSS color at startup.
  const selectionColor = getComputedStyle(mountElement).getPropertyValue('--selection-color').trim() || '#4B63B6';
  const { univer, univerAPI } = createUniver({
    // Univer 1.4 uses primary.600 for selections and gray.0 for UI surfaces.
    // Keep its semantic error colors and workbook-defined cell styles intact.
    theme: {
      ...defaultTheme,
      gray: {
        0: '#FFFFFF', 50: '#FAFAFA', 100: '#EAE9E6', 200: '#EAEAEA',
        300: '#BAB8B3', 400: '#8B8984', 500: '#6B6965', 600: '#565550',
        700: '#3F3E3A', 800: '#302F2C', 900: '#242424', 1000: '#171715',
      },
      primary: {
        50: '#F5F4F2', 100: '#EAE9E6', 200: '#D6D4D0', 300: '#BAB8B3',
        400: '#8B8984', 500: '#74726D', 600: selectionColor,
        700: '#3F3E3A', 800: '#302F2C', 900: '#242320',
      },
    },
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
        UniverPresetSheetsCoreEnUS,
        customFunctions.localeContent,
        {ui:{...UniverPresetSheetsCoreEnUS.ui,ribbon:{...UniverPresetSheetsCoreEnUS.ui.ribbon,start:"Home",view:"View"}}},
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
          function: [...helperFunctions,...tableFunctions],
          description: [...customFunctions.descriptions,...tableDescriptions],
        },
      }),
    ],
  });

  const registrations: IDisposable[] = [];
  // Native async function classes retain cell identity and real error objects.
  // The preset registers them before workbook creation, including on reopen.
  univerAPI.createWorkbook(options.initialWorkbook ?? {});
  registrations.push(registerCellErrorAlerts(univerAPI,univer.__getInjector().get(CellAlertManagerService),runtime));
  registrations.push(univerAPI.getFormula().calculationStart(() => { runtime.calculating = true; runtime.diagnostics.nextCalculation(); }));
  registrations.push(univerAPI.getFormula().calculationEnd(state => { runtime.calculating = state !== 3; }));
  for(const [command,title] of [['function:NEAR_BALANCE','Insert NEAR balance…'],['inspect','Inspect blockchain cells / receipts'],['review','Prepare and review selected actions']]) {
    univerAPI.createMenu({id:'nearsheets.'+command,title:title!,action:()=>window.dispatchEvent(new CustomEvent('nearsheets:command',{detail:command}))}).appendTo(['contextMenu.mainArea','contextMenu.others']);
  }

  registrations.push(registerBalanceFormatting(univerAPI, univer.__getInjector().get(IResourceManagerService), options.initialWorkbook));
  registrations.push(registerCalculationFeedback(univer));
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
