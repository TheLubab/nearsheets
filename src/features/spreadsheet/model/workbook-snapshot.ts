import type { IWorkbookData } from "@univerjs/core";

/**
 * The minimum a workbook must have to be opened by the editor and stored in a
 * document envelope.
 *
 * Univer's own snapshot type marks every field as required, but snapshots are
 * legitimately partial when a document is first created. Requiring only the
 * structural fields keeps `createStarterWorkbook()` and `saveSnapshot()`
 * (which returns the full type) compatible.
 */
export type WorkbookSnapshot = Partial<IWorkbookData> & {
  id: string;
  name: string;
  sheets: NonNullable<IWorkbookData["sheets"]>;
  sheetOrder: string[];
};

/** Structural check that does not depend on Univer runtime classes. */
export function isWorkbookSnapshot(value: unknown): value is WorkbookSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<IWorkbookData>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    return false;
  }
  if (typeof candidate.name !== "string") {
    return false;
  }
  if (typeof candidate.sheets !== "object" || candidate.sheets === null) {
    return false;
  }
  if (!Array.isArray(candidate.sheetOrder) || candidate.sheetOrder.length === 0) {
    return false;
  }
  const sheetIds = new Set(Object.keys(candidate.sheets));
  return candidate.sheetOrder.every(
    (sheetId) => typeof sheetId === "string" && sheetIds.has(sheetId),
  );
}