import type { CellValue, ICellData } from "@univerjs/core";
import type { WorkbookSnapshot } from "../../spreadsheet/model/workbook-snapshot";
import { LocaleType } from "@univerjs/core";

/**
 * CSV is a values-only interchange format, not a workbook format. It carries
 * no formulas, styles, merges, sheet order or document metadata, and importing
 * it always produces a new single-sheet document.
 *
 * The serializer and parser are pure so they can be tested without a browser.
 */

/** CellValueType.FORCE_STRING: keeps text like "=SUM(A1)" as text. */
const FORCE_STRING_TYPE = 4;

const NUMERIC_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export class CsvImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvImportError";
  }
}

function cellToCsvText(value: CellValue | null | undefined | void): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    // String(number) is locale-independent and keeps full float precision.
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  // Rich text or future cell types: fall back to a stable string form.
  return String(value);
}

function quoteField(field: string): string {
  const needsQuotes =
    field.includes(",") ||
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r") ||
    field !== field.trim();
  if (!needsQuotes) {
    return field;
  }
  return `"${field.replaceAll('"', '""')}"`;
}

/** Serializes a value matrix as RFC 4180 CSV with CRLF row separators. */
export function serializeCsv(rows: ReadonlyArray<ReadonlyArray<CellValue | null | undefined>>): string {
  return rows
    .map((row) => row.map((value) => quoteField(cellToCsvText(value))).join(","))
    .join("\r\n");
}

/** Removes a UTF-8 byte-order mark that spreadsheet tools often prepend. */
function stripByteOrderMark(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parses RFC 4180 CSV into a string matrix.
 *
 * Handles quoted fields, escaped quotes, embedded newlines and LF/CRLF/CR row
 * endings. A trailing row ending does not create an extra empty row.
 */
export function parseCsv(input: string): string[][] {
  const text = stripByteOrderMark(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const endField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };

  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (character === ",") {
      endField();
      continue;
    }
    if (character === "\r" || character === "\n") {
      endRow();
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }
    field += character;
    fieldStarted = true;
  }

  if (inQuotes) {
    throw new CsvImportError("The CSV file has an unterminated quoted field.");
  }

  // Only emit the final row when the file does not end with a row separator.
  if (field.length > 0 || fieldStarted || row.length > 0) {
    endRow();
  }

  return rows;
}

/**
 * Converts a CSV cell to a spreadsheet value.
 *
 * Plain numeric text becomes a number so imported budgets stay numeric. Text
 * that merely looks numeric but would lose meaning (leading zeros, integers
 * beyond the safe range) stays text. Text beginning with "=" is forced to
 * text so importing a CSV can never create a formula.
 */
export function convertCsvField(text: string): ICellData | null {
  if (text.length === 0) {
    return null;
  }
  if (text.startsWith("=")) {
    // Forcing the type keeps "=SUM(A1)" as literal text, never a formula.
    return { v: text, t: FORCE_STRING_TYPE as ICellData["t"] };
  }

  const unsigned = text.replace(/^-/, "");
  if (/^0\d+$/.test(unsigned)) {
    // "007" and account-like identifiers must not become 7.
    return { v: text, t: FORCE_STRING_TYPE as ICellData["t"] };
  }

  if (!NUMERIC_PATTERN.test(text)) {
    return { v: text };
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    return { v: text };
  }
  if (Number.isInteger(numeric) && !Number.isSafeInteger(numeric)) {
    // Large integers would be silently rounded; keep the original digits.
    return { v: text, t: FORCE_STRING_TYPE as ICellData["t"] };
  }
  return { v: numeric };
}

export interface CsvWorkbookOptions {
  /** Sheet name; defaults to "Sheet1". */
  sheetName?: string;
  /** Stable sheet id; generated when omitted. */
  sheetId?: string;
  /** Workbook name; defaults to the sheet name. */
  workbookName?: string;
}

/**
 * Builds a single-sheet workbook snapshot from CSV text.
 *
 * The workbook contains values only. It is a valid document body that can be
 * wrapped in an envelope or passed to the editor.
 */
export function workbookSnapshotFromCsv(
  csv: string,
  options: CsvWorkbookOptions = {},
): WorkbookSnapshot {
  const matrix = parseCsv(csv);
  const hasContent = matrix.some((row) => row.some((field) => field.length > 0));
  if (!hasContent) {
    throw new CsvImportError("The CSV file does not contain any values.");
  }

  const columnCount = matrix.reduce((widest, row) => Math.max(widest, row.length), 0);
  const sheetName = options.sheetName?.trim() || "Sheet1";
  const sheetId = options.sheetId ?? `sheet-${globalThis.crypto.randomUUID()}`;
  const workbookId = `workbook-${globalThis.crypto.randomUUID()}`;

  const cellData: Record<number, Record<number, ICellData>> = {};
  matrix.forEach((row, rowIndex) => {
    const cells: Record<number, ICellData> = {};
    row.forEach((field, columnIndex) => {
      const converted = convertCsvField(field);
      if (converted === null) {
        return;
      }
      cells[columnIndex] = converted;
    });
    if (Object.keys(cells).length > 0) {
      cellData[rowIndex] = cells;
    }
  });

  return {
    id: workbookId,
    name: options.workbookName?.trim() || sheetName,
    locale: LocaleType.EN_US,
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: sheetName,
        rowCount: Math.max(matrix.length, 100),
        columnCount: Math.max(columnCount, 26),
        cellData,
      },
    },
  };
}

/**
 * Suggests a sheet name from a file name, without the extension and with
 * control characters removed.
 */
export function sheetNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();
  return (cleaned.length > 0 ? cleaned : "Sheet1").slice(0, 64);
}

export interface CsvSheetSelection {
  /** Sheet to export; defaults to the first sheet in `sheetOrder`. */
  sheetId?: string;
}

/** Nothing to export: the requested sheet is missing or contains no values. */
export class EmptyCsvExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyCsvExportError";
  }
}

/**
 * Extracts a value matrix from a workbook snapshot for CSV export.
 *
 * Only the cell value is used: formulas export their last calculated value,
 * matching what a spreadsheet user sees. Formatting, merges and sheet
 * structure are intentionally dropped because CSV cannot represent them.
 */
export function csvRowsFromSnapshot(
  snapshot: WorkbookSnapshot,
  selection: CsvSheetSelection = {},
): string[][] {
  const sheetId = selection.sheetId ?? snapshot.sheetOrder[0];
  const sheet = sheetId ? snapshot.sheets[sheetId] : undefined;
  if (!sheetId || !sheet) {
    throw new EmptyCsvExportError("The selected sheet does not exist in this workbook.");
  }

  const cellData = sheet.cellData ?? {};
  let lastRow = -1;
  let lastColumn = -1;
  for (const [rowKey, row] of Object.entries(cellData)) {
    const rowIndex = Number(rowKey);
    if (!row) {
      continue;
    }
    for (const [columnKey, cellValue] of Object.entries(row)) {
      const columnIndex = Number(columnKey);
      const cell = cellValue as ICellData | null | undefined;
      if (cell === null || cell === undefined) {
        continue;
      }
      const hasValue =
        cell.v !== null && cell.v !== undefined && String(cell.v).length > 0;
      const hasFormula = typeof cell.f === "string" && cell.f.length > 0;
      if (!hasValue && !hasFormula) {
        continue;
      }
      lastRow = Math.max(lastRow, rowIndex);
      lastColumn = Math.max(lastColumn, columnIndex);
    }
  }

  if (lastRow < 0 || lastColumn < 0) {
    throw new EmptyCsvExportError(
      `Sheet "${sheet.name ?? sheetId}" has no values to export.`,
    );
  }

  const rows: string[][] = [];
  for (let rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
    const row = cellData[rowIndex];
    const values: string[] = [];
    for (let columnIndex = 0; columnIndex <= lastColumn; columnIndex += 1) {
      const cell = row?.[columnIndex] as ICellData | null | undefined;
      values.push(cellToCsvText(cell?.v));
    }
    rows.push(values);
  }
  return rows;
}

/** Serializes one sheet of a snapshot as CSV. */
export function csvFromSnapshot(
  snapshot: WorkbookSnapshot,
  selection: CsvSheetSelection = {},
): string {
  return serializeCsv(csvRowsFromSnapshot(snapshot, selection));
}