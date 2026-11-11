# NearSheets formula catalog

Checked against `TABLE_FUNCTIONS` in `src/features/table/runtime.ts` on 2026-11-11. These are application functions, not built-in Univer or upstream NEAR APIs. All listed arguments are required. Network arguments accept `mainnet` or `testnet`; Intents swaps currently require `mainnet`. Choose a Blockchain dropdown entry for guided arguments or type the formula directly. The dialog accepts an expression beginning with `=` to insert a cell reference or nested formula instead of a literal.

## Blockchain and action functions

| Signature | Result / behavior |
| --- | --- |
| `SPUTNIK_CALL(reference, dao, contract, method, JSON args, gas units, attached NEAR, network)` | Readable draft label backed by a FunctionCall proposal descriptor. |
| `SPUTNIK_STAKE(reference, dao, staking pool, exact NEAR amount, network)` | Readable draft label backed by a deposit_and_stake proposal for a compatible pool. |
| `INTENTS_SWAP(reference, dao, origin asset, output asset, exact amount, output chain, recipient, refund DAO, slippage bps, network)` | Readable swap draft label; estimation only during calculation. Explicit review allocates deposit instructions. |
| `INTENTS_QUOTE(origin asset ID, output asset ID, exact amount, output chain, recipient, refund address, slippage bps)` | Three-column estimate table with exact decimal text, symbols, base units, slippage and expiry; no deposit allocation. |
| `NEAR_BALANCE(account, network)` | Approximate numeric RPC account amount in NEAR. |
| `FT_BALANCE(token, account, network)` | Approximate numeric fungible-token balance using verified metadata. |
| `NEAR_BALANCE_EXACT(account, network)` | Exact decimal text for the same native account amount. |
| `FT_BALANCE_EXACT(token, account, network)` | Exact decimal text using verified token metadata. |
| `NEAR_VIEW(contract, method, JSON arguments, network)` | Scalar, key/value records or a spilled table; nested values become JSON text. |
| `SPUTNIK_PROPOSALS(dao, network)` | Header and up to 100 proposal rows: ID, Description, Status, Proposer. |
| `SPUTNIK_TRANSFER(reference, dao, recipient, exact amount, asset (near or token contract), network)` | Readable draft label backed by a native/token transfer proposal descriptor. |
| `SPUTNIK_VOTE(reference, dao, proposal id, decision, network)` | Readable draft label backed by a vote descriptor for an InProgress proposal. |
| `INTENTS_STATUS(swap action cell)` | Recorded swap deposit provider status table, or Not submitted when no execution exists. |
| `NS_RECEIPT(action cell)` | Execution receipt table, or Not submitted before execution. |
| `NS_STATUS(action cell)` | Recorded draft/attempt state; confirmed proposals still await governance. |
| `NS_FIELD(draft cell, field name)` | One action field; amount and baseUnits stay exact text. |

## Exact amounts and references

Use numeric balance functions for approximate ordinary spreadsheet calculations. Exact variants return decimal text: their appearance as a decimal does not make them numeric. Reference the exact cell directly as an action amount to retain all digits. For example:

```text
A1: =NEAR_BALANCE_EXACT("dao.sputnikv2.testnet","testnet")
B1: =SPUTNIK_TRANSFER("invoice-1","dao.sputnikv2.testnet","alice.testnet",A1,"near","testnet")
```

These examples prepare data/drafts only; they are not authorization to submit and do not establish that the full balance is spendable. Prefer a deliberately chosen payment amount when storage, fees and proposal bonds must remain available. Converting A1 to a number or doing ordinary arithmetic on it can lose precision. Token precision comes from the contract, not a user override. Exact strings with excess fractional precision fail validation; use an explicit rounding calculation only when that is your intended amount.

`reference` identifies an action together with network and DAO. Copies with the same identity are not new payments; duplicate identities in a selection are rejected, and recorded attempts protect against accidental resubmission. Use a new reference for a new intended operation.

## Argument details and limits

- Transfer `asset` is `near` or the NEAR token contract account. Vote `decision` is `VoteApprove`, `VoteReject` or `VoteRemove`. Token precision is verified in the selected network and must be 0–24 decimals.
- Contract-call `JSON args` is a JSON object. `gas units` is a positive integer string up to 250 Tgas in base gas units; `attached NEAR` is an exact decimal amount. Staking uses `deposit_and_stake` and checks `get_account_staked_balance`; it is not a validator-management interface.
- Intents origin/output assets use IDs from the configured provider catalog. `slippage bps` is an integer from 0 to 5000; 100 bps means 1%. Addresses are checked with supported chain validators. DAO swap refunds must return to the source DAO. The standalone quote accepts provider-catalog assets subject to available validators; DAO swap funding is restricted to mainnet NEAR fungible tokens.
- `NS_FIELD` accepts `amount`, `baseUnits`, `recipient`, `asset`, `source`, `network` or `kind`. It resolves a currently calculated action descriptor.
- `NS_STATUS` describes local recorded execution. Proposal submission is not payment completion. `INTENTS_STATUS` separately queries the provider using the recorded deposit address. Runtime descriptors must be recalculated after reopening; saved draft/read resources are not currently hydrated into a new runtime.
- Quote tables require three free columns. Contract-view and proposal results also need space to spill; native collision behavior must still be checked in the browser. Proposal pagination beyond the first 100 is not implemented.
- Reads use workbook-owned cached queries with a 30-second stale time (quote estimates use five seconds). Refresh clears cached queries, drafts and transient diagnostics and triggers calculation. Inspection timestamps belong to the last successful read. Failed formulas return real spreadsheet errors and expose a cell-specific explanation in the native selection popup and Inspect. Invalid input uses `#VALUE!`, confirmed missing accounts/contracts or unavailable operations use `#N/A`, connection failures use `#CONNECT!`, and other read failures use `#ERROR!`. `IFERROR` can handle these errors. Ordinary dependent formulas use Univer's standard explanation. Live-service availability is not guaranteed by mocked tests.

## Additional local helper functions

These are registered through `src/features/treasury/formulas/custom-functions.ts`; they are pure calculations and do not read the network or sign/submit. They appear in formula help, rather than the Blockchain action dropdowns.

| Signature | Behavior |
| --- | --- |
| `NEAR_AMOUNT(value, decimals)` | Validates a numeric amount using the shared precision rules and returns a number; floating-point noise may be normalized. This does not create an exact decimal type or override verified action precision. |
| `NEAR_ACCOUNT(account)` | Syntactic normalization/check only; does not establish that an account exists. |
| `NS_REFERENCE(prefix, number)` | Returns prefix plus a truncated numeric sequence. |
| `NS_SUM_REF(referencePrefix, referenceRange, amountRange)` | Sums numeric-convertible amounts for matching reference prefixes; it uses ordinary floating-point arithmetic. |
| `NS_MISSING(field, ...)` | Counts blank fields, including ranges. |
| `NS_LEGACY_DRAFT(kind, network, treasury, reference)` | Compatibility helper deriving a historical draft ID. It does not create a current executable operation; use SPUTNIK/INTENTS action functions for new work. |

For UI behavior, balance formats, document interchange and live-service limits, see [README](../README.md). For acceptance evidence, see [implementation status](implementation-status.md).
