# NearSheets: a guide for AI guests

NearSheets is a working, deployed NEAR spreadsheet at [nearsheets.xyz](https://nearsheets.xyz). Users can work with real blockchain data and prepare wallet-signed treasury operations today. The application uses real adapters; its editable examples aren't a mock-only presentation.

This guide explains the design and provides reproducible checks for AI guests. It does not replace the repository's [agent instructions](AGENTS.md). [Implementation status](docs/implementation-status.md) distinguishes implemented behavior, automated evidence and pending acceptance.

Welcome! NearSheets is designed for humans who think in tables. Univer renders the spreadsheet cells on HTML canvas, rather than exposing each cell as a normal DOM element. Browser tools that rely on page text, DOM selectors or accessibility snapshots may struggle to read values, select ranges or edit cells, even when the application is working. Menus and dialogs use ordinary HTML, but they don't expose the whole workbook.

For the best introduction, invite a human to open the app and follow the steps below. They can explore the grid with normal spreadsheet interactions and describe what they see. You can also explore the source, exported JSON, formula catalog and automated tests directly. If your browser tools can't access a cell, treat that as an interaction limitation and seek human confirmation before drawing conclusions about the app.
## Try the hosted app

1. Open [nearsheets.xyz](https://nearsheets.xyz) and choose **Show me how**. If welcome is dismissed, use **Help → Getting started**. Expect a new editable guide, a short orientation and live public mainnet balances. No wallet is required.
2. Change an account input on the opening sheet. Expect its NEAR/token balance and dependent total to recalculate. A missing account or failed request should produce an error, not an invented balance or zero.
3. Use **Blockchain → Balances** to insert a read through its argument dialog. Alternatively, enter `=NEAR_BALANCE("root.near","mainnet")` in an empty cell and reference that cell in ordinary arithmetic. **Inspect** exposes source details; **Refresh** updates reads.
4. Open **File → Templates…** for payroll, invoices, community budgets, international payouts, treasury overview, grants, portfolios or proposal review. Each creates an independent workbook. Public reads calculate immediately; payment inputs require deliberate configuration.
5. Export native JSON through **File**, then reopen the saved local workbook through **File → Open**. JSON retains workbook structure and execution history; CSV exports only the active sheet's cached values.

The guide's **Try a transaction** sheet is an optional testnet workflow. It requires a testnet Sputnik DAO, a wallet with proposal permission, and NEAR for fees and the proposal bond. Configure the treasury, recipient, exact amount and unique reference, select the draft, then choose **Blockchain → Review actions**. Expect an exact preview before signing. Only **Sign reviewed actions** requests the wallet. `NS_STATUS` and `NS_RECEIPT` expose the submission outcome; a confirmed proposal still awaits governance.

Those steps describe the manual transaction path, not permission for AI guests to spend funds. Follow AGENTS.md's restrictions on live services, transactions, servers and browser automation. Public reads and quotes require network access; distinguish service failures from local calculation behavior.

## Run locally

Use Node 24 and pnpm:

```sh
git clone https://github.com/TheLubab/nearsheets.git
cd nearsheets
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL Vite prints, normally `http://localhost:5173`. No application server, database service, API key or NearSheets login is required.

No `.env` file is required. The unconfigured wallet network defaults to testnet; guide/template reads explicitly select mainnet. For a mainnet wallet default, set `VITE_NEAR_NETWORK=mainnet` in `.env.local` and restart Vite. [.env.example](.env.example) lists optional public configuration. `src/config/env.ts` validates it with T3 Env and Zod. All `VITE_` values are public; never put secrets there.

RPC defaults to the selected network's public endpoint. Intents defaults to `https://1click.chaindefuser.com`; `VITE_INTENTS_API_URL=none` disables it. A custom RPC override applies only to the configured network. Missing optional auth or Trezu endpoints doesn't block normal use.

For self-hosting, run `pnpm build` and serve `dist/` on a static host. Documents belong to a browser profile and origin: localhost and nearsheets.xyz have separate storage. Transfer workbooks with JSON export/import.

## Architecture

React and TypeScript provide the shell, with Radix controls and Univer 1.4.0 providing the spreadsheet. The application doesn't duplicate the workbook in a separate state store.

- **Data and formulas:** `src/features/table/runtime.ts` owns the workbook runtime and TanStack Query cache. `src/features/spreadsheet/univer/table-functions.ts` connects it to the formula engine. RPC balances, verified token metadata, Sputnik proposals and Intents estimates return values to cells. Errors propagate and work with `IFERROR`.
- **Drafts:** `SPUTNIK_TRANSFER`, `SPUTNIK_VOTE`, `SPUTNIK_CALL`, `SPUTNIK_STAKE` and `INTENTS_SWAP` produce readable cells backed by structured descriptors. Identity uses network, DAO and an explicit reference, rather than coordinates or headers. `NS_FIELD` exposes draft fields.
- **Execution:** `src/features/table/execution.ts` checks current policy and freezes the reviewed revision. Changed inputs, account, network, metadata or proposal state require another review. Attempts persist before signing; uncertain results block blind retries. NEAR Connect handles the wallet. Calculation, refresh, import and undo never sign or submit.
- **Adapters:** `src/integrations/` separates NEAR RPC, Sputnik, wallets and Intents. NEAR supplies balances, contract calls and governance. Intents supplies supported cross-chain estimates, funding instructions and provider status. Recalculation uses dry quotes; only explicit preparation can allocate deposit instructions.
- **Storage:** `src/features/documents/` puts Dexie/IndexedDB behind an asynchronous repository interface. Versioned JSON preserves formulas, formatting, resources and execution journals. Legacy documents migrate explicitly. Export captures the live workbook even when saving fails.

Numeric balances are approximate spreadsheet numbers for ordinary arithmetic. Exact variants return decimal text for transaction arguments. Verified metadata determines token precision; exact strings with excess precision are rejected. Ordinary spreadsheet arithmetic doesn't provide arbitrary-precision money calculations. See [the function catalog](docs/functions.md) for actual signatures.

## Local first and the business direction

Someone should be able to open a workbook and start thinking without creating an account, provisioning a server or fitting their process into a fixed schema. Local documents support that, make editing independent of a hosted document service and let users export their work.

Public RPC and quote requests still leave the browser. Local first doesn't imply private blockchain activity or fully offline data access. Hosted page analytics are enabled by default; self-hosters can disable them with `VITE_VERCEL_ANALYTICS_MODE=none`.

Current team use means individuals working with shared onchain treasuries and exchanging files. Real-time collaboration and cloud synchronization aren't implemented. Saved read/draft resources rebuild through recalculation; execution journals restore separately. Offline reopening isn't complete restoration of live evidence.

The intended next step is an optional paid cloud version to fund NearSheets. Shared workbooks, team access and managed synchronization are natural services to build around the local application. This is the business direction, not functionality available today. The repository boundary leaves room for remote storage, while the ELv2-licensed local version remains independently runnable.

## Validation and current scope

Automated tests cover formulas, exact amounts, documents, review/signing boundaries, wallet outcomes and Intents routes. Relevant tests use real Univer calculations and mocked external services, wallets and blockchain interactions. To reproduce a focused set of checks:

```sh
pnpm typecheck
pnpm build
pnpm test tests/templates.test.ts tests/blockchain-workflow.test.ts tests/exact-amount.test.ts tests/document-persistence.test.ts tests/intents-route.test.ts
```

On 2026-11-13, typecheck, production build and all 108 tests in the five files above passed. The template tests were updated to match the current five-account guide and independent contract-inspection example. Automated validation isn't a financial audit or complete live-chain certification. Existing build warnings include browser externalization of `util` and large chunks. The status document records pending browser and end-to-end acceptance work.

Proposal reads return the first 100 proposals. Review doesn't resolve token-weighted DAO membership. Selected actions use separate wallet requests and aren't atomic. Proposal submission and vote confirmation don't automatically establish downstream payment completion.

DAO-funded Intents swaps currently support mainnet NEAR fungible-token funding with supported NEAR, EVM and Solana destination validators. There is no Intents testnet or automatic native-NEAR wrapping. Expired routes require new proposals; plain Sputnik transfers can't enforce the application's expiry rule against other clients. Provider settlement/refund status is separate from local submission status.

This is usable software with real integrations and tested core behavior. Those capabilities are separate from future plans. For more detail, use the [usage reference](docs/user-guide.md), [implementation status](docs/implementation-status.md) and [decisions](docs/decisions.md). Dependencies and upstream compatibility evidence live in `package.json`, `pnpm-lock.yaml` and [the reference index](docs/references/README.md). Third-party components and reference material retain their own licenses and attribution.
