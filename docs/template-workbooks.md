# Live programmable-money templates

The separate **Getting started with NearSheets** guide assumes spreadsheet familiarity and starts with live NEAR and USDT balances for public mainnet accounts and separate per-asset totals. Its editable accounts default to root.near, social.near and ref-finance.sputnik-dao.near; B4 selects the token contract, defaulting to mainnet USDT. The extra numbered instruction sections are removed. An optional **Try a transaction** sheet remains available. That sheet starts with blank action inputs and testnet selected, and requires an existing Sputnik treasury and proposal permissions. The user enters an exact NEAR amount, reviews B11, explicitly signs through the wallet and checks B12 and the receipt at A25. Calculation never submits; creating a proposal does not establish payment completion. Saved copies are not changed when the guide is updated. The Getting started entry point also starts a five-step general orientation that ends by pointing to the in-sheet guide and the transaction sheet tab, as soon as the controls and table are visible. A separate five-step tour starts on the first Blockchain-tab visit in any workbook. These tours explain controls, not formula exercises or transaction usage; Help can replay them without creating or editing a workbook.

Eight templates open directly on real blockchain reads. Their public inputs are editable starting points, not claims of account ownership or signing permission. There are no separate illustrative Example sheets and no invented balances, quotes or transaction histories. Welcome/gallery UX is preserved, and existing saved copies remain untouched.

| Template | Opening experience | Further workflow |
| --- | --- | --- |
| Portfolio & balances | NEAR, USDT and USDC balances for v2.ref-finance.near, intents.near and ref-finance.sputnik-dao.near on mainnet | Per-asset totals and allocation shares; full precision in Inspect |
| International payouts | Three live dry wNEAR → Ethereum USDC quote scenarios | Quote route configuration, raw quote details, separate executable payout inputs and provider tracking |
| Team payroll | Public treasury balances and coverage of the planned pay run | Hours/rates and linked recipients, exact approved payment amounts, proposal receipts |
| Invoices & expenses | Public treasury balances and funding coverage | Explicit review dates, due bills, exact payment proposals and receipts |
| Community budget | Public treasury balances against category commitments | Category budgets, overruns and exact spending proposals |
| Treasury overview | Public Ref Finance balance and proposal reads | Compatible-pool staking proposals with explicit exact amount and reference |
| Grants & rewards | Live treasury balances against planned releases | Milestone release calculations, exact awards and submission receipts |
| Proposal review | Actual proposal table from the public Ref Finance treasury | Explicit IDs and approve/reject/remove vote drafts |

## Public defaults and provenance

The balances template defaults to native USDT (`usdt.tether-token.near`) and USDC (`17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`), listed in the public 1Click token catalog checked on 2026-11-12. USDT’s address also matches [Tether’s published NEAR contract](https://tether.to/en/supported-protocols/). Token precision remains RPC-verified; the template never supplies a decimals override. Each asset has a separate total. Replacing either contract changes its column label to Token 1/2 rather than retaining the old symbol.

Ref Finance's `ref-finance.sputnik-dao.near` responded to a read-only `get_policy` query on 2026-11-12. The public 1Click `/v0/tokens` catalog on that date included `nep141:wrap.near` (24 decimals) and Ethereum USDC `nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near` (6 decimals). These identifiers seed formulas; balances, precision and estimates are still resolved and validated at runtime. Service availability and route support can change; errors remain visible rather than being replaced with sample data.

Quote route has an explicitly labeled quote-only address placeholder. It is never linked into executable payout inputs. The executable sheet requires a treasury, unique reference, intended recipient and exact amount. Comparison calculations request dry estimates only. Explicit review prepares funding instructions.

## Money and execution

Template inputs use the plain label **Amount** with the asset alongside it. Decimal input remains text internally. Portfolio, funding and treasury sheets show one balance value per asset; Inspect retains full source precision and base units. Planning arithmetic is approximate. Exact approved decimal text must be entered separately; linked recipients and notes never silently turn a numeric planning result into an exact payment. Totals stay grouped by asset. Funding coverage is a planning comparison, not a spendable-balance guarantee; storage, bonds and fees require reserves.

Public read accounts do not confer signing permissions. Action inputs remain blank until configured deliberately. Staking and transfer submission creates proposals requiring treasury approval. Submission receipts and Intents provider state are separate from completed payment. Swaps retain mainnet NEAR FT funding and supported-chain limitations.

## Verification

Forty-six focused template tests use the real Univer engine with mocked RPC and Intents, including initial public-read behavior, guarded blank actions, exact amounts, comparisons, failure propagation, staking, votes and document round trips. No live transactions or browser were used. The live public account check above is a source verification, not an end-to-end production acceptance claim. User inspection remains needed for tab order, readability, keyboard navigation and spill behavior.
