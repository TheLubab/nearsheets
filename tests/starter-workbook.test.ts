import { describe, expect, it } from "vitest";
import {
  createStarterWorkbook,
  STARTER_SHEET_IDS,
} from "../src/features/spreadsheet/model/starter-workbook";

const workbook = createStarterWorkbook();
const sheets = workbook.sheets ?? {};
const budget = sheets[STARTER_SHEET_IDS.budget];
const summary = sheets[STARTER_SHEET_IDS.summary];
const payments = sheets[STARTER_SHEET_IDS.payments];

describe("starter workbook", () => {
  it("opens with multiple sheets in a defined order", () => {
    expect(workbook.sheetOrder).toEqual([
      STARTER_SHEET_IDS.budget,
      STARTER_SHEET_IDS.summary,
      STARTER_SHEET_IDS.payments,
    ]);
    expect(Object.keys(sheets)).toHaveLength(3);
    expect(budget?.name).toBe("Budget");
    expect(summary?.name).toBe("Summary");
    expect(payments?.name).toBe("Payments");
  });

  it("includes a payments sheet with the columns draft extraction needs", () => {
    const header = payments?.cellData?.[3] ?? {};
    const headers = Object.values(header).map((cell) => cell?.v);
    expect(headers).toContain("Reference");
    expect(headers).toContain("Recipient");
    expect(headers).toContain("Amount");
  });

  it("uses formulas for draft ids instead of hard-coded values", () => {
    const draftCell = payments?.cellData?.[4]?.[6];
    const missingCell = payments?.cellData?.[4]?.[7];

    expect(draftCell?.f).toContain("TREZU_DRAFT");
    expect(draftCell?.v).toBeUndefined();
    expect(missingCell?.f).toContain("TREZU_MISSING");
  });

  it("keeps formulas as formula text rather than precomputed values", () => {
    const totalCell = budget?.cellData?.[7]?.[2];
    const summaryCell = summary?.cellData?.[3]?.[0];

    expect(totalCell?.f).toBe("=SUM(C4:C6)");
    expect(totalCell?.v).toBeUndefined();
    expect(summaryCell?.f).toBe("=Budget!C8");
  });

  it("carries formatting and layout that a plain table would lose", () => {
    const headerCell = budget?.cellData?.[2]?.[0];
    const amountCell = budget?.cellData?.[3]?.[2];

    expect(headerCell?.s).toBe("header");
    expect(amountCell?.s).toBe("currency");
    expect(workbook.styles?.currency?.n?.pattern).toBe("#,##0.00");
    expect(budget?.mergeData).toEqual([
      { startRow: 0, startColumn: 0, endRow: 0, endColumn: 4 },
    ]);
  });

  it("keeps every style reference resolvable", () => {
    const styleIds = new Set(Object.keys(workbook.styles ?? {}));
    for (const sheet of Object.values(sheets)) {
      for (const row of Object.values(sheet.cellData ?? {})) {
        for (const cell of Object.values(row ?? {}) as Array<{ s?: string | object }>) {
          if (typeof cell?.s === "string") {
            expect(styleIds.has(cell.s)).toBe(true);
          }
        }
      }
    }
  });
});