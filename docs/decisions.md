# Technical decisions

Recorded: 2026-11-11. Status: user-selected direction. Environment validation, NEAR connection factories and the spreadsheet workbook shell are implemented; see [implementation status](implementation.md).

## How decisions evolve

These decisions are subject to change as context is gathered and agents suggest improvements. If an agent believes another approach would work better, it should explain the evidence and tradeoff and ask the user directly before changing an agreed direction. Do not invent workarounds to preserve an unsuitable decision or silently reduce the required UX or integration scope. Routine implementation details within the agreed direction can proceed autonomously.

## Selected stack

- Univer Sheets, beginning with its open-source packages.
- React, TypeScript, and Vite.
- User-written spreadsheet formulas and application-defined custom functions are core product features. Target professional spreadsheet users.
- Local drafts and file export/import first, with a path to remote storage later.
- Node.js 24 and pnpm remain the development environment.

Package versions, styling system, and any future Excel conversion library remain unselected. Reference snapshots do not select package versions. The workbook shell pins `@univerjs/*` to the 1.4.0 release line, using open-source presets only.

## Treasury, wallets, and cross-chain scope

- Prefer direct Sputnik DAO integration for policies, proposals, submission, voting and execution tracking, with optional Trezu enrichment. Verify deployed contract compatibility and Trezu API capabilities first. If direct integration cannot support a required workflow, bring the concrete limitation and alternatives to the user.
- Support preparing and submitting proposals, approving/rejecting them, and tracking execution inside Sheets, according to the DAO's actual permissions. Reuse existing treasury contracts and approval rules; no new multisig contract is selected.
- Use NEAR Connect (`@hot-labs/near-connect`), following the [NEAR wallet-login guide](https://docs.near.org/web3-apps/tutorials/wallet-login). Start with the connector's normal wallet selection and capability filtering. Aim to validate Meteor, HOT, MyNearWallet and Ledger; do not imply tested support before verification. Account for network and browser/device capabilities.
- Keep onboarding simple. Email/Google login is possible through an additional embedded-wallet integration such as the [documented Privy path](https://docs.near.org/web3-apps/tutorials/privy); it is not automatically included by installing NEAR Connect. Defer that extra service/configuration until needed, retaining the ability to add it through the connector. Local editing does not require a wallet.
- NEAR native assets, NEAR fungible tokens, cross-chain payments, swaps, staking and other treasury actions are in the product direction. NEAR Intents is integral to the action and reconciliation model, not an optional future afterthought. This is not a claim of universal chain/asset/action support; verify routes and capabilities per adapter.
- Prefer one proposal per payment row initially. A complex row may need multiple execution stages; retain their relationship to the originating action draft. Batch wallet signing does not imply atomic execution. Revisit grouping if a required Intents workflow needs different proposal semantics.
- Formulas may produce structured action drafts as well as calculations and read-only data. Drafts must capture treasury/network, asset identity, exact amount, recipient, action type and relevant execution parameters. Signing/submission remains an explicit operation outside recalculation.

## NEAR Intents integration requirements

Treat quotes, deposits, intent execution, destination settlement and refunds as distinct stages. Record provider/route identity, quote expiry, slippage, fees, destination recipient, refund recipient, proposal IDs, deposits and transaction/intent references. Separate governance approval from execution success and destination settlement.

DAO approval can outlive a quote. Do not blindly fund an expired quote, silently substitute a new destination or amount, or bypass approval to refresh a quote. Research the Trezu/Sputnik execution model and Intents route constraints, then present any conflict to the user. A 1Click wallet example is not proof that the same signing/deposit flow works for a DAO.

Evaluate 1Click and direct Intents integration against treasury custody and permission requirements before selecting the exact SDK and execution route. The 1Click API is a useful starting reference, not a decision to implement every cross-chain operation as a personal-wallet swap. Do not assume that a NEAR wallet connector signs transactions for every destination chain. Staking and other contract actions require their own adapters.

Use mocked quote, expiry, execution, partial failure and refund outcomes in development. Fetching documentation does not authorize live quotes, deposits or transactions.

## Supporting libraries

- `near-api-js`: RPC reads and transaction utilities; the connected wallet handles user signing.
- TanStack Query: remote data caching and refresh handling. Use a shared data layer for formula and UI reads; explicitly control transaction retries and refresh behavior.
- Dexie: IndexedDB persistence behind the document repository adapter.
- Zod: runtime validation of imports, configuration and action inputs.
- T3 Env (`@t3-oss/env-core`) with Zod: centralized typed environment validation. Optional integrations should activate only with complete validated configuration and an implemented adapter; missing configuration must not block local use. Public browser config must never contain service secrets.
- `decimal.js` and native `bigint`: decimal conversions and exact integer base units at transaction boundaries.
- React state/context for application state initially; Univer owns workbook state. Avoid copying every cell into a second state store.
- Vitest for focused behavior tests with mocked external integrations. Add targeted browser checks when implementation makes them useful.

These library choices are agreed; released versions and integration details remain to be validated. Do not install dependencies merely to collect references.

## Formula UX and execution boundaries

Preserve spreadsheet editing, formula text, cross-sheet references, range selection, copy/paste, undo/redo, and formatting. Custom functions need discoverable names, argument help, examples, validation, and useful error feedback. Do not replace user-written formulas with a fixed list of application calculations.

Custom functions may calculate values and read external data. Recalculation, opening an imported workbook, copying a formula, or undoing an edit must never submit a proposal, prompt a wallet signature, or move funds. Preparing an action and submitting it are separate operations; submission requires an explicit user action and preview.

For asynchronous functions, design request deduplication, caching, refresh controls, stale-result handling, and visible loading/error states. Avoid one unbounded network request per cell on every recalculation. Use mocks while developing this behavior. Inspect worker compatibility for the selected release before moving custom functions off the UI thread.

Keep exact token quantities as decimal strings or integer base units at the transaction boundary. Spreadsheet numeric results require explicit precision and rounding validation before becoming transaction amounts.

These are implementation requirements, not claims that every interaction is automatically supplied by Univer.

## Persistence and future migration

Use Dexie/IndexedDB behind an asynchronous document repository interface. Keep persistence out of React components and formula implementations. A later remote repository can replace the storage adapter without changing the sheet UI.

Use a versioned Trezu Sheets document envelope containing a stable document ID, schema version, timestamps, Univer snapshot, engine version, custom-function catalog version, and treasury/network metadata. Keep row/action identities stable independently of cell coordinates. Store proposal and transaction references as metadata rather than inferring identity from a row number.

Capture current workbook state using the workbook save API. Native JSON export/import should round-trip the envelope, formulas, formatting, sheets, and supported plugin resources. Define migrations for older document versions; reject unsupported future versions without overwriting the original. Validate imported data and preserve a recoverable original before migration. Never export credentials or executable custom-function implementations.

IndexedDB is a local draft store, not a guaranteed backup. Expose save failures and provide explicit downloadable exports. Future remote sync will also need authorization and conflict handling; the repository interface alone does not provide collaboration.

## Free versus paid capabilities

The open-source implementation includes synchronous and asynchronous custom-function registration and workbook snapshots; see [univer.md](references/univer.md) for pinned source. This supports the selected starting direction, subject to validating UX and performance against a released version.

Univer's official Office conversion uses Pro packages and a conversion backend, including its snapshot conversion APIs. Native JSON snapshot saving is separate from Excel conversion. The current edition comparison also places charts, pivot tables, and real-time collaboration in commercial scope. Sources checked on 2026-11-11: [file exchange](https://docs.univer.ai/guides/sheets/features/import-export), [edition comparison](https://www.univer.ai/pricing/).

If a required feature exceeds the free edition:

1. Prefer a focused extension using public Univer APIs for custom treasury UI, formula help, or native file handling.
2. For XLSX exchange, evaluate a separate converter with representative workbooks. Publish its compatibility limits for styles, formulas, resources, and unsupported constructs; do not silently discard them. No converter is selected yet.
3. If high-fidelity Office exchange or advanced built-in features are essential, evaluate Univer Pro before rebuilding those features. Account for service deployment as well as licensing.
4. Reconsider the editor only if these options cannot meet the required UX. A simpler grid would require rebuilding much of the spreadsheet experience and is not an automatic fallback.

Native JSON workbook export/import and CSV interchange are selected for the first release. JSON is the lossless workbook format; CSV is a values-only interchange format. XLSX is deferred. Custom Trezu functions will not automatically execute in Excel or Google Sheets.

## Local reference map

- [Wallets](references/wallets.md): NEAR Connect setup and wallet capabilities.
- [NEAR Intents](references/near-intents.md): concepts, SDK, quotes, deposits, balances and status lifecycle.

- [Univer](references/univer.md): license, core preset, custom functions, calculation, workbook saving, clipboard behavior.
- [React](references/react.md): integration lifecycle, refs, effect cleanup and Strict Mode.
- [TypeScript](references/typescript.md): types, narrowing and project configuration.
- [Vite](references/vite.md): setup, assets, TypeScript handling, builds and environment variables.
- [NEAR](references/near.md), [Trezu](references/trezu.md), [Sputnik](references/sputnik.md): blockchain and treasury integration sources.
