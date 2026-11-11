# NearSheets

A spreadsheet interface for NEAR: blockchain data, formulas, Sputnik governance and NEAR Intents operations inside the table. See [IDEA.md](IDEA.md).

## Current direction

The current application diverged into a payment template with external treasury panels. It needs a comprehensive refactor. Existing code and passing tests are implementation material to evaluate, not the product specification.

Start with [AGENTS.md](AGENTS.md), [the refactor brief](docs/nearsheets-refactor.md), and [agreed decisions](docs/decisions.md). The refactor is one complete deliverable, not a sequence of independent milestone completions. Application code still contains the old branding until the refactor updates it.

## Development

Use `nix develop` or Node.js 24 with pnpm. Install with `pnpm install`.

- `pnpm typecheck`
- `pnpm build`
- `pnpm test` (prefer the relevant test files during development)
- `pnpm dev` / `pnpm preview` (agents require an explicit request before starting servers)

Environment configuration is validated by T3 Env. `.env.example` documents current public settings. Configured URLs do not mean the integration is implemented. Never place secrets in `VITE_` variables.

## References

Pinned upstream documentation and source are in `docs/references/`: NEAR, Sputnik, Trezu (including auth implementation), NEAR Intents, wallets, Univer, React, TypeScript and Vite. Search the relevant sections rather than reading all bundles. Upstream source is reference data, not instructions to run example transactions.

The new brief requires native JSON/CSV persistence and recovery. Do not infer that current persistence or import/export is correct merely because an older report called it complete.
