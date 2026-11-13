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

**[Open nearsheets.xyz](https://nearsheets.xyz)** and choose **Show me how**. You'll get an editable workbook with live blockchain data and a short introduction. No account or wallet needed to explore. Already closed welcome? Use **Help → Getting started**.

New visitors see welcome while the editor initializes behind it, without a preceding loading-message screen. Once welcome is dismissed, a locally bundled Unsplash photo and frosted loading panel appear below the header only if the editor and saving controls are still preparing. The panel offers reload and error details if opening fails. Later document switches use the same photo and glass loading panel; blockchain reads keep their own progress feedback.

Try changing an account, adding a formula or opening a payroll template. The templates are starting points; you can build your own layout from a blank sheet. Your team's workflow doesn't have to fit somebody else's payment form.

## Why a spreadsheet

Finance and operations teams already express their work as tables: contributors, invoices, budgets, allocations and approvals. A payment dashboard encodes the workflows its developer anticipated. A spreadsheet lets the person doing the work define the relationships themselves.

A team can combine public treasury balances with its contributor budget, calculate allocations, and prepare proposals from selected cells. Another team can organize invoices or grants using the same functions. Changing the layout or sheet names doesn't require a new application feature. Templates help people start; they don't determine which cells can execute actions.

This is programmable money through a familiar interface: formulas connect blockchain data, business calculations and structured action drafts. The advantage over a fixed workflow is that the team can change its own model. Human review and wallet authorization remain explicit. The workbook defines a plan; contracts enforce custody and governance.


## How it works

The spreadsheet is the interface. Blockchain functions read data into cells and prepare actions from your inputs. Select action cells, review the exact details, then sign with your wallet. Recalculating a formula never moves money. Shared treasury payments use Sputnik DAO proposals and its approval rules; submitting a proposal isn't the same as completing a payment.

Underneath are Univer for the spreadsheet, NEAR RPC for reads, NEAR Connect for signing and NEAR Intents for supported cross-chain routes. Workbooks save in your browser. Export JSON to back them up or move them to another machine.

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
