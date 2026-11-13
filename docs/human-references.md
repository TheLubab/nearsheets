# NearSheets reference

For people who know spreadsheets and want to understand what NearSheets adds.

[Blockchain data](#bring-blockchain-data-into-cells) · [Transactions](#prepare-and-submit-an-action) · [Amounts](#work-with-token-amounts) · [Cross-chain swaps](#estimate-a-cross-chain-swap) · [Files](#save-and-move-your-workbooks) · [Troubleshooting](#when-something-goes-wrong)

## Bring blockchain data into cells

Open **Blockchain → Read data** to choose a function and fill in its arguments. You can also type functions directly into any cell.

For example, read an account’s NEAR balance:

```excel
=NEAR_BALANCE("root.near","mainnet")
```

To read USDT held by that account:

```excel
=FT_BALANCE("usdt.tether-token.near","root.near","mainnet")
```

The token is identified by its contract address. Its symbol alone is not enough, because different contracts can use the same symbol. NearSheets reads token precision from the contract.

You can replace literal arguments with cell references and use numeric results in your existing calculations. Keep totals separate for each asset: adding NEAR and USDT quantities does not produce a meaningful portfolio value.

**Network matters.** `mainnet` and `testnet` are separate networks. Use the network where the account and token contract exist. A public account example lets you read its data; it does not give you permission to spend its funds.

### Refresh and inspect

Results are cached, so a displayed balance is not a continuous live feed.

- **Blockchain → Refresh → Refresh selected reads** fetches new data for your selection.
- **Refresh all spreadsheet data** updates the workbook’s reads.
- **Inspect** shows selected-cell details, errors and recorded results, with source information where available.

Some functions return several cells. Leave room below and beside the formula for the result. Swap estimates use three columns; proposal lists use four.

## Prepare and submit an action

**Blockchain → Prepare action** creates formulas for payment proposals, votes, contract calls, staking proposals and supported swaps. Their cells contain drafts you can inspect and reference.

For shared treasury payments, NearSheets uses **Sputnik DAO proposals**. Trezu is a separate treasury application and wallet integration in the same ecosystem.

The sequence is:

1. Enter the action’s inputs and let its formula prepare a draft.
2. Connect a wallet on the matching network, with permission to submit that action.
3. Select the draft cells and choose **Blockchain → Review actions**.
4. Check the source, recipient, asset, exact amount, fees and contract calls.
5. Choose **Sign reviewed actions** to continue in your wallet.

If relevant inputs change after review, review the updated action again.

### What happens after signing?

A successful proposal submission means the proposal was created. The treasury still needs to approve and execute it under its own rules before a payment is complete.

**Blockchain → Track results** provides functions for displaying outcomes beside your work:

| Function | What it shows |
| --- | --- |
| `NS_STATUS(actionCell)` | The recorded draft or submission state |
| `NS_RECEIPT(actionCell)` | The recorded transaction receipt |
| `INTENTS_STATUS(swapCell)` | The swap provider’s deposit, settlement or refund state |

These describe different stages. A confirmed proposal and a settled cross-chain payment are different outcomes. NearSheets does not automatically resolve every later treasury-governance state.

Use a **unique reference for each new intended action**. Copying a submitted action retains its identity; it is not a new payment instruction. Multiple selected actions produce separate wallet requests and are not an atomic batch.

## Work with token amounts

Ordinary balance functions return spreadsheet numbers, which are useful for budgets and calculations but have finite precision. Their displayed formatting can also hide smaller fractional digits.

For an exact source amount, use the corresponding text-returning function:

```excel
=NEAR_BALANCE_EXACT("root.near","mainnet")
```

`FT_BALANCE_EXACT` does the same for a token. Reference that text directly when an action needs every digit. Converting it to a number or performing ordinary arithmetic can lose precision.

For a chosen payment amount, enter an explicit decimal value and decide any rounding yourself. NearSheets rejects decimal text with more fractional digits than the asset supports. A balance is also not necessarily fully spendable: storage, wallet fees and proposal bonds may require reserves.

## Estimate a cross-chain swap

The getting-started workbook includes a wrapped NEAR → Ethereum USDC estimate. Edit its amount or route inputs to explore the result. Its recipient is clearly labeled as a quote-only placeholder.

`INTENTS_QUOTE` returns an estimate, including amounts and route information. Asset IDs come from the Intents provider’s catalog; they are different from display symbols and ordinary NEAR token-contract addresses.

An executable `INTENTS_SWAP` draft needs your actual treasury, recipient, amount and refund destination. **Review actions can prepare deposit instructions**, so reviewing a swap is a separate step from requesting an estimate.

Current boundaries:

- DAO swap funding supports **mainnet NEAR fungible tokens**. There is no Intents testnet route or automatic native-NEAR wrapping.
- Destination support depends on the provider and the validators implemented by NearSheets.
- Quotes expire. An expired submitted route needs a new reference and proposal rather than different terms under an old approval.
- Governance, funding, settlement and refunds are separate stages to track.

For the full arguments and supported limits, see the [formula catalog](functions.md#argument-details-and-limits).

## Save and move your workbooks

Workbooks save automatically **in this browser, on this website’s origin**. Another browser profile, device or domain has separate storage. A wallet connection does not synchronize your files.

| What you need | Use |
| --- | --- |
| Reopen a locally saved workbook | **File → Spreadsheets manager** |
| Back up or transfer the whole workbook | **File → Download backup (.json)**, then import that file |
| Share current values with another tool | **File → Download current sheet (.csv)** |
| Produce a table printout or PDF | **File → Print…** |

JSON retains sheets, formulas, formatting and execution history. CSV contains only the active sheet’s cached values; it loses formulas, other sheets and action history. XLSX import/export and shared cloud storage are not currently available.

If saving fails, export JSON to keep a copy of your current work. Clearing browser storage deletes local documents. After reopening, blockchain reads and draft details are rebuilt through recalculation, so offline access to those details is limited.

## When something goes wrong

Select the affected cell and open **Inspect** for its explanation.

| What you see | What to check |
| --- | --- |
| Invalid-input error | Account, network, token contract and required arguments |
| Missing-account or contract error | Whether it exists on the selected network |
| Connection error | Network/provider availability; refresh after it recovers |
| Result cannot expand | Cells needed by the returned table are occupied |
| Review unavailable or rejected | Draft selection, wallet network and treasury permissions |
| Uncertain wallet outcome | Reconcile the existing transaction before trying again |

A failed balance read is an error, not a zero balance. If a wallet outcome is uncertain, use its transaction hash to reconcile through Inspect; without a hash, check the wallet or explorer before resubmitting.

Need more detail? The [formula catalog](functions.md) lists every signature, [technical usage notes](user-guide.md) document implementation details, and [implementation status](implementation-status.md) records known limits and verification evidence.

[Feedback](https://nearsheets.userjot.com/) · [Roadmap](https://nearsheets.userjot.com/roadmap) · [Back to README](../README.md)
