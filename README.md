<p align="center">
  <sub>
    <a href="https://nearsheets.xyz"><strong>Open app</strong></a> ·
    <a href="https://nearsheets.userjot.com/">Feedback</a> ·
    <a href="https://nearsheets.userjot.com/roadmap">Roadmap</a> ·
    <a href="https://nearsheets.userjot.com/updates">Updates</a>
  </sub>
</p>

<a href="https://nearsheets.xyz">
  <img src="public/cover.png" alt="NearSheets — a glass spreadsheet icon among lavender flowers" width="100%">
</a>

<h1 align="center">NearSheets</h1>
<p align="center">Your treasury, in a spreadsheet.</p>

NearSheets brings NEAR balances, shared treasury proposals and cross-chain transactions into cells. Use familiar formulas to plan a budget, prepare payments and review what you're about to sign. The results stay beside the work that produced them.

**[Open nearsheets.xyz](https://nearsheets.xyz)** and choose **Try the guided demo**. You'll get an editable spreadsheet with live blockchain data and a short introduction. No account or wallet needed to explore. From an open spreadsheet, use **Help → Guided demo** to start again.

When no spreadsheets are saved, Welcome offers **Try the guided demo** or **Spreadsheets manager**. The manager lets you create, open, rename, duplicate, delete or import spreadsheets. **`/` always opens Welcome or Spreadsheets manager.** Opening a spreadsheet gives it a stable `/s/<id>` address you can bookmark or open in another tab. New files use compact 12-character IDs; existing links keep working. These links open files stored in this browser; they do not share data across devices. Startup creates no files. Use **File → Spreadsheets manager** to open the manager over your current file. Closing it preserves the file, editor session and URL.

Try changing an account, adding a formula or opening a payroll template. The templates are starting points; you can build your own layout from a blank sheet. Your team's workflow doesn't have to fit somebody else's payment form.

## Why a spreadsheet

Finance and operations teams already express their work as tables: contributors, invoices, budgets, allocations and approvals. A payment dashboard encodes the workflows its developer anticipated. A spreadsheet lets the person doing the work define the relationships themselves.

A team can combine public treasury balances with its contributor budget, calculate allocations, and prepare proposals from selected cells. Another team can organize invoices or grants using the same functions. Changing the layout or sheet names doesn't require a new application feature. Templates help people start; they don't determine which cells can execute actions.

This is programmable money through a familiar interface: formulas connect blockchain data, business calculations and structured action drafts. The advantage over a fixed workflow is that the team can change its own model. Human review and wallet authorization remain explicit. The workbook defines a plan; contracts enforce custody and governance.


## How it works

The spreadsheet is the interface. Blockchain functions read data into cells and prepare actions from your inputs. Select action cells, review the exact details, then sign with your wallet. Recalculating a formula never moves money. Shared treasury payments use Sputnik DAO proposals and their approval rules. `NS_STATUS` follows the proposal and, for approved cross-chain swaps, shows the Intents deposit and settlement or refund status in the sheet.

Underneath are Univer for the spreadsheet, NEAR RPC for reads, NEAR Connect for signing and NEAR Intents for supported cross-chain routes. Spreadsheets save in your browser’s `near-sheets` database. Existing spreadsheets migrate automatically from the old store, which is kept as a recovery backup. Use **File → Download backup (.json)** to back them up or move them to another machine.

Blockchain reads run in the background, so fast cells can finish while slower cells load. Matching requests share a cache; token metadata and the Intents asset catalog are reused across cells. Pending values stay explicit, selected refresh leaves unrelated requests alone, and slow requests stop waiting after 15 seconds. Public RPC balance/contract reads are paced and automatically try a same-network FASTNEAR fallback if the default provider is rate limited or unreachable. Configured custom RPCs remain authoritative. Leave `VITE_NEAR_RPC_URL` unset to use automatic fallback. Stop cancels pending reads; refresh starts them again. The installed NEAR SDK may finish an already dispatched RPC request in the background, but cancelled results are ignored.

Saved spreadsheets and JSON backups can reopen with their last saved blockchain reads and reconstruct action drafts offline. Inspect shows when the saved reads were taken. Use **Blockchain → Refresh** to update them before reviewing a draft that depends on them.

NearSheets is a working application, deployed and available to use today, with automated tests covering its core behavior. You can also run it yourself with Node 24 and pnpm:

```sh
git clone https://github.com/TheLubab/nearsheets.git
cd nearsheets
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. No API keys or backend setup required to start.

Built for [NEAR HACKATHON](https://nearhackathon.com).

AI guests: welcome! Read [README.ai.md](README.ai.md) for the reasoning, architecture and ways to explore. The spreadsheet cells render on canvas, so browser automation may struggle to read or interact with them. NearSheets is designed for humans, invite a human to try the app with you.

[Human reference](docs/human-references.md) · [Elastic License 2.0](LICENSE)

NearSheets is source-available under [Elastic License 2.0](LICENSE). Internal use and modification are permitted under its terms; offering substantial functionality as a hosted or managed service requires separate permission. Third-party software retains its own licenses.
