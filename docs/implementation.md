# Implementation entry point

This file is a task map for agents, not a manual service setup guide. Read the current user request before selecting work. Decisions can change with evidence: propose a better approach directly to the user instead of inventing workarounds.

## What exists now

- Project folders and upstream reference bundles.
- `src/config/env.ts`: T3 Env + Zod validation; default network is testnet. Optional blank variables are treated as missing. Importing configuration makes no service calls.
- `src/integrations/near/client.ts`: factory for a NEAR RPC provider; construction does not perform a query.
- `src/integrations/wallet/connector.ts`: lazy NEAR Connect factory. It uses the selected network and optional hosted wallet manifest. It does not automatically connect; call connection methods only from the explicit wallet UI.
- `.env.example`: supported public configuration keys. Trezu and Intents URLs are reserved configuration; no service adapters are implemented yet.
- `tests/env.test.ts`: offline configuration behavior checks.
- `pnpm typecheck` and `pnpm test`: available verification commands.

There is no React UI, workbook, persistence adapter, social-login signing page, treasury adapter, or Intents execution adapter yet. Do not report them as working. Dependencies currently installed are limited to environment validation, NEAR connection/RPC, and verification tooling; other agreed libraries are not installed yet.

## Tasks in dependency order

Implement only the task authorized by the user. Each item should remain reviewable on its own.

1. **Workbook shell.** Add React/Vite and a compatible released Univer package set. Mount/dispose one editor correctly, including React Strict Mode cleanup. Done when a local workbook supports editing, formulas, selection, clipboard, and undo/redo. References: `react.md`, `vite.md`, `univer.md`.
2. **Local documents.** Add Dexie and a versioned document envelope. Save/load the current workbook through a repository adapter; implement native JSON round-trip and CSV interchange. Done when reload and export/import retain formulas, formatting, sheets and metadata; invalid imports leave the original intact.
3. **Custom formulas and action drafts.** Register described custom functions and produce typed action drafts with stable IDs. Add validation and asynchronous lookup states. Done when recalculation creates no signing or submission side effects. References: `univer.md`; decisions sections on formulas and exact amounts.
4. **Wallet UI and treasury reads.** Consume existing factories through a shared React provider. Add mocked policy/proposal/balance reads, network selection and permission display. Optional configured endpoints must have a real adapter before showing as available. Done when missing optional configuration allows local use and wallet cancellation is recoverable. References: `wallets.md`, `near.md`, `sputnik.md`, `trezu.md`.
5. **Proposal actions.** Preview and submit one proposal per payment row; add approve/reject with policy checks. Reconcile transaction outcomes and proposal status. Done when a retry cannot silently duplicate a known submission and approval is distinct from payment completion. Test with mocks.
6. **Intents execution design and adapter.** Keep route/quote/stage fields in draft schemas from task 3 onward. Before implementing execution, resolve the quote-expiry-versus-DAO-approval design using upstream Trezu and Intents sources. Ask the user if requirements conflict. Then implement selected routes, deposits, settlement and refunds using mocks. This dependency order does not defer Intents out of the product. References: `near-intents.md`, `trezu.md`, `sputnik.md`.

## Configuration rules

- T3 Env validates browser configuration. Never use validation bypasses to hide incomplete setup.
- Default wallet selection works without third-party application credentials. A supplied manifest replaces the default; verify it retains the desired normal wallets as well as any embedded wallet.
- Environment presence is configuration readiness, not permission to make a transaction and not evidence of provider compatibility. Do not automatically request quotes, connect wallets, sign, or submit during module import.
- Add an optional integration's complete configuration schema and startup behavior when implementing it. Missing configuration disables that integration; malformed supplied configuration should produce a clear error.
- Email/Google via Privy is a separate provider/signing-page integration, not a built-in effect of setting an app ID. No manual integration guide is requested.

## Reference lookup

Use `rg -n 'registerAsyncFunction|save\(' docs/references/univer.md`, then read the matching section. Use the same approach for other APIs. Pinned upstream source may be newer than the installed release; check installed types before copying an example.

T3 Env's official core configuration reference is https://env.t3.wtf/docs/core (checked 2026-11-11). The implementation uses `@t3-oss/env-core`, a `VITE_` client prefix, Zod validators, and empty-string normalization.
