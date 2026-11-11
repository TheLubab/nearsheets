# Pinned implementation references

Reviewed 2026-11-11. These bundles preserve upstream material at their recorded retrieval dates and revisions. They are historical technical sources, not claims about the latest upstream release or current NearSheets behavior. Embedded scripts and relative upstream links are reference data, not project instructions. Updating project documentation does not rewrite or silently refresh these snapshots.

Use [implementation status](../implementation-status.md), [the formula catalog](../functions.md), [decisions](../decisions.md) and the installed package types for current application behavior. Check compatibility before using snapshot examples; do not install or run upstream setup scripts automatically.

| Bundle | Purpose |
| --- | --- |
| [Univer](univer.md) | Sheet/formula lifecycle and facade references; installed NearSheets engine metadata is 1.4.0 |
| [Wallets](wallets.md) | Connector reference and appended NearSheets compatibility audit; the project pins fork revision `f2fc9706262b70bd4cc0901e20cc3757c882fb5c` |
| [NEAR](near.md) | RPC, accounts and transaction reference |
| [Sputnik](sputnik.md) | DAO policy, proposals and governance reference |
| [NEAR Intents](near-intents.md) | Provider quote/deposit/status concepts; application support is narrower than the snapshot |
| [Trezu](trezu.md) | Actual Trezu integration/auth implementation, preserved upstream names and provenance |
| [React](react.md) | UI/lifecycle reference |
| [TypeScript](typescript.md) | Language and typing reference |
| [Vite](vite.md) | Build/frontend tooling reference |

## Installed Univer APIs used by current changes

The balance-format implementation uses the installed `@univerjs/sheets-numfmt/facade` number-format getters, `SetNumfmtCommand` notifications for manual choices, and the sheets package's `SetNumfmtMutation` / `transformCellsToRange` for defaults without extra undo steps. `IResourceManagerService.registerPluginResource` retains automatic/manual ownership in native JSON. Conditional formats display dust explicitly; integer balances use an integer pattern because the optional-decimal pattern otherwise renders a trailing decimal point in the installed formatter.

Inspection uses `getRawValue()` for underlying values. The facade's `getValue()` may reflect formatting interception and should not be used to establish that numeric data was rounded or changed. Table functions now return native value objects, including `StringValueObject` for exact decimal text, avoiding the facade's numeric-string conversion. Balance-format and cell-error tests cover this boundary; they do not establish arbitrary-precision spreadsheet arithmetic.

The installed formula engine supports async `BaseFunction` implementations returning `AsyncObject`, with cell position provided by `setRefInfo` before calculation. Its generic formula-alert controller translates error codes to fixed locale strings rather than using `ErrorValueObject.getErrorContent()`. The cell-error adapter observes `CellAlertManagerService.currentAlert$` (exported through the sheets-core preset) and enriches the existing `SHEET_FORMULA_ALERT:<unitId>` alert at the matching cell. Native selection/editing continues to own dismissal; circular-reference actions and other plugin alerts are preserved. Recheck this pinned alert key and service behavior when upgrading Univer.
