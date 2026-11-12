import { afterEach, describe, expect, it, vi } from 'vitest';
import { Univer, LocaleType } from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import '@univerjs/sheets/facade';
import { printSheet, sheetPrintHtml } from '../src/features/spreadsheet/univer/print-sheet';

function fixture() {
  const univer = new Univer({ locale: LocaleType.EN_US });
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverSheetsNumfmtPlugin);
  const api = FUniver.newAPI(univer);
  const book = api.createWorkbook({ id: 'print-test', sheetOrder: ['first', 'second'], sheets: {
    first: { id: 'first', name: 'Other sheet', cellData: { 0: { 0: { v: 'Do not print' } } } },
    second: { id: 'second', name: 'Current <sheet>', rowCount: 30, columnCount: 10,
      rowData: { 2: { hd: 1 } }, columnData: { 2: { hd: 1 } },
      mergeData: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 }],
      cellData: {
        0: { 0: { v: '<script>alert(1)</script>', s: { bl: 1, bg: { rgb: '#ffeeaa' } } } },
        1: { 0: { v: 1234.5, f: '=1000+234.5', s: { n: { pattern: '#,##0.00' } } }, 1: { v: '00001234567890123456789' }, 2: { v: 'Hidden column' } },
        2: { 0: { v: 'Hidden row' } },
        3: { 0: { v: '#VALUE!' } },
      },
    },
  } });
  const sheet = book.getSheetBySheetId('second')!;
  return { univer, book, sheet };
}

afterEach(() => vi.unstubAllGlobals());

describe('sheet printing', () => {
  it('prints calculated formatted values, exact text, merges and basic styles without changing the workbook', () => {
    const { univer, book, sheet } = fixture();
    try {
      const before = book.save();
      const html = sheetPrintHtml(sheet, 'My <workbook>');
      expect(html).toContain('1,234.50');
      expect(html).toContain('00001234567890123456789');
      expect(html).toContain('#VALUE!');
      expect(html).toContain('colspan="2"');
      expect(html).toContain('font-weight:700');
      expect(html).toContain('background-color:#ffeeaa');
      expect(html).toContain('My &lt;workbook&gt; — Current &lt;sheet&gt;');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('Hidden row');
      expect(html).not.toContain('Hidden column');
      expect(html).not.toContain('Do not print');
      expect(html).not.toContain('=1000+234.5');
      expect(book.save()).toEqual(before);
    } finally { univer.dispose(); }
  });

  it('reports blocked popups and empty sheets without opening a blank print window', () => {
    const { univer, book, sheet } = fixture();
    try {
      const open = vi.fn(() => null);
      vi.stubGlobal('window', { open });
      expect(() => printSheet(sheet, 'Title')).toThrow('Allow pop-ups');
      const empty = book.create('Empty', 10, 10);
      expect(() => printSheet(empty, 'Title')).toThrow('empty');
      expect(open).toHaveBeenCalledTimes(1);
    } finally { univer.dispose(); }
  });

  it('refuses oversized print ranges rather than truncating or freezing the page', () => {
    const { univer, sheet } = fixture();
    try {
      vi.spyOn(sheet.getSheet(), 'getCellMatrixPrintRange').mockReturnValue({ startRow: 0, startColumn: 0, endRow: 1000, endColumn: 100 });
      expect(() => sheetPrintHtml(sheet, 'Title')).toThrow('too large');
    } finally { univer.dispose(); }
  });

  it('opens a print view and invokes browser printing once it is ready', async () => {
    const { univer, sheet } = fixture();
    try {
      const button = { addEventListener: vi.fn() };
      const preview = { opener: {}, closed: false, focus: vi.fn(), print: vi.fn(), close: vi.fn(),
        setTimeout: vi.fn((callback: () => void) => callback()),
        document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), getElementById: vi.fn(() => button), fonts: { ready: Promise.resolve() } },
      };
      vi.stubGlobal('window', { open: vi.fn(() => preview) });
      printSheet(sheet, 'Title');
      await Promise.resolve();
      expect(preview.opener).toBeNull();
      expect(preview.document.write).toHaveBeenCalledWith(expect.stringContaining('<table>'));
      expect(preview.print).toHaveBeenCalledTimes(1);
      expect(preview.close).not.toHaveBeenCalled();
      expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    } finally { univer.dispose(); }
  });
});
