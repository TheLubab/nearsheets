/**
 * Version of the Trezu custom-function catalog.
 *
 * Kept in its own dependency-free module so document validation and formula
 * registration agree without importing each other. Bump it whenever a function
 * is added, renamed or changes meaning; stored documents record the version they
 * were calculated with.
 */
export const FUNCTION_CATALOG_VERSION = 2;