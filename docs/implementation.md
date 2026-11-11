# Implementation entry point

This file is a task map for agents, not a manual service setup guide. Read the current user request before selecting work. Decisions can change with evidence: propose a better approach directly to the user instead of inventing workarounds.

## What exists now

### Milestone 1: workbook shell (complete)

- React 19 + TypeScript + Vite 8 application. `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm typecheck`, `pnpm test` are available.
- Univer Sheets 1.4.0, open-source packages only: `@univerjs/presets`, `@univerjs/preset-sheets-core`, plus direct `@univerjs/core`, `@univerjs/sheets`, `@univerjs/engine-formula` and `@univerjs/sheets-formula` for types and facade access. All `@univerjs/*` packages are pinned to the same release line.
- `src/features/spreadsheet/univer/create-univer-engine.ts`: the only module aware of Univer preset and container setup. Mounts one editor into a dedicated wrapper element and exposes lifecycle probes.
- `src/features/spreadsheet/univer/create-workbook-session.ts`: application-facing session (`getWorkbook`, `saveSnapshot`, `whenReady`, `dispose`). Owns readiness, idempotent teardown and deferred engine disposal. Engine creation is injectable for tests.
- `src/features/spreadsheet/components/WorkbookEditor.tsx`: mounts and disposes exactly one session per effect, with a loading/error overlay. Safe under React Strict Mode: the first development-only mount is torn down before the second mount paints.
- `src/features/spreadsheet/model/starter-workbook.ts`: a typed starter workbook with two sheets, formulas, number formats, header styling and a merged range. It is plain spreadsheet content and has no treasury side effects.
- `src/app/App.tsx`, `src/app/main.tsx`, `src/app/global.css`: application shell, `StrictMode` root and full-height layout. The header shows the validated NEAR network from `src/config/env.ts`.

Verified behavior (Chromium, against the development server, then removed from the repository):

- Two sheets load with all formulas recalculated (`=SUM(C4:C6)` → 95, cross-sheet `=Budget!C8` → 95).
- Editing a referenced cell recalculates dependants on both sheets; undo restores the previous total and redo reapplies it.
- Range selection, `save()` snapshots, and restore into a fresh session preserve formulas, styles (bold, number format) and sheet order.
- Strict Mode leaves exactly one editor mounted and logs no React or Univer errors.

### Earlier foundation

- `src/config/env.ts`: T3 Env + Zod validation; default network is testnet. Optional blank variables are treated as missing. Importing configuration makes no service calls.
- `src/integrations/near/client.ts`: factory for a NEAR RPC provider; construction does not perform a query.
- `src/integrations/wallet/connector.ts`: lazy NEAR Connect factory. It uses the selected network and optional hosted wallet manifest. It does not automatically connect; call connection methods only from the explicit wallet UI.
- `.env.example`: supported public configuration keys. Trezu and Intents URLs are reserved configuration; no service adapters are implemented yet.
- `tests/env.test.ts`, `tests/starter-workbook.test.ts`, `tests/workbook-session.test.ts`: offline configuration, workbook content and lifecycle checks.

Not implemented yet: local persistence adapter, document envelope and migrations, export/import, custom treasury formulas, action drafts, wallet UI, treasury reads, proposal submission, and Intents execution. Dependencies currently installed cover the workbook shell plus environment validation and NEAR connection/RPC; Dexie, TanStack Query and `decimal.js` are not installed yet.

## Tasks in dependency order

Implement only the task authorized by the user. Each item should remain reviewable on its own.

1. ~~**Workbook shell.**~~ Done above.
2. **Local documents.** Add Dexie and a versioned document envelope. Save/load the current workbook through a repository adapter; implement native JSON round-trip and CSV interchange. Done when reload and export/import retain formulas, formatting, sheets and metadata; invalid imports leave the original intact.
3. **Custom formulas and action drafts.** Register described custom functions and produce typed action drafts with stable IDs. Add validation and asynchronous lookup states. Done when recalculation creates no signing or submission side effects. References: `univer.md`; decisions sections on formulas and exact amounts.
4. **Wallet UI and treasury reads.** Consume existing factories through a shared React provider. Add mocked policy/proposal/balance reads, network selection and permission display. Optional configured endpoints must have a real adapter before showing as available. Done when missing optional configuration allows local use and wallet cancellation is recoverable. References: `wallets.md`, `near.md`, `sputnik.md`, `trezu.md`.
5. **Proposal actions.** Preview and submit one proposal per payment row; add approve/reject with policy checks. Reconcile transaction outcomes and proposal status. Done when a retry cannot silently duplicate a known submission and approval is distinct from payment completion. Test with mocks.
6. **Intents execution design and adapter.** Keep route/quote/stage fields in draft schemas from task 3 onward. Before implementing execution, resolve the quote-expiry-versus-DAO-approval design using upstream Trezu and Intents sources. Ask the user if requirements conflict. Then implement selected routes, deposits, settlement and refunds using mocks. This dependency order does not defer Intents out of the product. References: `near-intents.md`, `trezu.md`, `sputnik.md`.

## Architecture notes for the next tasks

- Univer owns workbook state. Read and write cells through `WorkbookSession`/facade APIs; do not mirror every cell into React state.
- `saveSnapshot()` already returns the lossless `IWorkbookData` snapshot. Task 2 should wrap that snapshot in the versioned envelope rather than serializing cells itself.
- Keep persistence and treasury adapters outside `src/features/spreadsheet/univer/`, which should stay a thin engine adapter.
- Formula recalculation must never sign or submit. Register custom functions through the preset's `formula.function` option, not by patching the session after mount.
- The current editor loads a starter workbook on every mount. Task 2 replaces that with repository-loaded content and explicit new-document behavior.
- The production bundle is a single large chunk (Univer). Code splitting and a chunk-size budget are worth revisiting once routes or lazy panels exist, but are not a milestone-1 blocker.

## Configuration rules

- T3 Env validates browser configuration. Never use validation bypasses to hide incomplete setup.
- Default wallet selection works without third-party application credentials. A supplied manifest replaces the default; verify it retains the desired normal wallets as well as any embedded wallet.
- Environment presence is configuration readiness, not permission to make a transaction and not evidence of provider compatibility. Do not automatically request quotes, connect wallets, sign, or submit during module import.
- Add an optional integration's complete configuration schema and startup behavior when implementing it. Missing configuration disables that integration; malformed supplied configuration should produce a clear error.
- Email/Google via Privy is a separate provider/signing-page integration, not a built-in effect of setting an app ID. No manual integration guide is requested.

## Reference lookup

Use `rg -n 'registerAsyncFunction|save\(' docs/references/univer.md`, then read the matching section. Use the same approach for other APIs. Pinned upstream source may be newer than the installed release; check installed types before copying an example.

T3 Env's official core configuration reference is https://env.t3.wtf/docs/core (checked 2026-11-11). The implementation uses `@t3-oss/env-core`, a `VITE_` client prefix, Zod validators, and empty-string normalization.