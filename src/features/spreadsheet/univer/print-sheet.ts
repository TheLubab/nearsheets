import { getDisplayValueFromCell, type IStyleData } from '@univerjs/core';
import type { FWorksheet } from '@univerjs/sheets/facade';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

// Only emit allowlisted CSS values: workbook content is untrusted input.
function color(value: unknown): string {
  return typeof value === 'string' && /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i.test(value) ? value : 'inherit';
}

function cellCss(style: IStyleData): string {
  return [
    `color:${color(style.cl?.rgb)}`,
    `background-color:${color(style.bg?.rgb)}`,
    `font-weight:${style.bl === 1 ? '700' : '400'}`,
    `font-style:${style.it === 1 ? 'italic' : 'normal'}`,
    `font-size:${Number.isFinite(style.fs) ? Math.max(1, Math.min(200, style.fs!)) : 11}pt`,
    `text-align:${({ 1: 'left', 2: 'center', 3: 'right', 4: 'justify' } as Record<number, string>)[style.ht ?? 0] ?? 'left'}`,
    `vertical-align:${({ 1: 'top', 2: 'middle', 3: 'bottom' } as Record<number, string>)[style.vt ?? 0] ?? 'middle'}`,
    `text-decoration:${[style.ul?.s === 1 ? 'underline' : '', style.st?.s === 1 ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'}`,
  ].join(';');
}

/** Read the current calculated sheet; never refresh, save, or execute it. */
export function sheetPrintHtml(sheet: FWorksheet, title: string): string {
  const model = sheet.getSheet();
  const range = model.getCellMatrixPrintRange();
  if (!range) throw new Error('This sheet is empty. Add some content before printing.');
  if ((range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1) > 100_000) {
    throw new Error('This sheet is too large to print in the browser (maximum 100,000 cells).');
  }
  const rows: number[] = [];
  const columns: number[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) if (model.getRowVisible(r)) rows.push(r);
  for (let c = range.startColumn; c <= range.endColumn; c++) if (model.getColVisible(c)) columns.push(c);
  if (!rows.length || !columns.length) throw new Error('This sheet has no visible content to print.');
  const covered = new Set<string>();
  const merges = new Map<string, { rowSpan: number; colSpan: number; row: number; col: number }>();
  for (const merge of model.getMergeData()) {
    const mergedRows = rows.filter(r => r >= merge.startRow && r <= merge.endRow);
    const mergedColumns = columns.filter(c => c >= merge.startColumn && c <= merge.endColumn);
    if (!mergedRows.length || !mergedColumns.length) continue;
    for (const r of mergedRows) for (const c of mergedColumns) covered.add(`${r}:${c}`);
    const anchor = `${mergedRows[0]}:${mergedColumns[0]}`;
    covered.delete(anchor);
    merges.set(anchor, { rowSpan: mergedRows.length, colSpan: mergedColumns.length, row: merge.startRow, col: merge.startColumn });
  }
  const body = rows.map(r => '<tr>' + columns.map(c => {
    const key = `${r}:${c}`;
    if (covered.has(key)) return '';
    const merge = merges.get(key);
    const row = merge?.row ?? r;
    const col = merge?.col ?? c;
    const value = getDisplayValueFromCell(model.getCell(row, col));
    const style = model.getComposedCellStyle(row, col);
    return `<td rowspan="${merge?.rowSpan ?? 1}" colspan="${merge?.colSpan ?? 1}" style="${cellCss(style)}">${escapeHtml(value)}</td>`;
  }).join('') + '</tr>').join('');
  const heading = escapeHtml(`${title} — ${sheet.getSheetName()}`);
  const widths = columns.map(c => sheet.getColumnWidth(c));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const colgroup = '<colgroup>' + widths.map(width => `<col style="width:${width / totalWidth * 100}%">`).join('') + '</colgroup>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${heading}</title>
    <style>
      @page { margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 24px; font: 11pt Arial, sans-serif; color: #171717; background: white; }
      nav { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
      button { padding: 8px 16px; cursor: pointer; }
      h1 { font-size: 14pt; margin: 0 0 16px; }
      table { border-collapse: collapse; table-layout: fixed; width: 100%; }
      td { border: 1px solid #ddd; padding: 4px 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
      tr { break-inside: avoid; }
      @media print { body { margin: 0; } nav { display: none; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body><nav><button id="print" type="button">Print / Save as PDF</button><span>Active sheet · Choose paper, orientation and scale in the print dialog.</span></nav>
    <h1>${heading}</h1><table>${colgroup}${body}</table></body></html>`;
}

/** Open synchronously from the menu gesture so browsers can allow the window. */
export function printSheet(sheet: FWorksheet, title: string): void {
  const html = sheetPrintHtml(sheet, title);
  const preview = window.open('', '_blank');
  if (!preview) throw new Error('Allow pop-ups for NearSheets, then choose File → Print again.');
  try {
    preview.opener = null;
    preview.document.open();
    preview.document.write(html);
    preview.document.close();
    const print = () => { if (!preview.closed) { preview.focus(); preview.print(); } };
    preview.document.getElementById('print')?.addEventListener('click', print);
    // Keep the view open after cancellation, with a button to print again.
    void preview.document.fonts.ready.then(() => preview.setTimeout(print, 100));
  } catch (cause) {
    preview.close();
    throw cause;
  }
}
