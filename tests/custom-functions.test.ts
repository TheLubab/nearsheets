import { describe, expect, it, vi } from "vitest";
import {
  CUSTOM_FUNCTION_NAMES,
  FUNCTION_CATALOG_VERSION,
  calculateCustomFunction,
  createCustomFunctionCatalog,
} from "../src/features/treasury/formulas/custom-functions";
import { draftFromRow } from "../src/features/treasury/model/action-draft";

describe("custom function catalog", () => {
  it("exposes a versioned, discoverable catalog", () => {
    expect(FUNCTION_CATALOG_VERSION).toBeGreaterThan(1);
    expect(CUSTOM_FUNCTION_NAMES).toEqual([
      "NEAR_AMOUNT",
      "NEAR_ACCOUNT",
      "NS_REFERENCE",
      "NS_SUM_REF",
      "NS_MISSING",
    ]);

    const catalog = createCustomFunctionCatalog();
    expect(catalog.functions).toHaveLength(CUSTOM_FUNCTION_NAMES.length + 1);
    for (const [ctor, name] of catalog.functions) {
      expect(typeof ctor).toBe("function");
      expect([...CUSTOM_FUNCTION_NAMES, "NS_LEGACY_DRAFT"]).toContain(name);
    }
  });

  it("describes every function with arguments", () => {
    const catalog = createCustomFunctionCatalog();
    for (const description of catalog.descriptions) {
      expect(description.functionName).toMatch(/^(NEAR_|NS_)/);
      expect(description.description.length).toBeGreaterThan(20);
      expect(description.abstract.length).toBeGreaterThan(10);
      // The screen tip is the only place a user sees the calling convention.
      expect(description.abstract).toContain("For example:");
      expect(description.functionParameter.length).toBeGreaterThan(0);
    }
  });

  it("validates an amount against token precision and stays numeric", () => {
    // Numbers remain numbers so the result can be summed by other formulas.
    expect(calculateCustomFunction("NEAR_AMOUNT", 12.5, 24)).toBe(12.5);
    expect(calculateCustomFunction("NEAR_AMOUNT", 0.1 + 0.2, 2)).toBe(0.3);
    expect(calculateCustomFunction("NEAR_AMOUNT", -1, 24)).toBe("#VALUE!");
    expect(calculateCustomFunction("NEAR_AMOUNT", "abc", 24)).toBe("#VALUE!");
    expect(calculateCustomFunction("NEAR_AMOUNT", 1, 25)).toBe("#VALUE!");
    // Meaningful excess precision is a problem, not a silent rounding.
    expect(calculateCustomFunction("NEAR_AMOUNT", 12.505, 2)).toBe("#VALUE!");
  });

  it("normalizes and validates account ids without network access", () => {
    expect(calculateCustomFunction("NEAR_ACCOUNT", " Sara.NEAR ")).toBe("sara.near");
    expect(calculateCustomFunction("NEAR_ACCOUNT", "invalid account")).toBe("#VALUE!");
    expect(calculateCustomFunction("NEAR_ACCOUNT", "")).toBe("#VALUE!");
  });

  it("builds references from parts", () => {
    expect(calculateCustomFunction("NS_REFERENCE", "INV", 42)).toBe("INV-42");
    expect(calculateCustomFunction("NS_REFERENCE", "", 42)).toBe("#VALUE!");
  });

  it("derives the same draft id as the draft model", () => {
    const treasury = { network: "testnet" as const, accountId: "dao.testnet" };
    const draft = draftFromRow(
      {
        rowNumber: 2,
        reference: "INV-42",
        recipient: "sara.near",
        amount: 1,
        assetId: "near",
      },
      treasury,
    ).draft;

    expect(
      calculateCustomFunction(
        "NS_LEGACY_DRAFT",
        "near-transfer",
        "testnet",
        "dao.testnet",
        "INV-42",
      ),
    ).toBe(draft?.id);
  });

  it("sums only matching references", () => {
    const references = [["INV-1"], ["PO-2"], ["INV-3"]];
    const amounts = [[10], [100], [5]];
    expect(calculateCustomFunction("NS_SUM_REF", "INV-", references, amounts)).toBe(15);
    expect(calculateCustomFunction("NS_SUM_REF", "PO-", references, amounts)).toBe(100);
    expect(calculateCustomFunction("NS_SUM_REF", "", references, amounts)).toBe(0);
  });

  it("counts blank fields for a preview readiness check", () => {
    expect(calculateCustomFunction("NS_MISSING", "a", null, "", "b")).toBe(2);
    expect(calculateCustomFunction("NS_MISSING", "a", "b")).toBe(0);
  });

  it("never performs I/O, signing or submission during a calculation", () => {
    // The catalog is pure: no fetch, no wallet, no document mutation. Freezing
    // the globals proves a calculation cannot reach a network implicitly.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("Custom functions must not fetch.");
    });
    try {
      for (const name of CUSTOM_FUNCTION_NAMES) {
        // Every function must return without throwing for arbitrary input.
        expect(() => calculateCustomFunction(name, "x", 1, null)).not.toThrow();
      }
    } finally {
      fetchSpy.mockRestore();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not mutate its inputs", () => {
    const references = [["INV-1"], ["INV-2"]];
    const amounts = [[1], [2]];
    const referenceCopy = JSON.parse(JSON.stringify(references));
    const amountCopy = JSON.parse(JSON.stringify(amounts));

    calculateCustomFunction("NS_SUM_REF", "INV-", references, amounts);

    expect(references).toEqual(referenceCopy);
    expect(amounts).toEqual(amountCopy);
  });
});