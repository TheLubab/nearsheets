import { describe, expect, it } from "vitest";
import type { WorkbookSession } from "../src/features/spreadsheet/univer/create-workbook-session";
import {
  collectDraftsFromSession,
  draftsFromRows,
  findPaymentColumns,
  paymentRowsFromMatrix,
} from "../src/features/treasury/application/collect-drafts";
import { calculateCustomFunction } from "../src/features/treasury/formulas/custom-functions";

const treasury = { network: "testnet" as const, accountId: "dao.testnet" };

const header = ["Reference", "Recipient", "Amount", "Asset", "Decimals", "Purpose"];

function matrix(rows: unknown[][]): unknown[][] {
  return [header, ...rows];
}

describe("payment row extraction", () => {
  it("finds the header row when a title sits above it", () => {
    const rows = [["Payments"], [], header, ["INV-1", "sara.near", 10]];
    const layout = findPaymentColumns(rows);
    expect(layout?.headerRowIndex).toBe(2);
    expect(layout?.columns.reference).toBe(0);
    expect(layout?.columns.recipient).toBe(1);
    expect(layout?.columns.amount).toBe(2);
  });

  it("maps columns by header text, so reordering is safe", () => {
    const reordered = ["Amount", "Reference", "Purpose", "Recipient", "Asset"];
    const layout = findPaymentColumns([reordered]);
    expect(layout?.columns.amount).toBe(0);
    expect(layout?.columns.reference).toBe(1);
    expect(layout?.columns.recipient).toBe(3);
  });

  it("returns null when the required headers are absent", () => {
    expect(findPaymentColumns([["Name", "Address"], ["a", "b"]])).toBeNull();
  });

  it("skips fully blank rows but keeps incomplete ones", () => {
    const rows = [
      header,
      ["INV-1", "sara.near", 10, "near", null, "Design"],
      [null, null, null, null, null, null],
      ["INV-2", null, null, null, null, null],
    ];
    const layout = findPaymentColumns(rows)!;
    const extracted = paymentRowsFromMatrix(rows, layout);
    expect(extracted).toHaveLength(2);
    expect(extracted[1]?.rowNumber).toBe(4);
  });
});

describe("draft collection", () => {
  it("produces one draft per valid row", () => {
    const rows = [
      {
        rowNumber: 2,
        reference: "INV-1",
        recipient: "sara.near",
        amount: 10,
        assetId: "near",
        decimals: null,
        memo: "Design",
      },
      {
        rowNumber: 3,
        reference: "INV-2",
        recipient: "omar.near",
        amount: 5,
        assetId: "near",
        decimals: null,
        memo: "Dev",
      },
    ];
    const collected = draftsFromRows(rows, treasury);
    expect(collected.drafts).toHaveLength(2);
    expect(collected.issues).toEqual([]);
  });

  it("treats a blank Asset cell as native NEAR", () => {
    const collected = draftsFromRows(
      [
        {
          rowNumber: 2,
          reference: "INV-1",
          recipient: "sara.near",
          amount: 10,
          assetId: null,
          decimals: null,
          memo: "",
        },
      ],
      treasury,
    );
    expect(collected.issues).toEqual([]);
    expect(collected.drafts[0]?.asset.assetId).toBe("near");
    expect(collected.drafts[0]?.kind).toBe("near-transfer");
  });

  it("reports a duplicate reference instead of merging identities", () => {
    const duplicate = {
      rowNumber: 2,
      reference: "INV-1",
      recipient: "sara.near",
      amount: 10,
      assetId: "near",
      decimals: null,
      memo: "",
    };
    const collected = draftsFromRows(
      [duplicate, { ...duplicate, rowNumber: 3, amount: 20 }],
      treasury,
    );
    expect(collected.drafts).toHaveLength(1);
    expect(collected.issues[0]?.message).toMatch(/repeats row 2/);
  });

  it("reports an invalid row without dropping the valid ones", () => {
    const collected = draftsFromRows(
      [
        {
          rowNumber: 2,
          reference: "INV-1",
          recipient: "sara.near",
          amount: 10,
          assetId: "near",
          decimals: null,
          memo: "",
        },
        {
          rowNumber: 3,
          reference: "INV-2",
          recipient: "not an account",
          amount: 5,
          assetId: "near",
          decimals: null,
          memo: "",
        },
      ],
      treasury,
    );
    expect(collected.drafts).toHaveLength(1);
    expect(collected.issues).toHaveLength(1);
    expect(collected.issues[0]?.field).toBe("recipient");
  });
});

describe("collecting from a mounted session", () => {
  function sessionWith(values: unknown[][] | null, sheetName = "Payments") {
    const session = {
      getWorkbook: () =>
        values === null
          ? {
              getSheetByName: () => null,
            }
          : {
              getSheetByName: (name: string) =>
                name === sheetName
                  ? {
                      getMaxRows: () => Math.max(values.length, 100),
                      getMaxColumns: () => 10,
                      getLastRow: () => values.length - 1,
                      getLastColumn: () => (values[0]?.length ?? 1) - 1,
                      getRange: () => ({
                        getValues: () => values,
                      }),
                    }
                  : null,
            },
    } as unknown as WorkbookSession;
    return session;
  }

  it("reads and validates the Payments sheet", () => {
    const session = sessionWith(
      matrix([
        ["INV-1", "sara.near", 10, "near", null, "Design"],
        ["INV-2", "omar.near", 5, "near", null, "Dev"],
      ]),
    );
    const collected = collectDraftsFromSession(session, treasury);
    expect(collected.problem).toBeNull();
    expect(collected.drafts).toHaveLength(2);
    expect(collected.drafts[0]?.amount.baseUnits).toBe("10000000000000000000000000");
  });

  it("uses the sheet's Treasury cell until a document treasury is selected", () => {
    const session = sessionWith([
      ["Treasury", "dao.sputnikv2.testnet"],
      [],
      header,
      ["INV-1", "sara.near", 10, "near", null, "Design"],
    ]);
    const document = { network: "testnet" as const, accountId: null };
    const collected = collectDraftsFromSession(session, document);
    expect(collected.drafts[0]?.treasury.accountId).toBe("dao.sputnikv2.testnet");

    // The formula on the sheet references the same Treasury cell, so the ids
    // the panel reports and the ids the sheet shows agree.
    expect(
      calculateCustomFunction(
        "TREZU_DRAFT",
        "near-transfer",
        "testnet",
        "dao.sputnikv2.testnet",
        "INV-1",
      ),
    ).toBe(collected.drafts[0]?.id);
  });

  it("prefers a selected document treasury over the sheet cell", () => {
    const session = sessionWith([
      ["Treasury", "sheet.testnet"],
      [],
      header,
      ["INV-1", "sara.near", 10, "near", null, "Design"],
    ]);
    const document = { network: "mainnet" as const, accountId: "doc.near" };
    const collected = collectDraftsFromSession(session, document);
    expect(collected.drafts[0]?.treasury).toEqual({
      network: "mainnet",
      accountId: "doc.near",
    });
  });

  it("explains a missing sheet instead of reporting zero payments", () => {
    const collected = collectDraftsFromSession(sessionWith(null), treasury);
    expect(collected.drafts).toEqual([]);
    expect(collected.problem).toMatch(/Add a sheet named "Payments"/);
  });

  it("explains missing headers", () => {
    const session = sessionWith([["Name", "Value"], ["a", 1]]);
    const collected = collectDraftsFromSession(session, treasury);
    expect(collected.problem).toMatch(/needs a header row/);
  });

  it("reports an unready editor", () => {
    const collected = collectDraftsFromSession(null, treasury);
    expect(collected.problem).toMatch(/not ready/);
  });
});