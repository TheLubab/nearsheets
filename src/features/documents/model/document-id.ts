// 72 random bits in a compact URL-safe identifier. Existing IDs remain valid.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
export function createDocumentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, byte => ALPHABET[byte & 63]).join('');
}
