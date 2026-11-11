/**
 * NEAR account id validation for recipients.
 *
 * This is a syntactic check, not proof that an account exists. Reserving a
 * name and creating the account are separate on-chain steps, and a transfer to
 * a non-existent account can burn the funds, so submission-time checks remain a
 * later task. Here we only reject values that can never be a valid account id.
 */

/** Named accounts (`example.near`) and implicit accounts (64 hex characters). */
const NAMED_ACCOUNT = /^[a-z\d]+(?:[._-][a-z\d]+)*$/;
const IMPLICIT_ACCOUNT = /^[0-9a-f]{64}$/;

export const NEAR_ACCOUNT_MIN_LENGTH = 2;
export const NEAR_ACCOUNT_MAX_LENGTH = 64;

export interface AccountCheck {
  ok: boolean;
  /** Normalized account id, or the original trimmed input when invalid. */
  accountId: string;
  reason: string | null;
}

export function checkNearAccountId(value: unknown): AccountCheck {
  if (typeof value !== "string") {
    return {
      ok: false,
      accountId: "",
      reason: "Recipient must be a NEAR account id such as sara.near.",
    };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, accountId: "", reason: "Recipient is empty." };
  }

  if (IMPLICIT_ACCOUNT.test(trimmed)) {
    return { ok: true, accountId: trimmed, reason: null };
  }

  const accountId = trimmed.toLowerCase();
  if (accountId.length < NEAR_ACCOUNT_MIN_LENGTH || accountId.length > NEAR_ACCOUNT_MAX_LENGTH) {
    return {
      ok: false,
      accountId: trimmed,
      reason: `A NEAR account id must be ${NEAR_ACCOUNT_MIN_LENGTH}-${NEAR_ACCOUNT_MAX_LENGTH} characters long.`,
    };
  }

  if (!NAMED_ACCOUNT.test(accountId)) {
    return {
      ok: false,
      accountId: trimmed,
      reason:
        "A NEAR account id uses lowercase letters, digits and single '.', '-' or '_' separators, for example sara.near.",
    };
  }

  return { ok: true, accountId, reason: null };
}