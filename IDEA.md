# Trezu Sheets

A spreadsheet interface for community finances on NEAR, connected to Trezu and Sputnik DAO.

Many people already plan budgets, allocate funds and reconcile payments in spreadsheets. Trezu Sheets lets them act from those tables, connecting their calculations to treasury proposals and confirmed transactions.

## What it could look like

A community prepares its monthly contributor payments:

| Contributor | NEAR account | Amount | Purpose | Status |
|---|---|---:|---|---|
| Sara | sara.near | 30 | Design | Draft |
| Omar | omar.near | 45 | Development | Awaiting approval |
| Lina | lina.near | 20 | Event expenses | Paid |

The table calculates totals, compares them with the available budget and highlights invalid accounts or incomplete rows. Selected rows become treasury proposals. As council members approve and transactions execute, payment statuses and receipts appear alongside the original allocations.

## The core value

Many people think in tables. A table is great way to interact with the world because many problems are data problems and it's easy to think about data in a table.

The spreadsheet is both the planning surface and the place to track what actually happened. Members should not have to copy amounts between a budget sheet, treasury forms and a separate payment tracker.

Sputnik/Trezu retains treasury custody and approval rules. Spreadsheet edits prepare actions; changing a cell does not authorize spending.

## Initial direction

- Read treasury balances and existing proposals into a table.
- Enter recipients, amounts and descriptions; calculate totals.
- Validate selected rows and preview the exact proposed actions.
- Submit through the appropriate wallet and existing treasury approval flow.
- Reconcile proposal and execution outcomes with transaction receipts.

This is a proposed starting workflow. The exact scope, supported assets, formulas, proposal grouping and technical stack remain undecided. Integration capabilities must be checked against the contracts and Trezu documentation before implementation.

## What must make it worthwhile

It needs to make a recurring treasury task substantially easier than Trezu's existing interface. A balance dashboard arranged into cells would be insufficient. The strongest candidate is moving a real allocation table through preparation, approval and reconciliation with less copying and fewer mistakes.

## Hackathon alignment

Social Money is the likely primary track if shared budgets and Sputnik/Trezu integration are central. Open Innovation is an alternative if the finished product becomes a broader NEAR spreadsheet tool.

## Inspiration

[Superteam: Web3 Table Interface](https://superteam.fun/build/ideas/web3-table-interface)

People think in tables; blockchain actions should be usable from tables too.
