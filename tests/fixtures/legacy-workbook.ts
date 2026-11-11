import { LocaleType, type IWorkbookData, type IStyleData } from "@univerjs/core";

/**
 * A small, realistic starting workbook. It is ordinary spreadsheet content:
 * two sheets, number formats, a merged title and formulas that reference both
 * the current sheet and another one. Nothing here reads or writes a treasury.
 */
const styles: Record<string, IStyleData> = {
  title: {
    bl: 1,
    fs: 16,
  },
  header: {
    bl: 1,
    bg: { rgb: "#e8eef7" },
    cl: { rgb: "#1f2d3d" },
  },
  currency: {
    n: { pattern: "#,##0.00" },
  },
  total: {
    bl: 1,
    n: { pattern: "#,##0.00" },
  },
};

export const STARTER_SHEET_IDS = {
  budget: "sheet-budget",
  summary: "sheet-summary",
  payments: "sheet-payments",
} as const;

export function createStarterWorkbook(): Partial<IWorkbookData> {
  return {
    id: "trezu-sheets-starter",
    name: "Community budget",
    locale: LocaleType.EN_US,
    styles,
    sheetOrder: [
      STARTER_SHEET_IDS.budget,
      STARTER_SHEET_IDS.summary,
      STARTER_SHEET_IDS.payments,
    ],
    sheets: {
      [STARTER_SHEET_IDS.budget]: {
        id: STARTER_SHEET_IDS.budget,
        name: "Budget",
        rowCount: 100,
        columnCount: 8,
        defaultColumnWidth: 110,
        cellData: {
          0: {
            0: { v: "Community budget", s: "title" },
          },
          2: {
            0: { v: "Contributor", s: "header" },
            1: { v: "NEAR account", s: "header" },
            2: { v: "Amount (NEAR)", s: "header" },
            3: { v: "Purpose", s: "header" },
            4: { v: "Status", s: "header" },
          },
          3: {
            0: { v: "Sara" },
            1: { v: "sara.near" },
            2: { v: 30, s: "currency" },
            3: { v: "Design" },
            4: { v: "Draft" },
          },
          4: {
            0: { v: "Omar" },
            1: { v: "omar.near" },
            2: { v: 45, s: "currency" },
            3: { v: "Development" },
            4: { v: "Draft" },
          },
          5: {
            0: { v: "Lina" },
            1: { v: "lina.near" },
            2: { v: 20, s: "currency" },
            3: { v: "Event expenses" },
            4: { v: "Draft" },
          },
          7: {
            0: { v: "Total requested", s: "total" },
            2: { f: "=SUM(C4:C6)", s: "total" },
          },
        },
        columnData: {
          1: { w: 150 },
          3: { w: 160 },
        },
        mergeData: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 4 }],
      },
      [STARTER_SHEET_IDS.payments]: {
        id: STARTER_SHEET_IDS.payments,
        name: "Payments",
        rowCount: 200,
        columnCount: 8,
        defaultColumnWidth: 130,
        cellData: {
          0: {
            0: { v: "Payments", s: "title" },
          },
          1: {
            0: { v: "Treasury", s: "header" },
            1: { v: "your-treasury.testnet" },
            3: { v: "Network", s: "header" },
            4: { v: "testnet" },
          },
          2: {
            0: {
              v: "Replace the Treasury and Network cells with your own. References are identities, not row numbers; Draft IDs are computed by formulas and never submit anything. A blank Asset means native NEAR; other assets need their Decimals.",
            },
          },
          3: {
            0: { v: "Reference", s: "header" },
            1: { v: "Recipient", s: "header" },
            2: { v: "Amount", s: "header" },
            3: { v: "Asset", s: "header" },
            4: { v: "Decimals", s: "header" },
            5: { v: "Purpose", s: "header" },
            6: { v: "Draft ID", s: "header" },
            7: { v: "Missing fields", s: "header" },
          },
          4: {
            0: { v: "INV-1" },
            1: { v: "sara.near" },
            2: { v: 30, s: "currency" },
            3: { v: "near" },
            5: { v: "Design" },
            6: {
              f: '=TREZU_DRAFT("near-transfer", $E$2, $B$2, A5)',
            },
            7: { f: "=TREZU_MISSING(A5, B5, C5)" },
          },
          5: {
            0: { v: "INV-2" },
            1: { v: "omar.near" },
            2: { v: 45, s: "currency" },
            3: { v: "near" },
            5: { v: "Development" },
            6: {
              f: '=TREZU_DRAFT("near-transfer", $E$2, $B$2, A6)',
            },
            7: { f: "=TREZU_MISSING(A6, B6, C6)" },
          },
          6: {
            0: { v: "INV-3" },
            1: { v: "lina.near" },
            2: { v: 20, s: "currency" },
            3: { v: "near" },
            5: { v: "Event expenses" },
            6: {
              f: '=TREZU_DRAFT("near-transfer", $E$2, $B$2, A7)',
            },
            7: { f: "=TREZU_MISSING(A7, B7, C7)" },
          },
        },
        columnData: {
          0: { w: 110 },
          1: { w: 160 },
          5: { w: 170 },
          6: { w: 190 },
          7: { w: 120 },
        },
        mergeData: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 7 }],
      },
      [STARTER_SHEET_IDS.summary]: {
        id: STARTER_SHEET_IDS.summary,
        name: "Summary",
        rowCount: 100,
        columnCount: 6,
        defaultColumnWidth: 150,
        cellData: {
          0: {
            0: { v: "Summary", s: "title" },
          },
          2: {
            0: { v: "Total requested", s: "header" },
            1: { v: "Contributor rows", s: "header" },
          },
          3: {
            0: { f: "=Budget!C8", s: "currency" },
            1: { f: "=COUNTA(Budget!A4:A6)" },
          },
          5: {
            0: {
              v: "Amounts are illustrative. Editing a cell never submits a treasury proposal.",
            },
          },
        },
      },
    },
  };
}