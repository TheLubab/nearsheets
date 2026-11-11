# NearSheets

A NEAR table interface: use spreadsheet cells to read blockchain data, calculate, compose operations and track their outcomes.

The spreadsheet is the application. A user can build any workbook, call NEAR and Sputnik functions from cells, combine results with ordinary formulas, prepare transfers or Intents operations, and execute selected actions with a wallet. Statuses and receipts stay attached to the work that produced them.

## What the user should be able to do

- Start with a blank workbook and choose their own sheets, columns and layouts.
- Read balances, assets, contract data and Sputnik proposals into cells or ranges; reference those results in other formulas.
- Compose native/token transfers, DAO proposals and votes, swaps, cross-chain delivery and other supported operations as structured table values.
- Select prepared operations, inspect the exact plan, explicitly sign/submit, and reconcile execution or refunds in the grid.
- Save locally, reopen prior workbooks, and export/import JSON or CSV.

A contributor budget is one useful example, not a mandatory template. Arbitrary sheet names, labels and layouts must work. A treasury sidebar attached to a generic spreadsheet does not deliver the intended product.

## Identity and responsibility

NearSheets is this product. NEAR is the chain. Sputnik contracts enforce DAO custody, permissions and approvals. Trezu is a separate platform whose integrations and auth implementation can inform ours. NEAR Intents is integral to cross-chain workflows.

Formulas calculate, query and prepare. Only explicit execution requests authorize wallet signing or submission. Professional spreadsheet UX and a polished, consistent interface are required.

This document describes product intent. See [decisions](docs/decisions.md) and the [single refactor brief](docs/nearsheets-refactor.md) for requirements; [implementation status](docs/implementation-status.md) distinguishes current code from pending acceptance, and [the formula catalog](docs/functions.md) lists the implemented signatures.
