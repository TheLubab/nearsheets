import { BooleanNumber } from "@univerjs/core";
import type { IFunctionInfo, IFunctionParam } from "@univerjs/engine-formula";
import { parseExactAmount } from "../model/exact-amount";
import {
  BaseFunction,
  ErrorType,
  ErrorValueObject,
  ERROR_TYPE_SET,
  FunctionType,
  NumberValueObject,
  StringValueObject,
} from "@univerjs/engine-formula";

/**
 * The Trezu Sheets custom-function catalog.
 *
 * Every function here is a pure calculation over its arguments. None of them
 * reads a network, signs, submits or mutates a document, so recalculation,
 * paste, undo and opening an imported workbook stay side-effect free.
 *
 * Functions that describe an intended action return text (an action draft id or
 * a validation marker) rather than performing it. Preparing a proposal is a
 * separate, explicit step.
 */

/** Bump when a function is added, renamed or changes meaning. */
export { FUNCTION_CATALOG_VERSION } from "../model/function-catalog-version";

/** Locale namespace used for function help text. */
export const FUNCTION_LOCALE_NAMESPACE = "trezuFunction";

type Primitive = string | number | boolean | null;

interface CatalogEntry {
  name: string;
  summary: string;
  description: string;
  parameters: IFunctionParam[];
  example: string;
  /** Pure calculation. Returns a primitive or an Excel-style error string. */
  calculate: (...args: unknown[]) => Primitive;
}

/**
 * Argument bounds derived from the declared parameters, so the engine rejects
 * a wrong-arity call with #N/A instead of a silently different calculation.
 */
function arity(parameters: IFunctionParam[]): { minParams: number; maxParams: number } {
  if (parameters.some((parameter) => parameter.repeat === BooleanNumber.TRUE)) {
    const minParams = parameters.filter(
      (parameter) => parameter.require === BooleanNumber.TRUE,
    ).length;
    return { minParams, maxParams: 255 };
  }
  return { minParams: parameters.length, maxParams: parameters.length };
}

const required = (name: string, detail: string): IFunctionParam => ({
  name,
  detail,
  example: "",
  require: BooleanNumber.TRUE,
  repeat: BooleanNumber.FALSE,
});

const repeated = (name: string, detail: string): IFunctionParam => ({
  name,
  detail,
  example: "",
  require: BooleanNumber.TRUE,
  repeat: BooleanNumber.TRUE,
});

/**
 * Reads one value object or primitive as a primitive.
 *
 * Univer passes `BaseValueObject` instances into `calculate`, while the pure
 * catalog functions are written against primitives so they can be tested
 * without the engine. Errors become their error text so a calculation can see
 * and propagate them.
 */
export function toPrimitive(value: unknown): Primitive {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value.length > 0 ? value[0] : null;
    return toPrimitive(first);
  }
  if (typeof value === "object") {
    const candidate = value as {
      isError?: () => boolean;
      isArray?: () => boolean;
      toValue?: () => Primitive[][];
      getValue?: () => unknown;
    };
    if (typeof candidate.isArray === "function" && candidate.isArray()) {
      const matrix = typeof candidate.toValue === "function" ? candidate.toValue() : [];
      const firstRow = matrix[0] ?? [];
      return firstRow.length > 0 ? (firstRow[0] ?? null) : null;
    }
    if (typeof candidate.getValue === "function") {
      try {
        return toPrimitive(candidate.getValue());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Flattens a scalar, range or value object into primitives row by row. */
export function flattenValues(value: unknown): Primitive[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenValues);
  }
  if (value !== null && typeof value === "object") {
    const candidate = value as {
      isArray?: () => boolean;
      toValue?: () => Primitive[][];
      getValue?: () => unknown;
    };
    if (typeof candidate.isArray === "function" && candidate.isArray()) {
      const matrix = typeof candidate.toValue === "function" ? candidate.toValue() : [];
      return matrix.flatMap((row) => row.map((cell) => toPrimitive(cell)));
    }
  }
  return [toPrimitive(value)];
}

/** Text form of a value, with blanks rendered as an empty string. */
export function valueText(value: unknown): string {
  const primitive = toPrimitive(value);
  if (primitive === null) {
    return "";
  }
  return String(primitive);
}

const catalog: CatalogEntry[] = [
  {
    name: "TREZU_AMOUNT",
    summary: "Validates an amount against a token's precision.",
    description:
      "Returns the amount rounded to the token's precision, or #VALUE! when it cannot be a valid non-negative quantity at that precision. Extra digits that only reflect floating-point noise are accepted; meaningful extra precision is an error rather than a silent rounding. Submission re-parses the cell value with exact big-integer semantics.",
    parameters: [
      required("value", "Computed amount."),
      required("decimals", "Token precision, for example 24 for NEAR."),
    ],
    example: "=TREZU_AMOUNT(C4, 24)",
    calculate: (value, decimals) => {
      const amount = toPrimitive(value);
      const precision = Number(toPrimitive(decimals));
      if (typeof amount === "boolean" || typeof amount !== "number") {
        return "#VALUE!";
      }
      if (!Number.isInteger(precision) || precision < 0) {
        return "#VALUE!";
      }
      // Reuse the exact-amount rules so the sheet and a later preview cannot
      // disagree about what counts as a valid amount.
      const parsed = parseExactAmount(amount, precision);
      if (!parsed.ok) {
        return "#VALUE!";
      }
      return Number(parsed.amount.display);
    },
  },
  {
    name: "TREZU_ACCOUNT",
    summary: "Checks that a cell looks like a NEAR account id.",
    description:
      "Returns the normalized account id, or #VALUE! when the text cannot be a NEAR account id. This is a syntactic check only: it does not prove the account exists or can receive funds.",
    parameters: [required("account", "Account id such as sara.near.")],
    example: '=TREZU_ACCOUNT("sara.near")',
    calculate: (account) => {
      const text = valueText(account).trim();
      if (text.length === 0) {
        return "#VALUE!";
      }
      // Deliberately local: formula registration must not depend on UI or
      // storage modules, and this check has no side effects.
      if (/^[0-9a-f]{64}$/.test(text)) {
        return text;
      }
      const lowered = text.toLowerCase();
      if (lowered.length < 2 || lowered.length > 64) {
        return "#VALUE!";
      }
      return /^[a-z\d]+(?:[._-][a-z\d]+)*$/.test(lowered) ? lowered : "#VALUE!";
    },
  },
  {
    name: "TREZU_REFERENCE",
    summary: "Builds a stable payment reference from a prefix and a number.",
    description:
      "Returns `prefix-number`, the value used as a payment row's stable identity. Use a reference instead of a row number so sorting or inserting rows never reassigns a payment to a different proposal.",
    parameters: [
      required("prefix", "Short project or invoice prefix."),
      required("number", "Sequence number."),
    ],
    example: '=TREZU_REFERENCE("INV", 42)',
    calculate: (prefix, number) => {
      const head = valueText(prefix).trim();
      const tail = Number(toPrimitive(number));
      if (head.length === 0 || !Number.isFinite(tail)) {
        return "#VALUE!";
      }
      return `${head}-${Math.trunc(tail)}`;
    },
  },
  {
    name: "TREZU_DRAFT",
    summary: "Derives the stable action draft id for a payment row.",
    description:
      "Returns the draft id derived from the action kind, network, treasury account and row reference. It never submits anything. Use it to confirm that a row has a stable identity; previewing and submitting are separate explicit actions.",
    parameters: [
      required("kind", "near-transfer or intents-delivery."),
      required("network", "mainnet or testnet."),
      required("treasury", "Treasury account id."),
      required("reference", "Stable row reference."),
    ],
    example:
      '=TREZU_DRAFT("near-transfer", "testnet", "dao.sputnikv2.testnet", "INV-42")',
    calculate: (kind, network, treasury, reference) => {
      const kindText = valueText(kind).trim();
      const networkText = valueText(network).trim();
      const treasuryText = valueText(treasury).trim();
      const referenceText = valueText(reference).trim();
      if (
        (kindText !== "near-transfer" && kindText !== "intents-delivery") ||
        (networkText !== "mainnet" && networkText !== "testnet") ||
        treasuryText.length === 0 ||
        referenceText.length === 0
      ) {
        return "#VALUE!";
      }
      return `draft_${fnv1a(
        `${kindText}|${networkText}|${treasuryText}|${referenceText}`,
      )}`;
    },
  },
  {
    name: "TREZU_SUM_REF",
    summary: "Sums rows that share a reference prefix.",
    description:
      "Adds the amounts whose reference starts with a prefix, so a payment can be checked across rows or sheets without depending on row positions. Non-numeric amounts contribute zero.",
    parameters: [
      required("referencePrefix", "Prefix to match, for example INV-."),
      required("referenceRange", "Reference column."),
      required("amountRange", "Amount column with the same shape."),
    ],
    example: '=TREZU_SUM_REF("INV-", A4:A20, C4:C20)',
    calculate: (...args) => {
      const prefix = valueText(args[0]).trim();
      if (prefix.length === 0) {
        return 0;
      }
      const references = flattenValues(args[1]);
      const amounts = flattenValues(args[2]);
      const length = Math.min(references.length, amounts.length);
      let total = 0;
      for (let index = 0; index < length; index += 1) {
        const reference = String(references[index] ?? "").trim();
        if (!reference.startsWith(prefix)) {
          continue;
        }
        const amount = Number(amounts[index]);
        if (Number.isFinite(amount)) {
          total += amount;
        }
      }
      return total;
    },
  },
  {
    name: "TREZU_MISSING",
    summary: "Counts blank fields in a payment row.",
    description:
      "Returns how many of the supplied fields are blank. Use it as a preview-readiness check before an explicit submission step; it never submits.",
    parameters: [repeated("field", "Values that must be present.")],
    example: "=TREZU_MISSING(B4, C4, D4)",
    calculate: (...fields) => {
      let missing = 0;
      for (const field of fields) {
        const cells = flattenValues(field);
        for (const cell of cells) {
          if (cell === null || String(cell).trim().length === 0) {
            missing += 1;
          }
        }
      }
      return missing;
    },
  },
];

/** 64-bit FNV-1a, rendered as 16 hex characters. Not a cryptographic hash. */
function fnv1a(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const char of input) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * Turns a catalog result into the value object Univer expects.
 *
 * A plain string or number cannot be returned from a `BaseFunction`
 * implementation: the engine calls `withDateSystem` on the result.
 */
function toValueObject(result: Primitive) {
  if (result === null) {
    return ErrorValueObject.create(ErrorType.VALUE);
  }
  if (typeof result === "number") {
    return NumberValueObject.create(result);
  }
  if (typeof result === "boolean") {
    return NumberValueObject.create(result ? 1 : 0);
  }
  // Error text such as "#VALUE!" must become an error object, not a string
  // literal, so dependants propagate the error instead of counting it as text.
  if (ERROR_TYPE_SET.has(result as ErrorType)) {
    return ErrorValueObject.create(result as ErrorType);
  }
  return StringValueObject.create(result);
}

/**
 * Wraps one catalog entry as the function class Univer's preset accepts.
 *
 * `isCustom` stays false, so the engine calls `calculate` with value objects.
 * That path is the same one the built-in functions use, which keeps arity,
 * array and error handling consistent.
 */
function createFunctionClass(entry: CatalogEntry) {
  const { minParams, maxParams } = arity(entry.parameters);
  return class extends BaseFunction {
    constructor(name: unknown) {
      super(name as never);
      this.minParams = minParams;
      this.maxParams = maxParams;
    }

    calculate(...variants: unknown[]): ReturnType<typeof toValueObject> {
      // Propagate an error argument instead of treating its text as data.
      for (const variant of variants) {
        if (isErrorValue(variant)) {
          return variant as ReturnType<typeof toValueObject>;
        }
      }
      try {
        const result = entry.calculate(...variants);
        return toValueObject(result);
      } catch {
        // A calculation must never break the engine or a document load.
        return ErrorValueObject.create(ErrorType.VALUE);
      }
    }
  };
}

/** True when a value object is an Excel-style error. */
function isErrorValue(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { isError?: unknown }).isError === "function" &&
    (value as { isError: () => boolean }).isError()
  );
}

type CustomFunctionClass = ReturnType<typeof createFunctionClass>;

export interface CustomFunctionRegistration {
  /** Pairs for the sheets-core preset's `formula.function` option. */
  functions: Array<[CustomFunctionClass, string]>;
  /** Help text shown by the formula screen tips. */
  descriptions: IFunctionInfo[];
  /**
   * Locale content for the English locale, keyed by namespace.
   *
   * This is passed straight to `mergeLocales` with the preset's English
   * strings, which merges top-level keys: it must not be wrapped in an outer
   * `enUS` object.
   */
  localeContent: Record<string, unknown>;
}

/** Builds the catalog for registration into a new Univer instance. */
export function createCustomFunctionCatalog(): CustomFunctionRegistration {
  const functions = catalog.map(
    (entry) => [createFunctionClass(entry), entry.name] as [CustomFunctionClass, string],
  );

  const descriptions: IFunctionInfo[] = catalog.map((entry) => ({
    functionName: entry.name,
    functionType: FunctionType.User,
    description: entry.description,
    // The screen tip shows the abstract, so the example has to live here to be
    // discoverable; a separate field would be dead data.
    abstract: `${entry.summary} For example: ${entry.example}`,
    functionParameter: entry.parameters,
  }));

  const messages: Record<string, string> = {};
  for (const entry of catalog) {
    messages[`${entry.name}.description`] = entry.description;
    messages[`${entry.name}.abstract`] = `${entry.summary} For example: ${entry.example}`;
  }
  const localeContent: Record<string, unknown> = {
    [FUNCTION_LOCALE_NAMESPACE]: messages,
  };

  return { functions, descriptions, localeContent };
}

/** Catalog function names, in registration order. */
export const CUSTOM_FUNCTION_NAMES = catalog.map((entry) => entry.name);

/**
 * Runs one catalog calculation by name without the engine.
 *
 * Tests use this to prove that every function is side-effect free, and a later
 * preview can reuse it to describe a row without mounting a spreadsheet.
 */
export function calculateCustomFunction(
  name: string,
  ...args: unknown[]
): Primitive | null {
  const entry = catalog.find((candidate) => candidate.name === name);
  return entry ? entry.calculate(...args) : null;
}