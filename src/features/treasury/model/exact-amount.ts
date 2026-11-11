import Decimal from "decimal.js";

/**
 * Exact token amounts.
 *
 * A spreadsheet cell is a double, so a value like `0.1 + 0.2` carries binary
 * representation noise. Converting that to base units silently would change the
 * payment, and rejecting every computed value would make the formula unusable.
 * The policy is therefore explicit:
 *
 * - Values whose excess digits are indistinguishable from double noise at the
 *   token's precision are accepted.
 * - Values with meaningful excess precision (for example `12.505` for a token
 *   with 2 decimals) are rejected unless the caller asks for rounding.
 *
 * Base units are built from the decimal string, never from floating point
 * arithmetic, so the integer amount is exact.
 */

/** Largest token precision this application will encode. */
export const MAX_TOKEN_DECIMALS = 24;

/** Native NEAR uses yoctoNEAR. */
export const NEAR_DECIMALS = 24;

/**
 * A tight tolerance applies only to numeric spreadsheet results. Exact strings
 * never use noise tolerance. Any accepted numeric adjustment reports rounded.
 */
const FLOAT_NOISE_FACTOR = new Decimal(String(Number.EPSILON * 2));

/** Refuse absurd magnitudes instead of producing unbounded integer strings. */
const MAX_ABSOLUTE = new Decimal("1e30");

export interface ExactAmount {
  /** Canonical decimal string without exponent or trailing zeros. */
  display: string;
  /** Integer string in the token's smallest unit. */
  baseUnits: string;
  decimals: number;
}

export type AmountProblem =
  | "empty"
  | "not-numeric"
  | "not-finite"
  | "negative"
  | "too-large"
  | "over-precision"
  | "unsupported-decimals";

export type AmountResult =
  | { ok: true; amount: ExactAmount; rounded: boolean }
  | { ok: false; problem: AmountProblem; message: string };

export interface ParseAmountOptions {
  /**
   * `"reject"` (default) refuses meaningful excess precision.
   * `"round"` rounds explicitly to the token precision.
   */
  mode?: "reject" | "round";
}

const fail = (
  problem: AmountProblem,
  message: string,
): AmountResult => ({ ok: false, problem, message });

function toCanonical(display: string): string {
  if (!display.includes(".")) {
    return display;
  }
  const trimmed = display.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed.length === 0 || trimmed === "-" ? "0" : trimmed;
}

function toBaseUnits(display: string, decimals: number): string {
  const [whole, fraction = ""] = display.split(".");
  const padded = fraction.padEnd(decimals, "0");
  const digits = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  return BigInt(digits.length === 0 ? "0" : digits).toString();
}

/**
 * Parses a cell value or user string into an exact amount at `decimals`
 * precision.
 */
export function parseExactAmount(
  raw: unknown,
  decimals: number,
  options: ParseAmountOptions = {},
): AmountResult {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) {
    return fail(
      "unsupported-decimals",
      `Token decimals must be a whole number from 0 to ${MAX_TOKEN_DECIMALS}.`,
    );
  }

  if (raw === null || raw === undefined) {
    return fail("empty", "Amount is empty.");
  }
  if (typeof raw === "boolean") {
    return fail("not-numeric", "Amount must be a number.");
  }
  if (typeof raw !== "number" && typeof raw !== "string") {
    return fail("not-numeric", "Amount must be a number.");
  }

  const text = typeof raw === "number" ? String(raw) : raw.trim();
  if (text.length === 0) {
    return fail("empty", "Amount is empty.");
  }
  if (typeof raw === "number" && !Number.isFinite(raw)) {
    return fail("not-finite", "Amount must be a finite number.");
  }

  let value: Decimal;
  try {
    value = new Decimal(text);
  } catch {
    return fail(
      "not-numeric",
      `"${text}" is not a number. Enter an amount such as 12.5.`,
    );
  }

  if (!value.isFinite()) {
    return fail("not-finite", "Amount must be a finite number.");
  }
  if (value.isNegative()) {
    return fail("negative", "Amount cannot be negative.");
  }
  if (value.abs().greaterThan(MAX_ABSOLUTE)) {
    return fail("too-large", "Amount is too large to be a valid token quantity.");
  }

  const places = value.decimalPlaces();
  let rounded = false;
  let exact = value;

  if (places > decimals) {
    const candidate = value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    if (options.mode === "round") {
      exact = candidate;
      rounded = true;
    } else {
      const noise = Decimal.max(1, value.abs()).times(FLOAT_NOISE_FACTOR);
      if (typeof raw === "number" && !candidate.isZero() && value.minus(candidate).abs().lessThanOrEqualTo(noise)) {
        // Binary floating-point noise, not a meaningful extra digit.
        exact = candidate;
        rounded = true;
      } else {
        return fail(
          "over-precision",
          `Amount has more than ${decimals} decimal place${decimals === 1 ? "" : "s"}. Round it explicitly before preparing an action.`,
        );
      }
    }
  }

  const display = toCanonical(exact.toFixed());
  return {
    ok: true,
    amount: { display, baseUnits: toBaseUnits(display, decimals), decimals },
    rounded,
  };
}

/** Exact amount from already-validated integer base units. */
export function amountFromBaseUnits(
  baseUnits: string,
  decimals: number,
): ExactAmount | null {
  if (!/^\d+$/.test(baseUnits) || !Number.isInteger(decimals) || decimals < 0) {
    return null;
  }
  const padded = baseUnits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals) || "0";
  const fraction = decimals === 0 ? "" : padded.slice(padded.length - decimals);
  const display = toCanonical(
    fraction.length > 0 ? `${whole}.${fraction}` : whole,
  );
  return { display, baseUnits: BigInt(baseUnits).toString(), decimals };
}