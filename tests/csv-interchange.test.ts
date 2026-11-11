import { describe, expect, it } from "vitest";
import {
  CsvImportError,
  EmptyCsvExportError,
  convertCsvField,
  csvFromSnapshot,
  parseCsv,
  serializeCsv,
  sheetNameFromFileName,
  workbookSnapshotFromCsv,
} from "../src/features/documents/interchange/csv";
import type { WorkbookSnapshot } from "../src/features/spreadsheet/model/workbook-snapshot";

describe("CSV parsing", () => {
  it("handles quoted fields, escaped quotes, embedded newlines and CRLF", () => {
    const csv = 'name,note\r\n"Sara","Lines, and ""quotes"""\r\n"Omar","two\r\nlines"\r\n';
    expect(parseCsv(csv)).toEqual([
      ["name", "note"],
      ["Sara", 'Lines, and "quotes"'],
      ["Omar", "two\r\nlines"],
    ]);
  });

  it("accepts LF row endings and a byte-order mark", () => {
    expect(parseCsv("\ufeffa,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps intended empty fields instead of dropping them", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('a,"unclosed\n')).toThrow(CsvImportError);
  });
});

describe("CSV serializing", () => {
  it("quotes only fields that need it and uses CRLF", () => {
    expect(serializeCsv([["plain", "with,comma"], ['with"quote', "line\nbreak"]])).toBe(
      'plain,"with,comma"\r\n"with""quote","line\nbreak"',
    );
  });

  it("renders booleans and blanks predictably", () => {
    expect(serializeCsv([[true, false, null, 12.5]])).toBe("TRUE,FALSE,,12.5");
  });
});

describe("CSV field conversion", () => {
  it("keeps numbers numeric and common text as text", () => {
    expect(convertCsvField("12.5")).toEqual({ v: 12.5 });
    expect(convertCsvField("-3e2")).toEqual({ v: -300 });
    expect(convertCsvField("sara.near")).toEqual({ v: "sara.near" });
  });

  it("never turns imported text into a formula", () => {
    const converted = convertCsvField("=SUM(A1:A3)");
    expect(converted?.v).toBe("=SUM(A1:A3)");
    // t = 4 (FORCE_STRING) prevents Univer from parsing it as a formula.
    expect(converted?.t).toBe(4);
    expect(converted?.f).toBeUndefined();
  });

  it("preserves identifiers that would be damaged by numeric coercion", () => {
    // Leading zeros and unsafe integers must not be silently changed.
    expect(convertCsvField("007")).toEqual({ v: "007", t: 4 });
    expect(convertCsvField("12345678901234567890")).toEqual({
      v: "12345678901234567890",
      t: 4,
    });
  });
});

describe("CSV workbook interchange", () => {
  it("builds a single-sheet, values-only workbook", () => {
    const snapshot = workbookSnapshotFromCsv("Contributor,Amount\nSara,30\n", {
      sheetName: "Imported",
      sheetId: "sheet-imported",
    });

    expect(snapshot.sheetOrder).toEqual(["sheet-imported"]);
    expect(snapshot.sheets["sheet-imported"]?.name).toBe("Imported");
    const cells = snapshot.sheets["sheet-imported"]?.cellData;
    expect(cells?.[0]?.[0]).toEqual({ v: "Contributor" });
    expect(cells?.[1]?.[1]).toEqual({ v: 30 });
    // No styles, merges or formulas are invented.
    expect(cells?.[1]?.[1]?.f).toBeUndefined();
    expect(snapshot.sheets["sheet-imported"]?.mergeData).toBeUndefined();
  });

  it("rejects a CSV with no values", () => {
    expect(() => workbookSnapshotFromCsv(",\n,\n")).toThrow(CsvImportError);
  });

  it("exports the value of formula cells, not the formula text", () => {
    const snapshot: WorkbookSnapshot = {
      id: "wb",
      name: "Budget",
      sheetOrder: ["s1"],
      sheets: {
        s1: {
          id: "s1",
          name: "Budget",
          cellData: {
            0: { 0: { v: "Total" }, 1: { v: 95 } },
            1: { 0: { v: "Calculated" }, 1: { f: "=SUM(B1)", v: 95 } },
          },
        },
      },
    };

    expect(csvFromSnapshot(snapshot)).toBe("Total,95\r\nCalculated,95");
  });

  it("reports an empty sheet instead of writing a blank file", () => {
    const snapshot: WorkbookSnapshot = {
      id: "wb",
      name: "Empty",
      sheetOrder: ["s1"],
      sheets: { s1: { id: "s1", name: "Sheet1", cellData: {} } },
    };
    expect(() => csvFromSnapshot(snapshot)).toThrow(EmptyCsvExportError);
  });

  it("derives a readable sheet name from a file name", () => {
    expect(sheetNameFromFileName("Community Budget (2026).csv")).toBe(
      "Community Budget (2026)",
    );
    expect(sheetNameFromFileName(".csv")).toBe("Sheet1");
  });
});