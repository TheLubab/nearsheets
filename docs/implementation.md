# Implementation entry point

This file is a task map for agents, not a manual service setup guide. Read the current user request before selecting work. Decisions can change with evidence: propose a better approach directly to the user instead of inventing workarounds.

## What exists now

### Milestone 1: workbook shell (complete)

- React 19 + TypeScript + Vite 8 application. `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm typecheck`, `pnpm test` are available.
- Univer Sheets 1.4.0, open-source packages only: `@univerjs/presets`, `@univerjs/preset-sheets-core`, plus direct `@univerjs/core`, `@univerjs/sheets`, `@univerjs/engine-formula` and `@univerjs/sheets-formula` for types and facade access. All `@univerjs/*` packages are pinned to the same release line.
- `src/features/spreadsheet/univer/create-univer-engine.ts`: the only module aware of Univer preset and container setup. Mounts one editor into a dedicated wrapper element and exposes lifecycle probes.
- `src/features/spreadsheet/univer/create-workbook-session.ts`: application-facing session (`getWorkbook`, `saveSnapshot`, `whenReady`, `dispose`). Owns readiness, idempotent teardown and deferred engine disposal. Engine creation is injectable for tests.
- `src/features/spreadsheet/components/WorkbookEditor.tsx`: mounts and disposes exactly one session per effect, with a loading/error overlay. Safe under React Strict Mode: the first development-only mount is torn down before the second mount paints.
- `src/features/spreadsheet/model/starter-workbook.ts`: a typed starter workbook with three sheets (Budget, Summary, Payments), formulas, number formats, header styling and merged ranges. The Payments sheet uses formulas for draft ids and a missing-field count. It is plain spreadsheet content and has no treasury side effects.
- `src/app/App.tsx`, `src/app/main.tsx`, `src/app/global.css`: application shell, `StrictMode` root and full-height layout. The header shows the validated NEAR network from `src/config/env.ts`.

Verified behavior (Chromium, against the development server, then removed from the repository):

- Two sheets load with all formulas recalculated (`=SUM(C4:C6)` → 95, cross-sheet `=Budget!C8` → 95). The Payments sheet was added in milestone 3 and has not been browser-verified.
- Editing a referenced cell recalculates dependants on both sheets; undo restores the previous total and redo reapplies it.
- Range selection, `save()` snapshots, and restore into a fresh session preserve formulas, styles (bold, number format) and sheet order.
- Strict Mode leaves exactly one editor mounted and logs no React or Univer errors.

### Earlier foundation

- `src/config/env.ts`: T3 Env + Zod validation; default network is testnet. Optional blank variables are treated as missing. Importing configuration makes no service calls.
- `src/integrations/near/client.ts`: factory for a NEAR RPC provider; construction does not perform a query.
- `src/integrations/wallet/connector.ts`: lazy NEAR Connect factory. It uses the selected network and optional hosted wallet manifest. It does not automatically connect; call connection methods only from the explicit wallet UI.
- `.env.example`: supported public configuration keys. Trezu and Intents URLs are reserved configuration; no service adapters are implemented yet.
- `tests/env.test.ts`, `tests/starter-workbook.test.ts`, `tests/workbook-session.test.ts`: offline configuration, workbook content and lifecycle checks.

### Milestone 2: local documents (complete)

- Dexie 4 (`dexie`) stores documents in IndexedDB; `fake-indexeddb` is a test-only dependency.
- `src/features/spreadsheet/model/workbook-snapshot.ts`: `WorkbookSnapshot` plus a structural guard. It exists because Univer's `IWorkbookData` marks every field required even though new workbooks are legitimately partial.
- `src/features/documents/model/document-envelope.ts`: the versioned Trezu Sheets envelope (`format`, `schemaVersion`, stable `documentId`, `title`, ISO `createdAt`/`updatedAt`, Univer engine version, custom-function catalog version, treasury/network metadata, and the lossless Univer snapshot). Updates return new objects; the previous envelope is never mutated.
- `src/features/documents/model/document-schema.ts`: envelope validation. Envelope fields are validated strictly; the snapshot is checked structurally so unknown future Univer fields survive. Forwards-compatible versions are reported separately for a clear message.
- `src/features/documents/model/document-migrations.ts`: explicit, ordered migration registry and runner. The registry is empty at schema version 1; the runner fails clearly when a required step is missing and never mutates its input.
- `src/features/documents/repository/document-repository.ts`: async repository interface plus an in-memory implementation for tests.
- `src/features/documents/repository/dexie-document-repository.ts`: IndexedDB adapter. Rows are re-validated and migrated on read. Dexie's database version is deliberately separate from the document schema version.
- `src/features/documents/interchange/json.ts`: native JSON export/import. Export writes only known fields, so credentials or function implementations cannot leak into a file. Import parses, migrates and validates before anything is written.
- `src/features/documents/interchange/csv.ts`: values-only CSV. Handles RFC 4180 quoting, escaped quotes, embedded newlines and BOM. Imports force `=...` text to a string so a CSV can never create a formula, and preserve leading zeros and unsafe integers. Exports formula cells' current values.
- `src/features/documents/session/document-persistence.ts`: autosave bridge. Edits mark the document dirty, saves are debounced and serialized, and a failed write leaves the last good envelope and reports the error. Selection/view operations are ignored, and an unchanged snapshot is not rewritten.
- `src/features/documents/application/document-workspace.ts`: framework-free controller for the open document, autosave, new/rename, import/export, and switching documents. Explicit actions flush pending edits first; if that flush fails, the action is refused rather than exporting, renaming or switching with stale content. CSV export defaults to the sheet the user is currently viewing.
- `src/features/documents/components/DocumentBar.tsx`: document title/rename, save status, New, Import…, Export JSON, Export CSV and error/notice display.
- `src/app/App.tsx` loads the most recent document (or creates the starter document once), attaches autosave when the editor is ready, and flushes on `pagehide`/tab hide.
- `src/features/spreadsheet/components/WorkbookEditor.tsx` now takes a document id and snapshot, remounting only when the document identity changes.

Verified by tests: JSON round trip keeps formulas, number formats, merges and sheet order; invalid, unrelated and newer-version imports leave the current document and its stored copy untouched; CSV round trips values and never produces formulas; autosave skips view-only operations, reports failures and keeps the last good document; the Dexie adapter round trips, sorts by update time, replaces by id and survives reopening. Exports and renames include edits still inside the autosave debounce window, a failed flush refuses the action instead of writing stale content, and a late readiness callback from a replaced editor cannot detach the live one.

Earlier foundation notes continue below.

### Milestone 3: custom formulas and action drafts (complete)

- `src/features/treasury/model/exact-amount.ts`: exact amount conversion. Base units are built from a decimal string, never from floating-point arithmetic. Double representation noise is accepted, meaningful excess precision is rejected unless `mode: "round"` is explicit, and precision above 24 decimals is refused rather than guessed.
- `src/features/treasury/model/near-account.ts`: syntactic NEAR account id check (named and 64-hex implicit accounts). It does not prove the account exists or can receive funds.
- `src/features/treasury/model/action-draft.ts`: `ActionDraft` types, Intents staging, `draftId`/`draftIdFromParts` (64-bit FNV-1a over kind, network, treasury account and reference), `draftFromRow` validation, and `validateActionDraft` for untrusted drafts. Native NEAR (`assetId: "near"`) is a transfer; any other asset is an Intents delivery starting at stage `planned` with no invented quote. Non-NEAR assets require explicit precision.
- `src/features/treasury/model/function-catalog-version.ts`: the catalog version value (2) in a dependency-free module, so document validation does not import the formula engine.
- `src/features/treasury/formulas/custom-functions.ts`: the described catalog `TREZU_AMOUNT`, `TREZU_ACCOUNT`, `TREZU_REFERENCE`, `TREZU_DRAFT`, `TREZU_SUM_REF`, `TREZU_MISSING`. Each is a pure calculation: no network, signing, submission or document mutation. Function classes return Univer value objects, propagate argument errors, and are registered through the preset's `formula.function`/`formula.description` options.
- `src/features/treasury/formulas/asset-lookup.ts`: asynchronous asset metadata with request deduplication, TTL caching, explicit refresh, stale-reply rejection, `loading`/`ready`/`error` states and disposal. `createStaticAssetSource` knows only native NEAR offline; unknown assets resolve to `null` rather than a guessed precision.
- `src/features/treasury/application/collect-drafts.ts`: reads the Payments sheet by header text (so columns can move), skips blank padding rows, validates each row and reports duplicate references instead of merging identities. A blank Asset cell means native NEAR. Until a document treasury account is selected, the sheet's Treasury cell is used, so the panel's ids match the sheet's `TREZU_DRAFT` formulas.
- `src/features/treasury/components/DraftReview.tsx`: read-only "Check payments" panel. It never writes, signs or submits.
- `src/features/spreadsheet/univer/create-univer-engine.ts`: registers the catalog at engine creation. `src/features/documents/application/document-workspace.ts` exposes `getSession()` for read-only features.

Verified by tests: exact base units resist double noise; over-precision is refused instead of silently rounded; draft ids stay stable across moves and are shared by the model and `TREZU_DRAFT`; duplicate references are reported; Intents drafts start unquoted; unknown assets never produce a guessed precision; concurrent lookups deduplicate and stale replies cannot overwrite newer ones; every custom function runs without I/O; the document envelope records catalog version 2 and round trips the three-sheet starter.

Not implemented yet: wallet UI, treasury reads, proposal submission, and Intents execution. Installed dependencies now cover the workbook shell, environment validation, NEAR connection/RPC, Dexie persistence, `decimal.js` exact amounts and `fake-indexeddb` tests; TanStack Query is not installed yet.

## Tasks in dependency order

Implement only the task authorized by the user. Each item should remain reviewable on its own.

1. ~~**Workbook shell.**~~ Done above.
2. ~~**Local documents.**~~ Done above.
3. ~~**Custom formulas and action drafts.**~~ Done above.
4. **Wallet UI and treasury reads.** Consume existing factories through a shared React provider. Add mocked policy/proposal/balance reads, network selection and permission display. Optional configured endpoints must have a real adapter before showing as available. Done when missing optional configuration allows local use and wallet cancellation is recoverable. References: `wallets.md`, `near.md`, `sputnik.md`, `trezu.md`.
5. **Proposal actions.** Preview and submit one proposal per payment row; add approve/reject with policy checks. Reconcile transaction outcomes and proposal status. Done when a retry cannot silently duplicate a known submission and approval is distinct from payment completion. Test with mocks.
6. **Intents execution design and adapter.** Keep route/quote/stage fields in draft schemas from task 3 onward. Before implementing execution, resolve the quote-expiry-versus-DAO-approval design using upstream Trezu and Intents sources. Ask the user if requirements conflict. Then implement selected routes, deposits, settlement and refunds using mocks. This dependency order does not defer Intents out of the product. References: `near-intents.md`, `trezu.md`, `sputnik.md`.

## Architecture notes for the next tasks

- Univer owns workbook state. Read and write cells through `WorkbookSession`/facade APIs; do not mirror every cell into React state.
- `saveSnapshot()` already returns the lossless `IWorkbookData` snapshot; the document envelope wraps it as-is. Do not serialize cells manually.
- Keep persistence and treasury adapters outside `src/features/spreadsheet/univer/`, which should stay a thin engine adapter.
- Persistence flows one way: `WorkbookSession` → autosave bridge → `DocumentRepository`. Only `DocumentBar`/`App` call the workspace; React never touches Dexie.
- The workspace flushes pending edits before export, rename or a document switch. Keep that invariant: dropping a just-typed edit is worse than refusing the action.
- Formula recalculation must never sign or submit. Register custom functions through the preset's `formula.function` option, not by patching the session after mount.
- When a document schema field changes, bump `SCHEMA_VERSION` and add exactly one `DocumentMigration` per step. Never edit a released migration.
- Not yet built: a document picker or delete UI, cross-document search, remote sync. The repository interface already supports them; IndexedDB remains a draft store, not a backup.
- The production bundle is a single large chunk (Univer). Code splitting and a chunk-size budget are worth revisiting once routes or lazy panels exist, but are not a blocker.

## Configuration rules

- T3 Env validates browser configuration. Never use validation bypasses to hide incomplete setup.
- Default wallet selection works without third-party application credentials. A supplied manifest replaces the default; verify it retains the desired normal wallets as well as any embedded wallet.
- Environment presence is configuration readiness, not permission to make a transaction and not evidence of provider compatibility. Do not automatically request quotes, connect wallets, sign, or submit during module import.
- Add an optional integration's complete configuration schema and startup behavior when implementing it. Missing configuration disables that integration; malformed supplied configuration should produce a clear error.
- Email/Google via Privy is a separate provider/signing-page integration, not a built-in effect of setting an app ID. No manual integration guide is requested.

## Reference lookup

Use `rg -n 'registerAsyncFunction|save\(' docs/references/univer.md`, then read the matching section. Use the same approach for other APIs. Pinned upstream source may be newer than the installed release; check installed types before copying an example.

T3 Env's official core configuration reference is https://env.t3.wtf/docs/core (checked 2026-11-11). The implementation uses `@t3-oss/env-core`, a `VITE_` client prefix, Zod validators, and empty-string normalization.