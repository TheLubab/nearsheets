# Trezu Sheets

A spreadsheet interface for community finances on NEAR, connected to Trezu and Sputnik DAO. See [IDEA.md](IDEA.md) for the proposed workflow and scope.

## Current state

The repository contains a working React + TypeScript + Vite application with an embedded Univer Sheets editor. Multiple sheets, user-written formulas, cross-sheet references, formatting, range selection, copy/paste and undo/redo work locally, with no wallet or treasury connection. Selection and lifecycle decisions are in [technical decisions](docs/decisions.md); status and next tasks are in [implementation](docs/implementation.md).

## Development environment

Run `nix develop` to enter the existing development shell with Node.js 24, pnpm, and Git. Alternatively, install Node.js 24 and pnpm locally.

Install dependencies with `pnpm install`. Public configuration is described in `.env.example`; keep local values in `.env`. T3 Env validates supplied values. NEAR defaults to testnet; optional configuration may remain blank, and local editing needs no integration. Run `pnpm dev` for the local application, `pnpm build` for a production build, and `pnpm typecheck` / `pnpm test` for verification.

Agents should start with [implementation status and task order](docs/implementation.md).

## Repository layout

```text
docs/                     Design notes and integration research
public/                   Static assets
src/
  app/                    Application entry point and composition
  features/
    spreadsheet/          Sheet editing, calculations, and row validation
      components/         React UI around the editor
      model/              Workbook content and document types
      univer/             Univer engine and session lifecycle adapter
    treasury/             Proposal preparation and reconciliation
  integrations/
    near/                 NEAR network and contract adapters
    trezu/                Trezu and Sputnik integration adapters
    wallet/               Wallet connection and signing adapters
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
