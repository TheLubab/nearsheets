# Trezu Sheets

A spreadsheet interface for community finances on NEAR, connected to Trezu and Sputnik DAO. See [IDEA.md](IDEA.md) for the proposed workflow and scope.

## Current state

The repository contains a working React + TypeScript + Vite application with an embedded Univer Sheets editor. Multiple sheets, user-written formulas, cross-sheet references, formatting, range selection, copy/paste and undo/redo work locally. A described custom-function catalog (`TREZU_AMOUNT`, `TREZU_ACCOUNT`, `TREZU_REFERENCE`, `TREZU_DRAFT`, `TREZU_SUM_REF`, `TREZU_MISSING`) turns payment rows into typed action drafts with stable ids; a read-only "Check payments" panel validates them. Formulas never sign or submit. Documents are saved automatically to IndexedDB and can be exported or imported as lossless JSON; CSV is available as a values-only interchange format.

A wallet can be connected through NEAR Connect, and a document can record which treasury it plans for. The treasury panel reads that DAO's policy, roles and recent proposals and shows the connected account's permissions. Reads are view calls only: nothing is signed, submitted or moved. A separate wallet network switch exists because a document's treasury network and the wallet's network are independent. Optional Trezu and Intents URLs are shown as configured but not wired until an adapter exists. In a development build, account ids containing `demo` show sample treasury data.

Selection and lifecycle decisions are in [technical decisions](docs/decisions.md); status and next tasks are in [implementation](docs/implementation.md).

## Development environment

Run `nix develop` to enter the existing development shell with Node.js 24, pnpm, and Git. Alternatively, install Node.js 24 and pnpm locally.

Install dependencies with `pnpm install`. Public configuration is described in `.env.example`; keep local values in `.env`. T3 Env validates supplied values. NEAR defaults to testnet; optional configuration may remain blank, and local editing needs no integration. Run `pnpm dev` for the local application, `pnpm build` for a production build, and `pnpm typecheck` / `pnpm test` for verification.

Local documents live in IndexedDB for this browser profile. Clearing site data deletes them; use Export JSON for a durable copy. JSON is the lossless workbook format, while CSV carries values only (no formulas, styles or multiple sheets).

Agents should start with [implementation status and task order](docs/implementation.md).

## Repository layout

```text
docs/                     Design notes and integration research
public/                   Static assets
src/
  app/                    Application entry point and composition
  features/
    documents/            Document envelope, storage, autosave, import/export
      application/        Framework-free document controller
      components/         Document bar UI
      interchange/        Native JSON and CSV interchange
      model/              Envelope, validation, migrations
      repository/         Storage adapters (Dexie, in-memory)
      session/            Autosave bridge
    spreadsheet/          Sheet editing, calculations, and row validation
      components/         React UI around the editor
      model/              Workbook content and document types
      univer/             Univer engine and session lifecycle adapter
    treasury/             Payment drafts, custom formulas, review and reads
      application/        Draft collection, treasury reader, query hooks
      components/         Draft review and treasury panels
      formulas/           Custom-function catalog and asset lookup
      model/              Action drafts, exact amounts, treasury read types
    wallet/               Wallet UI and connection state
      application/        Framework-free wallet controller
      components/         Wallet connect/network panel
  integrations/
    near/                 NEAR network and contract adapters
    trezu/                Sputnik treasury read source and demo data
    wallet/               NEAR Connect gateway
  shared/                 Shared utilities, types, and UI primitives
tests/
  fixtures/               Synthetic test data
  mocks/                  Mock external services and blockchain interactions
```

Empty directories are tracked with `.gitkeep` placeholders. Add files as implementation begins.

## Development rules

Local technical reference bundles are available for [NEAR](docs/references/near.md), [Trezu](docs/references/trezu.md), and [Sputnik DAO v2](docs/references/sputnik.md). Each includes pinned upstream documentation or implementation source and retrieval metadata. Read the relevant bundle before implementing an integration.

Frontend references are available for [Univer](docs/references/univer.md), [React](docs/references/react.md), [TypeScript](docs/references/typescript.md), and [Vite](docs/references/vite.md).

Follow [AGENTS.md](AGENTS.md). Keep tests small and focused on meaningful behavior, mock external integrations, and avoid live treasury or blockchain activity during testing. Start development servers only when explicitly requested.

Spreadsheet edits prepare actions; treasury custody and approval rules remain with Sputnik/Trezu. Confirm integration capabilities before implementing contract calls.

The workbook shell uses Univer 1.4.0 open-source packages. All `@univerjs/*` packages must stay on the same release line; keep the versions in `package.json` in lockstep when upgrading.
