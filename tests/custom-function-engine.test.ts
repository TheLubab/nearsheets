import { describe, expect, it } from "vitest";
import {
  ArrayValueObject,
  NumberValueObject,
  StringValueObject,
} from "@univerjs/engine-formula";
import { createCustomFunctionCatalog } from "../src/features/treasury/formulas/custom-functions";

/**
 * Exercises the classes handed to Univer's preset, not just the pure catalog
 * functions. This is the path the formula engine actually uses: value objects
 * in, a value object out.
 */
function functionClass(name: string) {
  const catalog = createCustomFunctionCatalog();
  const found = catalog.functions.find(([, registered]) => registered === name);
  if (!found) {
    throw new Error(`Missing custom function ${name}`);
  }
  // The engine constructs with the registered name.
  return new (found[0] as new (name: string) => {
    calculate: (...args: unknown[]) => {
      isError?: () => boolean;
      getValue?: () => unknown;
    };
  })(name);
}

describe("custom functions through the engine boundary", () => {
  it("returns a number value object for a numeric result", () => {
    const result = functionClass("TREZU_SUM_REF").calculate(
      StringValueObject.create("INV-"),
      ArrayValueObject.createByArray([["INV-1"], ["X"], ["INV-2"]]),
      ArrayValueObject.createByArray([[10], [100], [5]]),
    );
    expect(result.getValue?.()).toBe(15);
  });

  it("returns a string value object for text", () => {
    const result = functionClass("TREZU_REFERENCE").calculate(
      StringValueObject.create("INV"),
      NumberValueObject.create(42),
    );
    expect(result.getValue?.()).toBe("INV-42");
  });

  it("returns an error object for unusable input, so dependants see an error", () => {
    const result = functionClass("TREZU_ACCOUNT").calculate(
      StringValueObject.create("not an account"),
    );
    expect(result.isError?.()).toBe(true);
    expect(result.getValue?.()).toBe("#VALUE!");
  });

  it("propagates an error argument instead of reading its text", () => {
    const error = functionClass("TREZU_ACCOUNT").calculate(
      StringValueObject.create("bad value"),
    );
    expect(error.isError?.()).toBe(true);

    const propagated = functionClass("TREZU_REFERENCE").calculate(
      error,
      NumberValueObject.create(1),
    );
    expect(propagated.isError?.()).toBe(true);
    expect(propagated.getValue?.()).toBe("#VALUE!");
  });

  it("accepts a 1x1 range like a single cell", () => {
    const result = functionClass("TREZU_MISSING").calculate(
      ArrayValueObject.createByArray([[""]]),
      ArrayValueObject.createByArray([["present"]]),
    );
    expect(result.getValue?.()).toBe(1);
  });

  it("declares arity so a wrong argument count is an error, not a guess", () => {
    const sumRef = functionClass("TREZU_SUM_REF") as unknown as {
      minParams: number;
      maxParams: number;
    };
    expect(sumRef.minParams).toBe(3);
    expect(sumRef.maxParams).toBe(3);

    const missing = functionClass("TREZU_MISSING") as unknown as {
      minParams: number;
      maxParams: number;
    };
    expect(missing.minParams).toBe(1);
    expect(missing.maxParams).toBe(255);

    const account = functionClass("TREZU_ACCOUNT") as unknown as {
      minParams: number;
      maxParams: number;
    };
    expect(account.minParams).toBe(1);
    expect(account.maxParams).toBe(1);
  });
});