import type { WorkbookSession } from "../../spreadsheet/univer/create-workbook-session";
import type { TreasuryMetadata } from "../../documents/model/document-envelope";
import type { ActionDraft, DraftIssue } from "../model/action-draft";
import { draftFromRow } from "../model/action-draft";

/**
 * Reads payment rows from the open workbook and validates them as action
 * drafts.
 *
 * This is a read-only pass over cell values. It never writes to the sheet,
 * signs or submits; a later task adds the explicit preview/submit UI on top of
 * the same function.
 */

/** Sheet name convention: payments live on a sheet named like this. */
export const PAYMENTS_SHEET_NAME = "Payments";

/** Column layout, by header text rather than index, so columns can move. */
export const PAYMENT_COLUMNS = {
  reference: ["Reference"],
  recipient: ["Recipient", "NEAR account", "Account"],
  amount: ["Amount", "Amount (NEAR)"],
  asset: ["Asset"],
  decimals: ["Decimals"],
  memo: ["Purpose", "Memo", "Description"],
} as const;

/**
 * Header naming the treasury account the sheet's payments belong to.
 *
 * It is read only when the document has no selected treasury account yet. The
 * sheet's `TREZU_DRAFT` formulas reference the same cell, so the ids the panel
 * reports and the ids the sheet displays cannot disagree.
 */
export const TREASURY_HEADERS = ["Treasury", "Treasury account"] as const;

const HEADER_SCAN_ROWS = 10;

export interface PaymentRow {
  /** 1-based sheet row, for messages. */
  rowNumber: number;
  reference: unknown;
  recipient: unknown;
  amount: unknown;
  assetId: unknown;
  decimals: unknown;
  memo: unknown;
}

export interface CollectedDrafts {
  drafts: ActionDraft[];
  issues: DraftIssue[];
  /** Payment rows that were read, including invalid ones. */
  rowCount: number;
  /** Why no rows were read, when the sheet is missing or unlabelled. */
  problem: string | null;
}

const EMPTY: CollectedDrafts = { drafts: [], issues: [], rowCount: 0, problem: null };

function normalizeHeader(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findColumn(row: readonly unknown[], candidates: readonly string[]): number {
  for (let index = 0; index < row.length; index += 1) {
    const header = normalizeHeader(row[index]);
    if (candidates.some((candidate) => candidate.toLowerCase() === header)) {
      return index;
    }
  }
  return -1;
}

/**
 * Locates the header row and maps the columns this module understands.
 *
 * Reading by header text keeps the layout editable: a user may reorder columns
 * or add their own without breaking draft extraction.
 */
export function findPaymentColumns(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): {
  headerRowIndex: number;
  columns: Record<keyof typeof PAYMENT_COLUMNS, number>;
} | null {
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_ROWS); index += 1) {
    const row = rows[index] ?? [];
    const columns = {
      reference: findColumn(row, PAYMENT_COLUMNS.reference),
      recipient: findColumn(row, PAYMENT_COLUMNS.recipient),
      amount: findColumn(row, PAYMENT_COLUMNS.amount),
      asset: findColumn(row, PAYMENT_COLUMNS.asset),
      decimals: findColumn(row, PAYMENT_COLUMNS.decimals),
      memo: findColumn(row, PAYMENT_COLUMNS.memo),
    };
    if (columns.reference >= 0 && columns.recipient >= 0 && columns.amount >= 0) {
      return { headerRowIndex: index, columns };
    }
  }
  return null;
}

/** Maps raw sheet rows into `PaymentRow` values using a column layout. */
export function paymentRowsFromMatrix(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  layout: {
    headerRowIndex: number;
    columns: Record<keyof typeof PAYMENT_COLUMNS, number>;
  },
): PaymentRow[] {
  const result: PaymentRow[] = [];
  for (let index = layout.headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const cell = (column: number) => (column >= 0 ? (row[column] ?? null) : null);
    const reference = cell(layout.columns.reference);
    const recipient = cell(layout.columns.recipient);
    const amount = cell(layout.columns.amount);
    // A row with no reference, recipient and amount is blank padding.
    if (
      (reference === null || String(reference).trim().length === 0) &&
      (recipient === null || String(recipient).trim().length === 0) &&
      (amount === null || String(amount).trim().length === 0)
    ) {
      continue;
    }
    result.push({
      rowNumber: index + 1,
      reference,
      recipient,
      amount,
      assetId: cell(layout.columns.asset),
      decimals: cell(layout.columns.decimals),
      memo: cell(layout.columns.memo),
    });
  }
  return result;
}

/** Validates already-extracted rows into drafts. */
export function draftsFromRows(
  rows: ReadonlyArray<PaymentRow>,
  treasury: TreasuryMetadata,
): CollectedDrafts {
  const drafts: ActionDraft[] = [];
  const issues: DraftIssue[] = [];
  const seen = new Map<string, number>();

  for (const row of rows) {
    const blankAsset =
      row.assetId === null ||
      row.assetId === undefined ||
      String(row.assetId).trim().length === 0;
    const result = draftFromRow(
      {
        rowNumber: row.rowNumber,
        reference: row.reference,
        recipient: row.recipient,
        amount: row.amount,
        // A blank Asset cell means the treasury's native NEAR; every other
        // asset has to be named, so its precision is never guessed from the
        // amount alone.
        assetId: blankAsset ? "near" : row.assetId,
        decimals: row.decimals,
        memo: row.memo,
      },
      treasury,
    );
    issues.push(...result.issues);
    if (!result.draft) {
      continue;
    }
    const duplicate = seen.get(result.draft.id);
    if (duplicate !== undefined) {
      issues.push({
        field: "reference",
        message: `Row ${row.rowNumber}: the reference repeats row ${duplicate}. A reference must be unique so each payment keeps one identity.`,
      });
      continue;
    }
    seen.set(result.draft.id, row.rowNumber);
    drafts.push(result.draft);
  }

  return { drafts, issues, rowCount: rows.length, problem: null };
}

/**
 * Reads the Payments sheet from a mounted editor and returns drafts.
 *
 * A missing sheet or header is reported, not treated as "no payments": the
 * difference matters before an explicit submission step.
 */
export function collectDraftsFromSession(
  session: WorkbookSession | null,
  treasury: TreasuryMetadata,
  sheetName: string = PAYMENTS_SHEET_NAME,
): CollectedDrafts {
  const workbook = session?.getWorkbook();
  if (!workbook) {
    return { ...EMPTY, problem: "The workbook is not ready yet." };
  }

  const sheet = workbook.getSheetByName(sheetName);
  if (!sheet) {
    return {
      ...EMPTY,
      problem: `Add a sheet named "${sheetName}" with Reference, Recipient and Amount columns.`,
    };
  }

  // `getLastRow`/`getLastColumn` return a zero-based index, so the range size is
  // one greater. Clamp to at least one cell so an empty sheet still reads.
  const rowCount = Math.max(1, Math.min(sheet.getMaxRows(), sheet.getLastRow() + 1));
  const columnCount = Math.max(
    1,
    Math.min(sheet.getMaxColumns(), sheet.getLastColumn() + 1),
  );
  const values = sheet.getRange(0, 0, rowCount, columnCount).getValues();
  const layout = findPaymentColumns(values);
  if (!layout) {
    return {
      ...EMPTY,
      problem: `The "${sheetName}" sheet needs a header row with Reference, Recipient and Amount.`,
    };
  }

  return draftsFromRows(
    paymentRowsFromMatrix(values, layout),
    sheetTreasury(values, treasury),
  );
}

/**
 * Resolves the treasury a sheet's payments belong to.
 *
 * A document treasury wins once it has an account. Before that, the sheet's
 * Treasury cell is used, because the sheet's draft-id formulas reference it.
 * Returning `null` for an unresolved account keeps the panel from inventing an
 * identity the formulas would disagree with.
 */
function sheetTreasury(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  fallback: TreasuryMetadata,
): TreasuryMetadata {
  if (fallback.accountId) {
    return fallback;
  }
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_ROWS); index += 1) {
    const row = rows[index] ?? [];
    for (const header of TREASURY_HEADERS) {
      const column = findColumn(row, [header]);
      if (column < 0) {
        continue;
      }
      const value = row[column + 1];
      const accountId = typeof value === "string" ? value.trim() : "";
      if (accountId.length > 0) {
        return { network: fallback.network, accountId };
      }
    }
  }
  return fallback;
}