# NearSheets formula catalog

For explanations and examples organized by task, start with the [human reference](human-references.md). This catalog lists complete signatures and technical limits.

The getting-started guide reads NEAR with `NEAR_BALANCE` and mainnet USDT with `FT_BALANCE`, keeping per-asset totals separate. Its optional transaction sheet uses `SPUTNIK_TRANSFER`, `NS_STATUS` and `NS_RECEIPT` to prepare a proposal and display the recorded outcome after explicit wallet execution.

The payroll, invoice, community budget and grants templates use `SPUTNIK_TRANSFER` and `NS_STATUS`. Treasury overview uses balance/proposal reads and an optional `SPUTNIK_STAKE` sheet; Proposal review adds `SPUTNIK_VOTE`. International payouts compares three `INTENTS_QUOTE` scenarios, prepares `INTENTS_SWAP`, and separates `NS_RECEIPT` from `INTENTS_STATUS`. Payment workbooks include receipt sheets. Gallery templates open on live public reads; action inputs and quote-only address configuration are separate. Template labels describe familiar workflows; these functions retain the exact signatures and approval requirements below.

Checked against `TABLE_FUNCTIONS` in `src/features/table/runtime.ts` on 2026-11-11. These are application functions, not built-in Univer or upstream NEAR APIs. All listed arguments are required. Network arguments accept `mainnet` or `testnet`; Intents swaps currently require `mainnet`. Choose a Blockchain dropdown entry for guided arguments or type the formula directly. The dialog accepts an expression beginning with `=` to insert a cell reference or nested formula instead of a literal.

## Read scheduling and freshness

Blockchain reads run in the background: independent cells can finish while others are loading. Pending cells show `#GETTING_DATA`, which propagates through arithmetic rather than becoming zero (an explicit `IFERROR` may handle it). Results trigger batched recalculation of their cells and dependents, rather than the whole workbook. Identical reads share in-flight requests. Balances and contract reads cache for 30 seconds, verified FT metadata and the shared Intents token catalog for five minutes, and quotes/status for five seconds. Selected refresh invalidates the selected dependency keys and all cells sharing those keys; unrelated pending reads continue. Each request has a 15-second wait limit, without automatic query retries; RPC reads use one SDK attempt per endpoint. Edits cancel unused reads, and Stop leaves an explicit stopped state until refresh. Intents fetches support transport abort; the installed NEAR SDK does not expose a fetch signal, so an already dispatched RPC request may finish in the background after cancellation or timeout, with its result ignored. These are freshness windows, not background polling intervals.

Public balance and contract reads are paced per endpoint (at most three active calls, starts at least 250ms apart). On a transient transport failure, HTTP rate limit or timeout, the default public RPC falls back once to FASTNEAR on the same network (`https://free.rpc.fastnear.com` / `https://test.rpc.fastnear.com`). Failed endpoints cool down for 30 seconds. Each SDK attempt is limited to six seconds within the existing 15-second query wait budget, including queue time. There are no unbounded retries; large queues can reach that budget. Cancellation and contract/account errors do not trigger fallback. A configured custom RPC remains authoritative for its configured network and does not leak its reads to a public fallback. Wallet submission and transaction reconciliation are unchanged. The fallback URLs are listed in the [official NEAR RPC provider documentation](https://docs.near.org/api/rpc/providers), checked 2026-11-13; browser CORS/reachability was not probed.

On reopen, blockchain formulas with matching saved request keys use the saved results until refreshed. The original read time and exact base units are available in Inspect, where those reads are labeled saved and stale. A changed input without a matching saved read follows the normal network path. Select the source cells and use **Blockchain → Refresh → Refresh selected reads** to fetch fresh results. If refresh fails, the cell reports the error and Inspect retains the last successful evidence.

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
| `NS_STATUS(action cell)` | Draft or wallet attempt state, then the tracked Sputnik proposal and its Intents stage when applicable. |
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
- `NS_STATUS` follows the proposal ID from the wallet receipt and shows the DAO's recorded status. For an approved swap it also shows the Intents deposit, settlement or refund stage. A DAO's Approved status alone does not establish transfer completion. Use **Blockchain → Refresh** to check for changes. For older receipts or wallet responses that omit the proposal ID, use **Check transaction** in Inspect when a hash is available. `INTENTS_STATUS` provides detailed provider status using the original deposit address. Saved snapshots label historical statuses as saved. Drafts are rebuilt from current formulas and available saved reads. Refresh those reads before review. Wallet review and submission still verify current policy, proposal state and token precision as applicable.
- Quote tables require three free columns. Contract-view and proposal results also need space to spill; native collision behavior must still be checked in the browser. Proposal pagination beyond the first 100 is not implemented.
- Reads use workbook-owned cached queries with a 30-second stale time (quote estimates use five seconds). Refresh clears cached queries, drafts and transient diagnostics and triggers calculation. Inspection timestamps belong to the last successful read. Failed formulas return real spreadsheet errors and expose a cell-specific explanation in the native selection popup and Inspect. Invalid input uses `#VALUE!`, confirmed missing accounts/contracts or unavailable operations use `#N/A`, connection failures use `#CONNECT!`, and other read failures use `#ERROR!`. `IFERROR` can handle these errors. Referenced blockchain errors can expose the originating failure and source cell through the popup and Inspect; untraced errors retain Univer’s standard explanation. Live-service availability is not guaranteed by mocked tests.

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

For UI behavior, balance formats, document interchange and live-service limits, see the [usage reference](user-guide.md). For acceptance evidence, see [implementation status](implementation-status.md).

Intents dry estimates may omit a provider deadline. In that case the quote table labels the sent request deadline as **Estimate cutoff (requested)**; it is not a guaranteed provider route expiry. Explicit funding preparation still requires a provider-returned deadline.
