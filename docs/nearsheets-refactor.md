# One milestone: rebuild the product as NearSheets

## Read this first

The user has rejected the direction of the existing implementation. This is a comprehensive product, architecture and UI refactor, not a polish pass on the existing payment template. Deliver one coherent NEAR table interface. Internal work sequencing is fine, but there are no separate milestone deliverables and no permission to stop after completing a shell, a utility layer or a mock demo.

This brief supersedes the deleted implementation roadmap and the completion claims in earlier commits. Preserve good code where it serves the product; replace or remove it where it does not. Read current git status before touching files: another agent may have uncommitted changes. Coordinate around those changes rather than resetting them.

**The success test:** starting from an empty workbook, a user puts NEAR data and Sputnik proposals into arbitrary cells, combines them with ordinary formulas, constructs blockchain actions from those values, executes selected actions deliberately, and sees their outcomes in the same workbook. No prescribed sheet name, header row or external treasury form is needed.

## Product identity and scope

- Product name: **NearSheets**. Use `nearsheets` for application/package identifiers. Update visible branding, page title, package metadata, development descriptions, internal namespaces, new document names and export names consistently.
- Sputnik names identify DAO contracts, policy, proposal and vote primitives. Move direct Sputnik adapters out of the Trezu namespace. Trezu names remain only for actual Trezu integrations and upstream references.
- Remove the general `TREZU_*` function namespace. Use domain names appropriate to each primitive, such as `NEAR_*`, `FT_*`, `SPUTNIK_*`, and `INTENTS_*`. Shared helpers should not borrow another platform's identity.
- Renaming must include persisted formats, old formula strings and lookup metadata through explicit migration/compatibility handling. Do not globally replace arbitrary user text, destroy saved workbooks or re-execute historical actions. Keep legacy aliases only where needed for migration, not as the new public catalog.
- NEAR native assets, fungible tokens, Sputnik governance, NEAR Intents cross-chain payments/swaps, staking and supported contract operations belong in the model. Implement genuine supported routes; do not label all tokens as Intents or claim every chain works.

## The table is the interface

Users may rename sheets, move headers, organize unrelated tables, reference other worksheets and work from a blank document. Templates may demonstrate capabilities but cannot be required to activate them.

Read operations return scalar values, records or tables that other formulas can consume. For multi-row results, implement a clear spill/range binding model, including collision behavior, refresh and reference stability. Display balances, tokens, proposals, votes and receipts in the grid rather than a parallel dashboard. Users must be able to use those values in `SUM`, filtering and other normal calculations where the types permit it.

Action functions return meaningful typed drafts with arguments and validation information. A hash or string ID alone is insufficient. An ID can internally resolve a persisted descriptor, but users must see and inspect the actual operation. Bind actions to stable identities and revisions, not sheet coordinates or English header names. Sorting, copying, moving and deleting a cell must have defined behavior; copying a submitted action must not quietly authorize another payment.

Expose discovery and execution through integrated formula autocomplete/help, argument hints, contextual cell/range menus and a concise selection toolbar. An optional argument editor inserts/edits the underlying expression. A contextual preview dialog is appropriate for deliberate execution; permanent forms and payment lists outside the sheet are not the primary workflow.

An illustrative public catalog could include the following. These are proposed NearSheets functions, not claims that Univer or upstream SDKs provide them. Verify names/signatures against formula-parser capabilities and implement a consistent catalog rather than copying the examples mechanically.

| Example capability | Expected table behavior |
| --- | --- |
| `NEAR_BALANCE(account, network)` | A balance usable in calculations, with exact source units and freshness metadata retained |
| `FT_BALANCE(token, account, network)` | Verified token identity/precision and balance, without manually typing decimals |
| `NEAR_VIEW(contract, method, args, network)` | Read-only contract result with predictable scalar/record/table handling |
| `SPUTNIK_PROPOSALS(dao, network)` | Proposal records usable in a range, including stable proposal IDs and statuses |
| `SPUTNIK_TRANSFER(dao, recipient, amount, asset, network)` | A structured proposal draft, not a transaction or identifier-only cell |
| `SPUTNIK_VOTE(dao, proposalId, decision, network)` | A contextual vote draft subject to current policy and account permissions |
| `INTENTS_QUOTE(originAsset, outputAsset, amount, destinationChain)` | A quote/estimate with expiry, fees and slippage visibly represented; never a funding instruction executed by recalculation |
| `INTENTS_SWAP(...)` / cross-chain delivery | An inspectable draft with source ownership, destination, refund and route requirements |

Define how rich values participate in normal spreadsheet formulas and how users select fields. Unknown/error/loading values must not silently become zero. Refreshes should be deduplicated, cached, cancellable or supersedable, and explicit about stale data. The formula engine and UI must use the same integration/data layer; do not build an unused asynchronous lookup module and call the feature complete.

For quote services, distinguish safe estimation from APIs that allocate deposit instructions or create state. Ordinary recalculation must not repeatedly create orders or funding targets. Reserve stateful preparation for an explicit operation.

## Actions, governance and NEAR Intents

Calculation and reads do not sign, submit, transfer or vote. Users select one or more actionable cells/ranges and invoke execution. The exact preview must show source account/DAO, network, asset, exact quantity, recipient, fees/deposit/gas, and the actual proposed calls. Use current policy and compatible deployed contracts; a connected wallet is not sufficient authorization.

Freeze the reviewed action revision. If inputs, asset metadata, network, proposal state or quote parameters change, mark that preview stale and require review again. Persist submission attempts and outcomes so an uncertain wallet/RPC response cannot trigger a blind automatic retry. Reconcile known transactions before offering resubmission. One proposal per payment action is the initial grouping choice, not a promise that multi-step actions are atomic.

Native transfers, NEAR token transfers, staking, contract calls and Intents routes must be different operations with appropriate parameters. A token transfer on NEAR must not become an Intents swap merely because the asset is not `near`.

For cross-chain operations, represent source chain/account/custody, input asset, output chain/asset, destination address and optional memo/tag, exact input/output limits, slippage, fee assets, quote/deposit expiry, route/provider IDs, refund destination and stage-specific receipts. Validate addresses for their destination chain. Do not lowercase a Solana address or validate every destination as a NEAR account.

Separate DAO proposal creation, voting, execution, deposit confirmation, destination settlement and refund. Show each meaningful state alongside the originating operation in the table. Governance approval is not payment completion. Include rejection, cancellation, expiry, failure, partial completion and indeterminate outcomes where the route supports them.

Investigate Trezu's swap/proposal implementation and the selected Intents API before deciding how an approved action obtains or refreshes a quote. Approval may take longer than a quote lasts. Do not substitute a new recipient, route or amount under an old approval; do not bypass the DAO. If no compatible design meets the requirement, present the concrete constraint and alternatives to the user. This is a required design question, not a reason to hide Intents behind placeholders.

Use runtime capability information for supported assets/chains/actions. Unsupported operations must have an accurate explanation rather than fake quotes or success. Mock external services in tests; real adapters still need to exist for configured environments.

## Auth: learn from Trezu's implementation

Read the **Authentication implementation supplement** in `docs/references/trezu.md`. It embeds actual source at commit `62cf0e41d4b2d2358a496d47c80fcd2e59094247`, including:

- `nt-fe/stores/near-store.ts`: connector creation, authorization, state restoration and logout.
- `nt-fe/components/connect-wallet-selector.tsx`, `sign-in.tsx`, `auth-provider.tsx`: wallet choice and connection/session UX.
- `nt-fe/lib/auth-api.ts`: challenge, login, session and logout requests.
- `nt-be/src/auth/handlers.rs`, `resolve_auth.rs`, `jwt.rs`, `middleware.rs`: challenge consumption, verification and sessions.

At this revision, Trezu requests a server challenge, calls `wallet.resolveAuth` with NEP-641 ownership authorization, verifies it server-side (including the NEP-413 fallback path), consumes the challenge, and issues a revocable cookie session. The old README's NEP-413-only description is not the complete flow. Check the installed connector and the backend actually being used; development-branch source is not a guarantee of deployed compatibility.

Use NEAR Connect for the wallet UX. If an authenticated service is introduced, adapt the same coherent connection/auth/session UX. Keep wallet connection, authenticated service session, selected DAO and signing permissions distinct internally, with a compact understandable account control in the UI. Handle wallet cancellation, restoration, account/network changes and logout; handle service-session expiry/restoration only when a relevant authenticated integration is enabled. Retain local editing without authentication.

User clarification: ship browser-first without a separate NearSheets login/server for the current local-document, RPC, wallet and public Intents workflows. Keep service authentication optional and dormant until a specific integration needs it; do not expose unavailable-service login controls. NearSheets needs its own identity and an authorized backend only for authenticated services. Do not copy the literal `Trezu App` authorization recipient, reuse Trezu cookies as our session, or create a fake authenticated flag from local storage. Do not assume Trezu's production service accepts arbitrary application origins. If a backend is needed and its deployment/service choice is unresolved, raise that specific choice with the user rather than inventing a frontend workaround. Keep document storage local as agreed; an auth backend does not imply remote workbook storage.

Optional email/Google, passkey or other wallet integrations can be wired through verified connector/provider capabilities when complete configuration is available. Do not assume the default connector provides them. Use T3 Env/Zod for public and, where necessary, separate server configuration. Missing optional setup must not block the default wallet path. The user canceled a manual setup guide, not these capabilities.

## Premium UI using an established component system

Use an established accessible component system for application chrome; shadcn/ui is the preferred starting point. Read its official [docs](https://ui.shadcn.com/docs), [components](https://ui.shadcn.com/docs/components) and [theming](https://ui.shadcn.com/docs/theming), and adopt compatible patterns/components rather than hand-designing substitutes. It supplies adaptable components, not a finished spreadsheet product; NearSheets still needs deliberate layout and integration with Univer.

- Give the workbook most of the viewport. Use a compact document/account bar, coherent command menus, formula bar and sheet tabs. Remove stacked developer-status banners and always-open treasury panels.
- Use consistent typography, spacing, surfaces, borders, icons, focus states and interaction density. Align Univer's theme with the surrounding controls. Avoid oversized cards and decorative marketing sections.
- Use accessible menus, dialogs, tooltips, comboboxes and contextual command patterns from the chosen system. Do not replace Univer with shadcn's ordinary data table.
- Give blockchain cells concise readable states and inspectable details: loading, stale, validation issue, draft, awaiting approval, submitted, settled/refunded. Do not display raw JSON, hashes or implementation labels as the default cell experience.
- Support keyboard navigation, formula entry, multi-cell selection, clipboard, undo/redo, focus restoration after dialogs and actionable error recovery. Global shortcuts must not steal text or spreadsheet editing commands.
- Include a real document picker with useful empty/loading/error states. Saving and recoverability must be visible without dominating the canvas.
- Make narrow layouts usable without obscuring the sheet or trapping controls offscreen. A temporary contextual inspector is acceptable; a second treasury application alongside the grid is not.

Do not claim visual quality based solely on a passing build. Follow AGENTS.md's browser/server restrictions and request specific user visual checks when required. The refactor's report must clearly separate implemented behavior from unverified visual behavior.

## Correctness and recovery fixes that belong in this refactor

| Existing problem | Required correction |
| --- | --- |
| Draft extraction depends on `Payments`, English headers and the first ten rows | Bind operations to expressions/typed cells/ranges with stable metadata, independent of template layout |
| `TREZU_DRAFT` only hashes identity | Introduce real operation descriptors and field inspection; ensure formula and execution paths share a single source of semantics |
| Balances/proposals/asset lookup are outside or disconnected from formulas | Wire authoritative data through functions and table bindings with dependency recalculation |
| All non-native assets route to Intents and all recipients use NEAR validation | Separate operations, verified asset identities and chain-specific destinations |
| Amount noise tolerance accepts `"1000000000.49"` at zero decimals as `"1000000000"` with `rounded: false` | Reject exact-string excess precision or require explicit rounding; report any conversion accurately |
| Tiny exact amounts can silently become zero | Reject invalid precision/zero payment amounts as appropriate; preserve exact quantities through draft and preview |
| A Decimals cell can override native NEAR's 24 decimals | Resolve precision from the asset definition/verified metadata; never let arbitrary cell input redefine it |
| No UI to reopen older local documents | Provide document listing/opening and a safe active-document lifecycle |
| JSON export first requires a successful IndexedDB save | Export a fresh live snapshot even if persistence fails; preserve pending edits and useful recovery messages |
| Demo routing matches any account name containing `demo` | Use an explicit sample mode/source; real account names always retain real semantics |
| Reviewed drafts can remain visible after data or treasury changes | Invalidate/recompute the preview and bind execution to the reviewed revision |
| Storage and wallet controllers avoid cleanup to sidestep Strict Mode | Audit lifecycle ownership, subscriptions, pending requests and stale callbacks; provide real cleanup without breaking remounts |

Exact money handling deserves targeted examples, not a blanket assertion that decimal.js makes every cell exact. Numeric spreadsheet values have finite precision. Define and communicate conversions, rounding and rejected inputs; preserve decimal strings/base units when exactness is required. Token metadata must come from the correct network/contract, not a display ticker or a user-supplied precision column.

## Documents and migration

Keep Dexie behind an asynchronous repository interface, with an explicit versioned document schema and future remote-adapter boundary. Preserve formulas, styles, sheets, plugin resources, source bindings, action identities/revisions and transaction references in native JSON.

Support reopening saved documents and recovery from storage failure. Snapshot the current workbook for exports independently of storage success. An import must not overwrite an existing document or accidentally submit actions. CSV remains values-only; preserve large integer strings and leading zeros, and define formula-like text handling for import/export.

Implement migrations for old application names and formulas without corrupting arbitrary user data. Define what importing/copying a workbook means for operation identities and historical submissions. Historical evidence must not turn a copied sheet into an executable duplicate. Preserve the original on a failed migration.

## Completion evidence for this one milestone

These are acceptance scenarios for one deliverable, not separate milestones:

- From a blank, arbitrarily named sheet, insert a NEAR balance and Sputnik proposal range; use their values in normal formulas. Rename/move sheets and cells without losing bindings.
- Compose native and fungible-token operations, a Sputnik vote, and an Intents cross-chain action in the table. Select operations and inspect their actual payloads. No outside payment template is needed.
- Exercise the selected Intents route through mocked quote expiry, delayed DAO approval, settlement and refund; prove the adapter understands destination chains and does not silently refresh approved parameters.
- Change an input after preview and verify execution cannot submit the old/unreviewed plan. Refresh/recalculate/import/undo never signs or submits. Handle an uncertain submission without blindly resending it.
- Reject the known amount corruption cases and known-token precision overrides. Verify exact asset/amount/recipient data survives the full path from formula to reviewed request.
- Open an older saved document, migrate old names/formulas, round-trip JSON, and export current work while the repository is forced to fail.
- Verify connection/auth restoration, rejection/cancellation, expiry and logout with mocked connector/backend responses using the chosen Trezu-inspired flow. Missing optional provider configuration preserves basic use.
- Demonstrate a coherent premium interface with readable cell states, discoverable functions and usable keyboard/focus behavior. Record any user visual verification still required.
- Run type checking, a production build and focused meaningful tests. A large passing test count is not proof of product alignment; replace tests that assert the rejected template behavior.

Update README/decisions to describe the resulting behavior honestly. Do not add a new multi-milestone roadmap or a manual integration guide. Report important outcomes and remaining blockers to the user as a short list.
