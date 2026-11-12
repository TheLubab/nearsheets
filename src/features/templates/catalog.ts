import { CellValueType, LocaleType } from '@univerjs/core';
import type { ICellData } from '@univerjs/core';
import type { WorkbookSnapshot } from '../spreadsheet/model/workbook-snapshot';

export type TemplateId = 'getting-started' | 'account-balances' | 'dao-proposals' | 'contributor-payments';
export interface WorkbookTemplate {
  readonly id: TemplateId;
  readonly name: string;
  readonly description: string;
  readonly preview: readonly (readonly string[])[];
  createWorkbook(): WorkbookSnapshot;
}

type Sheet = WorkbookSnapshot['sheets'][string];
function sheet(name: string, widths: number[] = [300, 270, 220, 200, 190, 260, 250]): Sheet {
  return {
    id: `sheet-${crypto.randomUUID()}`, name, rowCount: 140, columnCount: 12,
    defaultRowHeight: 30, cellData: {}, mergeData: [],
    columnData: Object.fromEntries(widths.map((w, i) => [i, { w }])),
  };
}
function cell(s: Sheet, row: number, column: number, value: string | number, input = false) {
  const data: ICellData = typeof value === 'string' && value.startsWith('=')
    ? { f: value }
    : { v: value, t: typeof value === 'string' ? CellValueType.STRING : CellValueType.NUMBER };
  if (input) data.s = { bg: { rgb: '#FFF2CC' }, n: { pattern: '@' } };
  s.cellData![row - 1] ??= {};
  s.cellData![row - 1]![column - 1] = data;
}
function line(s: Sheet, row: number, text: string, heading = false) {
  cell(s, row, 1, text);
  s.cellData![row - 1]![0]!.s = heading
    ? { bl: 1, fs: 13, bg: { rgb: '#DDEDE3' }, cl: { rgb: '#235B45' } }
    : { cl: { rgb: '#45534B' } };
  s.mergeData!.push({ startRow: row - 1, endRow: row - 1, startColumn: 0, endColumn: 6 });
}
function headers(s: Sheet, row: number, labels: string[]) {
  labels.forEach((label, i) => {
    cell(s, row, i + 1, label);
    s.cellData![row - 1]![i]!.s = { bl: 1, bg: { rgb: '#DDEDE3' } };
  });
}
function input(s: Sheet, row: number, label: string, value = '') {
  cell(s, row, 1, `Input: ${label}`); cell(s, row, 2, value, true);
}
function workbook(name: string, main: Sheet): WorkbookSnapshot {
  return { id: `workbook-${crypto.randomUUID()}`, name, locale: LocaleType.EN_US,
    sheetOrder: [main.id!], sheets: { [main.id!]: main } };
}
function gettingStarted() {
  const s = sheet('Start here');
  line(s, 1, 'Welcome to NearSheets — about five minutes', true);
  line(s, 2, '1. Edit B4. B5 follows that cell reference. This example works offline.');
  input(s, 4, 'a number', '5');
  cell(s, 5, 1, 'Your number + 1'); cell(s, 5, 2, '=B4+1');
  line(s, 7, '2. Read your account balance. Enter an existing account and its network.', true);
  input(s, 8, 'network', 'testnet');
  headers(s, 10, ['Input: account', 'Balance (NEAR)']);
  cell(s, 11, 1, '', true);
  cell(s, 11, 2, '=IF(OR(A11="",$B$8=""),"Enter account and network",NEAR_BALANCE(A11,$B$8))');
  line(s, 13, '3. Enter another account in A15. Copy B11 into B15; the account reference moves while $B$8 stays fixed.', true);
  cell(s, 15, 1, '', true);
  line(s, 17, '4. Preparing, reviewing and signing are separate steps.', true);
  line(s, 18, 'Formulas prepare editable drafts. Select prepared cells and choose Blockchain → Review actions to inspect exact calls.');
  line(s, 19, 'Only Sign reviewed actions requests your wallet. A submitted DAO proposal is not a completed payment.');
  line(s, 21, 'Next: File → Templates… → Contributor payments. Supply your own DAO, recipient, reference and exact amount.');
  line(s, 22, 'No wallet is required for this tutorial. Refresh reads from Blockchain; use Details to inspect errors and freshness.');
  return workbook('Getting started', s);
}
function accountBalances() {
  const s = sheet('Balances');
  line(s, 1, 'Account balances', true);
  line(s, 2, 'Enter your own accounts below. All balance results are approximate; the total combines NEAR only.');
  input(s, 4, 'network', 'testnet');
  input(s, 5, 'optional token contract');
  headers(s, 7, ['Input: account', 'Native balance (NEAR)', 'Optional token balance']);
  for (let r = 8; r <= 10; r++) {
    cell(s, r, 1, '', true);
    cell(s, r, 2, `=IF(OR(A${r}="",$B$4=""),"Enter account and network",NEAR_BALANCE(A${r},$B$4))`);
    cell(s, r, 3, `=IF(OR(A${r}="",$B$4="",$B$5=""),"Enter account, network and token",FT_BALANCE($B$5,A${r},$B$4))`);
  }
  cell(s, 12, 1, 'Total entered accounts (NEAR)');
  cell(s, 12, 2, '=IF(COUNTA(A8:A10)=0,"Enter an account above",IF(A8="",0,B8)+IF(A9="",0,B9)+IF(A10="",0,B10))');
  line(s, 14, 'Balances are not necessarily spendable: storage, fees and proposal bonds may need reserves.');
  line(s, 15, 'Do not add token and NEAR balances together. Use Blockchain → Refresh reads and Details for freshness and errors.');
  return workbook('Account balances', s);
}
function daoProposals() {
  const s = sheet('Proposals', [120, 480, 180, 270]);
  line(s, 1, 'DAO proposal tracker', true);
  input(s, 3, 'DAO account'); input(s, 4, 'network', 'testnet');
  line(s, 6, 'The table starts at A9 and needs A9:D109 empty. It returns headers plus the first 100 proposals only.');
  line(s, 7, 'Submission and approval do not prove payment completion. Check execution and receipts separately.');
  cell(s, 9, 1, '=IF(OR(B3="",B4=""),"Enter DAO and network above",SPUTNIK_PROPOSALS(B3,B4))');
  return workbook('DAO proposal tracker', s);
}
function contributorPayments() {
  const s = sheet('Payments');
  line(s, 1, 'Contributor payments', true);
  input(s, 3, 'DAO account'); input(s, 4, 'network', 'testnet');
  line(s, 6, 'Enter your own payment details in yellow Input cells. Amounts are exact decimal text; keep the Text format.');
  line(s, 7, 'Use a unique reference for each new intended payment. Copying a row retains its identity; it is not new authorization.');
  headers(s, 9, ['Input: unique reference', 'Input: recipient', 'Input: exact amount text', 'Input: asset (near or token)', 'Prepared transfer', 'Recorded status']);
  for (let r = 10; r <= 14; r++) {
    for (let c = 1; c <= 4; c++) cell(s, r, c, c === 4 ? 'near' : '', true);
    cell(s, r, 5, `=IF(OR($B$3="",$B$4="",A${r}="",B${r}="",C${r}="",D${r}=""),"Enter all payment inputs",SPUTNIK_TRANSFER(A${r},$B$3,B${r},C${r},D${r},$B$4))`);
    cell(s, r, 6, `=IF(OR($B$3="",$B$4="",A${r}="",B${r}="",C${r}="",D${r}=""),"No draft yet",NS_STATUS(E${r}))`);
  }
  line(s, 16, 'Select prepared cells in column E → Blockchain → Review actions. Inspect exact amounts, recipients and calls.');
  line(s, 17, 'Sign reviewed actions opens your wallet. Opening, editing, refreshing and preparing never sign or submit.');
  line(s, 18, 'Recorded status tracks local attempts. A confirmed proposal still needs governance; it does not prove payment completion.');
  line(s, 19, 'Token precision is verified from the contract. Never replace exact text amounts with rounded numeric balances.');
  return workbook('Contributor payments', s);
}

export const WORKBOOK_TEMPLATES: readonly WorkbookTemplate[] = [
  { id: 'getting-started', name: 'Getting started', description: 'A five-minute editable introduction, starting offline.', preview: [['Input: a number', '5'], ['Your number + 1', '=B4+1'], ['Input: account', 'Balance (NEAR)']], createWorkbook: gettingStarted },
  { id: 'account-balances', name: 'Account balances', description: 'Compare native and optional token balances for your accounts.', preview: [['Input: account', 'NEAR', 'Token'], ['Your account', 'Balance', 'Balance'], ['Total', 'NEAR only', '']], createWorkbook: accountBalances },
  { id: 'dao-proposals', name: 'DAO proposal tracker', description: 'Read the first 100 proposals for your DAO.', preview: [['Input: DAO', ''], ['ID', 'Description', 'Status'], ['↓', 'Proposal results', '↓']], createWorkbook: daoProposals },
  { id: 'contributor-payments', name: 'Contributor payments', description: 'Prepare exact DAO payments for deliberate review and signing.', preview: [['Reference', 'Recipient', 'Amount text'], ['Your inputs', 'Your inputs', 'Your inputs'], ['Prepared transfer', 'Recorded status', '']], createWorkbook: contributorPayments },
];
export function getWorkbookTemplate(id: TemplateId): WorkbookTemplate {
  const template = WORKBOOK_TEMPLATES.find(t => t.id === id);
  if (!template) throw new Error('Unknown workbook template.');
  return template;
}
