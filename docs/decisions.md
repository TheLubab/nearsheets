# NearSheets decisions

Updated 2026-11-12. These are product decisions, not a completion report. The core implementation exists and the [refactor brief](nearsheets-refactor.md) still governs milestone acceptance. See [implementation status](implementation-status.md) for current evidence/gaps and [the formula catalog](functions.md) for actual signatures. Previous completion reports do not establish product correctness.

## Product

NearSheets is a NEAR table interface for professional spreadsheet users. Blockchain data, formulas, action preparation, governance and reconciliation belong in cells and table operations. Users organize their own workbooks; sheet names, headers and payment templates must not determine whether an operation works.

- Product: **NearSheets**; package/application identifier: `nearsheets`.
- NEAR is the chain; Sputnik is the DAO contract/governance system; NEAR Intents provides cross-chain execution capabilities.
- Trezu is a separate platform, an integration and implementation reference. Use its name only when referring to that platform. Do not prefix general formulas with `TREZU_` or put Sputnik adapters under a Trezu namespace.
- User-written formulas, custom blockchain functions and structured action drafts are core features. A function that only produces an ID is not an action-draft implementation.
- The grid is the primary working surface. Contextual dialogs/popovers may support connection, argument entry, inspection and explicit execution. Permanent treasury dashboards outside the grid do not satisfy the product.
- Onboarding uses an editable getting-started workbook and three local templates (account balances, DAO proposals and contributor payments). File exposes both entry points. Welcome is eligible only after successful startup from an empty repository and editor readiness; dismissal is separate from workbook storage. Templates create independent ordinary v3 documents, with no origin metadata or schema migration. They demonstrate existing functions and never determine execution eligibility. Tours, remote catalogs and community/cross-chain templates are outside this feature.
- Premium UI: use established accessible component patterns, preferably shadcn/ui for the application chrome, with consistent tokens shared with Univer. Preserve spreadsheet keyboard behavior and density. Do not invent a bespoke collection of controls or a decorative dashboard.

## Agreed stack

React, TypeScript, Vite and open-source Univer Sheets; Node 24 and pnpm. Keep all Univer packages compatible. TanStack Query for shared remote data, Dexie/IndexedDB behind a repository adapter, Zod for runtime schemas, T3 Env for centralized environment validation, decimal.js and bigint for exact amounts, React state/context for app state, Vitest for focused tests. Do not duplicate the workbook in an external state store.

Native JSON and CSV import/export are in scope. JSON preserves workbook structure and application metadata. CSV is values-only interchange. XLSX is deferred. Local storage must allow later migration to remote storage without coupling it to components or formulas.

## Integration and auth

- Use NEAR Connect and near-api-js. Follow the auth pattern in Trezu's actual implementation: connection, challenge/authorization, verified session, restoration and logout are distinct states. Inspect `docs/references/trezu.md`, especially its authentication supplement. Do not infer auth from a connected account ID.
- The captured Trezu revision uses `resolveAuth`/NEP-641 with a server challenge and backend verification, including NEP-413 fallback. Match the adopted connector and backend versions. Use NearSheets' identity for NearSheets auth. Whether an existing service supports this application must be verified; a frontend cannot manufacture a trusted session.
- Email/Google and other optional integrations may be configured when supported. Canceling the manual setup guide did not prohibit implementing optional auth. Do not assume those providers exist in the default manifest or claim they are working from env presence alone.
- Use T3 Env with Zod. Missing optional configuration leaves the feature unavailable without blocking local editing, except the public Intents provider: it defaults to `https://1click.chaindefuser.com`, accepts an HTTP(S) override, and is disabled with `VITE_INTENTS_API_URL=none`. Malformed supplied config fails clearly. `VITE_` variables are public; server secrets stay server-side.
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

## Refactor decisions and implementation evidence (2026-11-11)

- The user selected **a new proposal when an exact Intents quote expires**. Never refresh recipient, route or amounts under an old approval. NearSheets embeds route expiry in its proposal description and refuses an approval vote after expiry. The underlying Sputnik transfer cannot enforce that deadline against other clients; the preview states this contract limitation.
- The user authorized adopting a verified compatible connector. Published 0.12.0 lacks `resolveAuth`; the application now pins Trezu's fork at `f2fc9706262b70bd4cc0901e20cc3757c882fb5c`. See the wallet reference compatibility audit. No upstream setup scripts were run.
- Table formulas and explicit execution share a workbook-owned runtime/cache. Action references determine identity; full payload/policy/proposal snapshots determine revisions. Calculation has no wallet capability. Native string value objects preserve exact text without numeric-string coercion.
- The native envelope is v3 (`nearsheets`); v1/v2 names/formulas migrate explicitly. The old IndexedDB database name remains the compatibility store. Export captures the live workbook independently of repository writes.
- The user chose **browser-first NearSheets without a separate app login or authentication server**. Current workbooks are local; reads use RPC/public APIs and transactions use the wallet and contract permissions. Keep the tested service-auth boundary optional and dormant until a named integration requires it. Missing service auth is not a blocker and must not produce an unavailable-service login panel.
- The user selected the public 1Click endpoint as the **default Intents provider** (2026-11-12). This is the intentional exception to missing optional configuration disabling a feature; `VITE_INTENTS_API_URL=none` restores the opt-out.
- The original Univer formatting toolbar, formula bar and sheet controls stay visible by default. The user chose a native fourth **Blockchain** ribbon tab, alongside **Home**, **Formulas** and **View**. Its groups contain read functions, action preparation, refresh/details and selection-aware review. Switching tabs swaps toolbar contents; there is no separate NEAR strip. File commands remain in the document menu. The installed Univer 1.4.0 workbench requires both header and toolbar enabled to render its formatting ribbon. Scope application control styles so they do not override Univer controls. User visual acceptance remains pending.

- Function discovery lives in the **Blockchain** ribbon: **Balances**, **DAO proposals**, **Cross-chain swaps**, **Contracts & staking**, and **Action results** dropdowns. A choice opens a focused argument dialog with a captured target cell and formula preview, without a search sidebar. Insertion never executes actions.
- **File stays in the ribbon tab row**, where the user placed it. The document header retains title/save state, Open shortcut and wallet access. Documentation changes must not relocate File or alter the layout. Freeze and fullscreen are available through the sheet footer context menu.
- Numeric balance cells remain ordinary approximate spreadsheet numbers with automatic grouping, at most six fractional digits and explicit dust display. Token symbols belong in headers/adjacent cells and read details. User toolbar choices take precedence; a native resource persists automatic/manual formatting ownership. Exact balance variants return decimal text for exact transaction arguments; converting them to numbers or doing normal arithmetic loses that guarantee.
- Quotes show exact decimal-text amounts, token symbols, asset/chain identity and original base units in a three-column range. Details shows selected raw cell values first (up to 30), followed by separate workbook-wide read details; exact balance details have readable fields and expandable raw data.
- CSV means underlying cached values of the current sheet, with no formulas/styles or execution metadata. It is not an exact-decimal workbook interchange; use native JSON for fidelity. Current CSV import preserves unsafe integer strings/leading-zero integers, while ordinary recognized numerics become JavaScript numbers.
- Transient operation feedback uses the scoped application toaster, with delayed/stable loading notifications and calculation Stop. Persistent errors stay in controls/dialogs. No separate NearSheets login server or login UI is required; an explicitly configured optional auth endpoint can attempt session restoration.
- Blockchain formulas and pure helpers register native value-object function classes. Async reads capture their cell identity before awaiting; errors stay real spreadsheet errors for propagation and `IFERROR`. Cell/formula diagnostics enrich the existing Univer 1.4 selection alert and Inspect, with technical details expandable. They are transient and not restored as fresh evidence. Review and execution use the same problem vocabulary, with unknown wallet outcomes requiring reconciliation rather than a blind retry.
- Runtime read/draft resources are included in snapshots but are not currently rehydrated into the new session runtime; descriptors/read details are rebuilt through recalculation. Execution journals and native balance-format ownership have separate restoration paths. Offline restoration and the full governance/provider lifecycle remain acceptance gaps; see the status page.
