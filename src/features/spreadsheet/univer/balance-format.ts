import type { FUniver } from '@univerjs/core/facade';
import type { IResourceManagerService, IWorkbookData } from '@univerjs/core';
import { UniverInstanceType } from '@univerjs/core';
import '@univerjs/sheets-numfmt/facade';
import { SetNumfmtCommand } from '@univerjs/sheets-numfmt';
import { SetNumfmtMutation, transformCellsToRange } from '@univerjs/sheets';
import type { ISetCellsNumfmt } from '@univerjs/sheets';
import { z } from 'zod';

export const BALANCE_NUMBER_FORMAT = '[>=0.000001]#,##0.######;[>0]"<0.000001";0';
export const BALANCE_FORMAT_RESOURCE = 'SHEET_NEARSHEETS_BALANCE_FORMAT_PLUGIN';
export const balanceNumberFormat = (value: unknown) => typeof value === 'number' && Number.isInteger(value) ? '#,##0' : BALANCE_NUMBER_FORMAT;
export const isBalanceFormula = (formula: string) => /^=\s*(?:NEAR_BALANCE|FT_BALANCE)\s*\(/i.test(formula);
const stateSchema = z.record(z.string(), z.object({formula:z.string(), pattern:z.string().optional()}));
type FormatState = z.infer<typeof stateSchema>;

/** Native styles hold the display; a resource remembers who chose the format. */
export function registerBalanceFormatting(api: FUniver, resources?: IResourceManagerService, initialWorkbook?: Partial<IWorkbookData>) {
  const states = new Map<string, FormatState>();
  const parse = (data: string): FormatState => {
    try { return stateSchema.parse(JSON.parse(data)); } catch { return {}; }
  };
  const initialResource = initialWorkbook?.resources?.find(item => item.name === BALANCE_FORMAT_RESOURCE);
  const initialId = api.getActiveWorkbook()?.getId();
  if (initialResource && initialId) states.set(initialId, parse(initialResource.data));
  let disposed = false;
  let queued = false;
  const keyFor = (sheet: string, row: number, col: number) => JSON.stringify([sheet,row,col]);
  const scan = (applyDefaults = true) => {
    if (disposed) return;
    const workbook = api.getActiveWorkbook();
    if (!workbook) return;
    const seen = states.get(workbook.getId()) ?? {};
    states.set(workbook.getId(), seen);
    const present = new Set<string>();
    for (const sheet of workbook.getSheets()) {
      const values: ISetCellsNumfmt = [];
      sheet.getSheet().getCellMatrix().forValue((row, col, cell) => {
        if (!cell?.f || !isBalanceFormula(cell.f)) return;
        const key = keyFor(sheet.getSheetId(), row, col);
        present.add(key);
        const pattern = sheet.getRange(row, col).getNumberFormat();
        const previous = seen[key];
        const desired = balanceNumberFormat(cell.v);
        const firstVisit = !previous;
        const managed = previous?.pattern !== undefined && previous.pattern === pattern;
        // Saving may happen before the queued change event. Capture a user's
        // current choice without mutating styles during serialization.
        if (!applyDefaults) {
          if (previous && !managed) seen[key] = {formula:cell.f};
          return;
        }
        if (managed || (firstVisit && (!pattern || pattern.toLowerCase() === 'general'))) {
          seen[key] = {formula:cell.f, pattern:desired};
          if (pattern !== desired) values.push({row, col, pattern:desired});
        } else {
          seen[key] = {formula:cell.f};
        }
      });
      if (values.length) {
        // Automatic defaults don't introduce an independent undo step.
        void api.executeCommand(SetNumfmtMutation.id,
          transformCellsToRange(workbook.getId(), sheet.getSheetId(), values));
      }
    }
    for (const key of Object.keys(seen)) if (!present.has(key)) delete seen[key];
  };
  const update = () => {
    if (disposed || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; scan(); });
  };
  const listeners = [
    api.addEvent(api.Event.SheetValueChanged, update),
    api.getFormula().calculationEnd(update),
    api.addEvent(api.Event.CommandExecuted, event => {
      if (event.id !== SetNumfmtCommand.id) return;
      const params = event.params as {unitId?:string; subUnitId?:string; values?:Array<{row:number; col:number}>} | undefined;
      const book = api.getActiveWorkbook();
      const unitId = params?.unitId ?? book?.getId();
      const sheetId = params?.subUnitId ?? book?.getActiveSheet().getSheetId();
      if (!unitId || !sheetId) return;
      const seen = states.get(unitId);
      if (!seen) return;
      for (const cell of params?.values ?? []) {
        const previous = seen[keyFor(sheetId,cell.row,cell.col)];
        if (previous) delete previous.pattern;
      }
    }),
  ];
  const resource = resources?.registerPluginResource<FormatState>({
    pluginName:BALANCE_FORMAT_RESOURCE, businesses:[UniverInstanceType.UNIVER_SHEET],
    toJson:unitId => { scan(false); return JSON.stringify(states.get(unitId) ?? {}); },
    parseJson:parse,
    onLoad:(unitId,state) => {states.set(unitId,state); update();},
    onUnLoad:unitId => {states.delete(unitId);},
  });
  update();
  return {dispose() { disposed = true; listeners.forEach(listener => listener.dispose()); resource?.dispose(); states.clear(); }};
}
