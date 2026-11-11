# NearSheets decisions

Updated 2026-11-11. These are product decisions, not claims about completed code. The current implementation requires the comprehensive refactor in [nearsheets-refactor.md](nearsheets-refactor.md). Previous milestone completion reports do not establish product correctness.

## Product

NearSheets is a NEAR table interface for professional spreadsheet users. Blockchain data, formulas, action preparation, governance and reconciliation belong in cells and table operations. Users organize their own workbooks; sheet names, headers and payment templates must not determine whether an operation works.

- Product: **NearSheets**; package/application identifier: `nearsheets`.
- NEAR is the chain; Sputnik is the DAO contract/governance system; NEAR Intents provides cross-chain execution capabilities.
- Trezu is a separate platform, an integration and implementation reference. Use its name only when referring to that platform. Do not prefix general formulas with `TREZU_` or put Sputnik adapters under a Trezu namespace.
- User-written formulas, custom blockchain functions and structured action drafts are core features. A function that only produces an ID is not an action-draft implementation.
- The grid is the primary working surface. Contextual dialogs/popovers may support connection, argument entry, inspection and explicit execution. Permanent treasury dashboards outside the grid do not satisfy the product.
- Premium UI: use established accessible component patterns, preferably shadcn/ui for the application chrome, with consistent tokens shared with Univer. Preserve spreadsheet keyboard behavior and density. Do not invent a bespoke collection of controls or a decorative dashboard.

## Agreed stack

React, TypeScript, Vite and open-source Univer Sheets; Node 24 and pnpm. Keep all Univer packages compatible. TanStack Query for shared remote data, Dexie/IndexedDB behind a repository adapter, Zod for runtime schemas, T3 Env for centralized environment validation, decimal.js and bigint for exact amounts, React state/context for app state, Vitest for focused tests. Do not duplicate the workbook in an external state store.

Native JSON and CSV import/export are in scope. JSON preserves workbook structure and application metadata. CSV is values-only interchange. XLSX is deferred. Local storage must allow later migration to remote storage without coupling it to components or formulas.

## Integration and auth

- Use NEAR Connect and near-api-js. Follow the auth pattern in Trezu's actual implementation: connection, challenge/authorization, verified session, restoration and logout are distinct states. Inspect `docs/references/trezu.md`, especially its authentication supplement. Do not infer auth from a connected account ID.
- The captured Trezu revision uses `resolveAuth`/NEP-641 with a server challenge and backend verification, including NEP-413 fallback. Match the adopted connector and backend versions. Use NearSheets' identity for NearSheets auth. Whether an existing service supports this application must be verified; a frontend cannot manufacture a trusted session.
- Email/Google and other optional integrations may be configured when supported. Canceling the manual setup guide did not prohibit implementing optional auth. Do not assume those providers exist in the default manifest or claim they are working from env presence alone.
- Use T3 Env with Zod. Missing optional configuration leaves the feature unavailable without blocking local editing. Malformed supplied config fails clearly. `VITE_` variables are public; server secrets stay server-side.
- Prefer direct Sputnik contract integration, with optional Trezu enrichment. Support proposal creation, approvals/rejections and execution tracking through the table. Existing DAO policies retain authority. One proposal per payment action is the initial default, subject to actual execution requirements.
- NEAR assets, NEAR fungible tokens, cross-chain payments/swaps, staking and other contract actions are in scope. NEAR Intents must shape the data and action model from the start. It is not a synonym for every non-native token transfer.
- Model asset origin, destination chain/asset/address, quote validity, fees/slippage, governance, deposit, settlement and refund independently. Resolve quote expiry across DAO approval using verified upstream behavior. Ask the user about a real architectural conflict rather than silently dropping support.

## Behavior that must hold

- Calculation, import, refresh and undo/redo may read data or prepare drafts; they never sign or submit transactions. Execution is an explicit action on selected table operations after an exact preview.
- Read data must be usable by other formulas. Action drafts contain validated arguments, not only hashes. Statuses and receipts return to their associated cells/rows.
- Exact token amounts use verified asset precision. Never silently round an explicitly supplied decimal string, let a cell redefine native NEAR's decimals, or imply arbitrary-precision guarantees for a JavaScript number.
- Documents are recoverable: list/open previous documents, preserve IDs and action history correctly, and export the current workbook even if IndexedDB writes fail.
- Demo data is explicitly selected and visibly identified. Never route a real account to invented balances because its name contains `demo`.

## Changing a decision

Decisions are subject to new evidence and agent suggestions. If another approach would work better, explain the evidence and tradeoff and ask the user directly. Do not invent workarounds or silently reduce scope. Routine implementation details within the agreed direction remain autonomous.
