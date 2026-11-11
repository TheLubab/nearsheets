# Templates and getting started

> **Temporary implementation plan — DELETE WHEN DONE.** Keep this file as the central checklist for this feature. Once implementation and acceptance are complete, move lasting behavior and relevant limits into README, decisions and implementation status, then delete this file. Do not delete it while acceptance is still pending.

Created: 2026-11-12. Status: planned; implementation has not started.

## Goal and scope

Introduce new users through a conventional welcome dialog, an editable getting-started workbook and a small template picker. The first useful experience should require neither a wallet nor knowledge of blockchain formulas.

The spreadsheet remains the application. Templates demonstrate existing capabilities; they must not become required layouts or introduce sheet-name/header-dependent execution. This feature follows [product decisions](decisions.md) and the [refactor brief](nearsheets-refactor.md); it does not replace their outstanding acceptance requirements.

Deliver one guided workbook and three templates, plus their entry points. Interactive tour overlays, a tutorial engine, remote template hosting, community submissions and cross-chain templates are outside this initial feature.

## User experience

### Welcome

On a first visit, after document initialization succeeds, show a small “Welcome to NearSheets” dialog with three choices:

- **Get started:** create and open a fresh guided workbook.
- **Use a template:** open the template picker.
- **Blank workbook:** continue into the initial blank workbook without creating a redundant copy.

Closing the welcome dialog also continues into the workbook. Remember dismissal locally, separately from workbook contents. Existing users with saved documents should retain normal startup behavior and should not receive the welcome merely because the new preference is missing. Do not use a preference write to replace or clear documents.

If preference storage is unavailable, editing must still work; avoid repeatedly reopening the dialog within the current session. Gate welcome display on completed startup so it cannot race document restoration or appear over a startup error.

### Persistent entry points

Add **Templates…** and **Getting started** to the existing File menu. Preserve File's placement in the ribbon tab row, the Open shortcut and the direct New workbook command. Getting started creates a fresh tutorial copy; it never resets an existing tutorial workbook.

The template picker shows each template's name, short purpose, small static layout preview and **Use template** button. Use the existing dialog/control patterns. Support keyboard navigation, sensible focus restoration and a clear creation/error state. Prevent duplicate creation from repeated clicks. Keep the picker open with useful feedback if creation fails.

## Workbook content

All examples use normal editable cells, formulas and formatting. Mark inputs with both labels and consistent styling; color alone must not convey their role. Include a compact Read me sheet explaining inputs, network, refresh, errors and the next useful step. Reserve clear space for spilled results. Use the implemented signatures in [functions](functions.md), not abbreviated signatures from older briefs.

| Workbook | Content and learning outcome |
| --- | --- |
| Getting started | A roughly five-minute sequence: edit a cell and follow a reference; enter an account/network and read its balance; add an account and copy the formula; understand how preparing, reviewing and signing differ. The final section points users to the contributor-payments template. |
| Account balances | Labeled account/network inputs, native balance formulas, an optional token-contract input and token balance examples, plus a simple numeric total where units match. Explain that balances are approximate and are not necessarily fully spendable. |
| DAO proposal tracker | DAO/network inputs and a proposal formula with sufficient empty spill space. Explain the current first-100-proposals limit and that proposal submission/approval does not establish payment completion. |
| Contributor payments | DAO/network inputs and rows for a unique reference, recipient, exact amount text, asset, prepared transfer and recorded status. Explain selection, Review actions and the wallet step. Require user-supplied payment details before producing action drafts. |

The tutorial begins with a local example that works without network access. Blockchain sections request the user's account or DAO; do not rely on an invented account existing. Guard formulas with missing inputs so fresh copies show clear instructions instead of avoidable errors. Once inputs exist, preserve actual read failures and their diagnostics rather than disguising them as zero balances or success.

Contributor-payment rows start with missing actionable inputs. Do not embed live recipients, executable sample payments, prior receipts, execution attempts, runtime descriptors or wallet state. Exact payment amounts are entered/stored as decimal text and passed directly to action formulas. Explain action reference identity and require a new reference for each new intended payment; copying a row is not a new authorization.

Opening, recalculating or refreshing any example must never sign or submit. Keep the existing explicit selection → review → wallet flow. No wallet is required to create, edit or use read-only examples.

## Implementation approach

- Add a small typed catalog under `src/features/templates/` containing stable template IDs, descriptions and workbook factories. Keep tutorial content in this same feature rather than a second creation system. No server or new dependency is expected.
- Generate a fresh document, workbook and sheet IDs for each use. Build an independent snapshot on every invocation; do not mutate shared catalog objects. Resolve cross-sheet references consistently when constructing the workbook.
- Add a workspace operation for template creation in `src/features/documents/application/document-workspace.ts`. Reuse document envelopes, existing pending-edit settlement, repository persistence and document-switch behavior. Never overwrite the current workbook or switch away when pending edits cannot be safely preserved.
- Route both the picker and Getting started through that operation. Persist before opening, report failures through established controls and leave existing work accessible. Keep JSON export available under the existing storage-failure behavior.
- Integrate File entries in `DocumentBar.tsx` and first-visit orchestration at the application/workspace boundary. Inspect startup behavior before deciding how to expose whether this is a genuinely new local workspace; do not infer it solely from a missing welcome flag or the fixed starter-document ID.
- Templates become ordinary local documents after creation. Catalog updates must not rewrite users' copies. No document schema migration is expected; verify this before adding metadata solely for template origin.

## Build order and checklist

These are internal implementation steps, not separate release milestones.

- [ ] Inspect current workspace startup/switching, workbook snapshot construction and existing document tests.
- [ ] Implement catalog/factories and workspace creation with independent IDs and preserved pending edits.
- [ ] Build the tutorial and three template workbooks, checking formulas against the current catalog.
- [ ] Add the template picker and both File entry points.
- [ ] Add welcome eligibility and dismissal persistence after startup is ready.
- [ ] Complete focused verification and record any pending user inspection here.
- [ ] Update durable documentation to describe delivered behavior and actual limits.
- [ ] After acceptance is complete, delete this file.

## Acceptance and verification

- Repeated template use creates independent documents and sheet/workbook IDs. Editing one copy cannot change another or the source catalog.
- Existing work, pending edits and saved documents survive template creation, cancellation, duplicate clicks and storage failures. Failed creation does not replace the current document.
- First-time welcome choices and dismissal work; returning users retain their normal document flow. Missing/unavailable preference storage does not block editing or cause a dialog loop within the session.
- Tutorial and templates open, edit, save, reopen and export/import as ordinary workbooks with formulas and formatting retained. Existing execution protections remain intact.
- Real formula-engine checks with mocked external services cover representative template formulas, empty-input guards, proposal spills and exact text amount references. Creation/recalculation does not request wallet signing or submission.
- Run `pnpm typecheck`, `pnpm build` and minimal meaningful tests for changed behavior. Do not use live services, start servers or run browser/screenshot tooling under the current repository rules.
- Ask the user to inspect welcome/picker focus and keyboard behavior, workbook legibility, formula copying, spill space and the review entry point in the running UI. Record visual acceptance as pending until confirmed; automated checks alone do not complete it.

## Progress and remaining acceptance

Documentation only. No feature implementation or verification has been performed yet.
