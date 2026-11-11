import { describe, expect, it } from "vitest";
import {
  amountFromBaseUnits,
  NEAR_DECIMALS,
  parseExactAmount,
} from "../src/features/treasury/model/exact-amount";

describe("exact amounts", () => {
  it("encodes a decimal string as exact base units", () => {
    const result = parseExactAmount("12.5", NEAR_DECIMALS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // 12.5 NEAR in yoctoNEAR, built from the string, not floating point.
    expect(result.amount.baseUnits).toBe("12500000000000000000000000");
    expect(result.amount.display).toBe("12.5");
  });

  it("treats double noise as noise, not as extra precision", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point.
    const result = parseExactAmount(0.1 + 0.2, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.amount.display).toBe("0.3");
    expect(result.amount.baseUnits).toBe("30");
    expect(result.rounded).toBe(false);
  });

  it("rejects meaningful extra precision instead of rounding silently", () => {
    const result = parseExactAmount("12.505", 2);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.problem).toBe("over-precision");
    expect(result.message).toMatch(/more than 2 decimal places/);
  });

  it("rounds only when explicitly asked", () => {
    const result = parseExactAmount("12.505", 2, { mode: "round" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.amount.display).toBe("12.51");
    expect(result.rounded).toBe(true);
  });

  it("refuses negative, empty and non-numeric amounts", () => {
    expect(parseExactAmount(-1, 2).ok).toBe(false);
    expect(parseExactAmount("", 2).ok).toBe(false);
    expect(parseExactAmount("abc", 2).ok).toBe(false);
    expect(parseExactAmount(Number.NaN, 2).ok).toBe(false);
  });

  it("handles zero decimals and very small values", () => {
    const whole = parseExactAmount("42", 0);
    expect(whole.ok && whole.amount.baseUnits).toBe("42");

    const tiny = parseExactAmount("0.000000000000000000000001", NEAR_DECIMALS);
    expect(tiny.ok && tiny.amount.baseUnits).toBe("1");
  });

  it("rejects unsupported precision rather than guessing", () => {
    const result = parseExactAmount("1", 25);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.problem).toBe("unsupported-decimals");
  });

  it("round trips between display and base units", () => {
    const amount = amountFromBaseUnits("12500000000000000000000000", NEAR_DECIMALS);
    expect(amount?.display).toBe("12.5");

    const tiny = amountFromBaseUnits("1", NEAR_DECIMALS);
    expect(tiny?.display).toBe("0.000000000000000000000001");

    expect(amountFromBaseUnits("not-a-number", 24)).toBeNull();
  });
});