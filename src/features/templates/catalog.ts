import { designTemplate } from './workbook-designs';
import { CellValueType, LocaleType } from '@univerjs/core';
import type { ICellData } from '@univerjs/core';
import type { WorkbookSnapshot } from '../spreadsheet/model/workbook-snapshot';

export type TemplateId = 'getting-started' | 'account-balances' | 'dao-proposals' | 'contributor-payments' | 'invoices-expenses' | 'community-budget' | 'international-payouts' | 'treasury-overview' | 'grants-rewards';
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
  if (input) data.s = { bg: { rgb: '#F4F6D8' }, n: { pattern: '@' } };
  s.cellData![row - 1] ??= {};
  s.cellData![row - 1]![column - 1] = data;
}
function line(s: Sheet, row: number, text: string, heading = false) {
  cell(s, row, 1, text);
  s.cellData![row - 1]![0]!.s = heading
    ? { bl: 1, fs: 13, bg: { rgb: '#E6DCF9' }, cl: { rgb: '#40549C' } }
    : { cl: { rgb: '#626078' } };
  s.mergeData!.push({ startRow: row - 1, endRow: row - 1, startColumn: 0, endColumn: 6 });
}
function headers(s: Sheet, row: number, labels: string[]) {
  labels.forEach((label, i) => {
    cell(s, row, i + 1, label);
    s.cellData![row - 1]![i]!.s = { bl: 1, bg: { rgb: '#E6DCF9' } };
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
  line(s, 1, 'Read live blockchain data.', true);
  line(s, 2, 'NEAR_BALANCE reads NEAR; FT_BALANCE reads the token in B4. Change any account below to check its balances.');
  input(s, 3, 'network', 'mainnet');
  input(s, 4, 'token contract', 'usdt.tether-token.near');
  headers(s, 5, ['Account', 'Balance (NEAR)', 'Balance (USDT)']);
  cell(s, 5, 3, '=IF(B4="usdt.tether-token.near","Balance (USDT)","Token balance")');
  s.cellData![4]![2]!.s = { bl: 1, bg: { rgb: '#E6DCF9' } };
  ['binancecold3.near', 'dclv2.ref-labs.near', 'root.near', 'social.near', 'ref-finance.sputnik-dao.near'].forEach((account, i) => {
    const r = 6 + i;
    cell(s, r, 1, account, true);
    cell(s, r, 2, `=IF(OR(A${r}="",$B$3=""),"Enter account and network",NEAR_BALANCE(A${r},$B$3))`);
    cell(s, r, 3, `=IF(OR(A${r}="",$B$3="",$B$4=""),"Enter account, network and token",IF(AND($B$4="usdt.tether-token.near",$B$3<>"mainnet"),"USDT example uses mainnet",FT_BALANCE($B$4,A${r},$B$3)))`);
  });
  cell(s, 11, 1, 'Totals by asset');
  cell(s, 11, 2, '=IF(OR(A6="",A7="",A8="",A9="",A10="",B3=""),"Enter accounts and network",SUM(B6:B10))');
  cell(s, 11, 3, '=IF(OR(A6="",A7="",A8="",A9="",A10="",B3="",B4=""),"Enter accounts, network and token",IF(AND(B4="usdt.tether-token.near",B3<>"mainnet"),"USDT example uses mainnet",SUM(C6:C10)))');
  line(s, 13, 'Read a smart contract.', true);
  line(s, 14, 'This calls ft_metadata on the token contract above. Change B4 to inspect a different token.');
  cell(s, 16, 1, '=IF(OR(B3="",B4=""),"Enter network and token",NEAR_VIEW(B4,"ft_metadata","{}",B3))');
  line(s, 25, 'Estimate a cross-chain swap.', true);
  line(s, 26, 'Compare wrapped NEAR with USDC on Ethereum. Change the amount below to fetch a new estimate.');
  input(s, 28, 'amount of wrapped NEAR', '1');
  input(s, 29, 'origin asset', 'nep141:wrap.near');
  input(s, 30, 'output asset', 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near');
  input(s, 31, 'destination chain', 'eth');
  input(s, 32, 'quote-only recipient', '0x0000000000000000000000000000000000000001');
  line(s, 34, 'The recipient above is a placeholder for this estimate. Leave A36:C60 free for results.');
  cell(s, 36, 1, '=IF(OR(B28="",B29="",B30="",B31="",B32=""),"Enter quote inputs",INTENTS_QUOTE(B29,B30,B28,B31,B32,"near",100))');
  line(s, 62, 'For a fresh estimate, select the quote and choose Blockchain → Refresh → Refresh selected reads. Use Refresh all workbook data to update everything.');
  const book = workbook('Getting started with NearSheets', s);
  const transaction = gettingStartedTransaction();
  book.sheetOrder.push(transaction.id!);
  book.sheets[transaction.id!] = transaction;
  return book;
}

function gettingStartedTransaction() {
  const s = sheet('Try a transaction');
  line(s, 1, 'Tutorial: Create a Trezu treasury payment proposal.', true);
  line(s, 2, 'You need treasury proposal permission and wallet funds for fees and the proposal bond. The default network is testnet.');
  line(s, 3, '1. Fill in the yellow cells.', true);
  input(s, 4, 'Sputnik treasury account');
  input(s, 5, 'network', 'testnet');
  input(s, 6, 'recipient account');
  input(s, 7, 'amount (NEAR)');
  input(s, 8, 'unique payment reference');
  line(s, 9, 'Enter the exact amount as decimal text. Use a new reference for each new payment.');
  const guard = 'OR(B4="",B5="",B6="",B7="",B8="")';
  cell(s, 11, 1, 'Prepared proposal');
  cell(s, 11, 2, `=IF(${guard},"Enter all inputs above",SPUTNIK_TRANSFER(B8,B4,B6,B7,"near",B5))`);
  cell(s, 12, 1, 'Submission status');
  cell(s, 12, 2, `=IF(${guard},"No draft yet",NS_STATUS(B11))`);
  line(s, 14, '2. Connect your wallet using Sign In. Choose the same network as B5.', true);
  line(s, 15, 'Select B11, then choose Blockchain → Review actions. Check the treasury, recipient, exact amount, fees and proposal bond.');
  line(s, 17, '3. Choose Sign reviewed actions, then approve the request in your wallet if the details are correct.', true);
  line(s, 18, 'B12 shows the recorded outcome; the receipt appears below.');
  line(s, 20, 'Submitting a proposal does not pay the recipient. The treasury must approve and execute it under its own rules.');
  line(s, 21, 'If the outcome is uncertain, use Details to reconcile the transaction before trying again.');
  line(s, 23, 'Submission receipt. Leave the cells below empty for the result.', true);
  cell(s, 25, 1, `=IF(${guard},"No transaction submitted",NS_RECEIPT(B11))`);
  return s;
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
function paymentWorkbook(title = 'Team payroll', purpose = 'payee', extraLabels = ['Team member / note', 'Period']) {
  const s = sheet('Payments', [230, 240, 210, 240, 300, 220, 240, 200]);
  line(s, 1, title, true);
  input(s, 3, 'shared treasury account (Sputnik)'); input(s, 4, 'network', 'testnet');
  line(s, 6, 'Enter payment details in the yellow cells. Review the amount and asset before submitting a proposal.');
  line(s, 7, 'Use a unique reference for each new intended payment. Copying a row retains its identity; it is not new authorization.');
  headers(s, 9, ['Input: unique reference', `Input: ${purpose} account`, 'Amount', 'Input: asset (near or token)', 'Prepared transfer', 'Recorded status', ...extraLabels]);
  for (let r = 10; r <= 14; r++) {
    for (let c = 1; c <= 4; c++) cell(s, r, c, c === 4 ? 'near' : '', true);
    cell(s, r, 7, '', true); cell(s, r, 8, '', true);
    cell(s, r, 5, `=IF(OR($B$3="",$B$4="",A${r}="",B${r}="",C${r}="",D${r}=""),"Enter all payment inputs",SPUTNIK_TRANSFER(A${r},$B$3,B${r},C${r},D${r},$B$4))`);
    cell(s, r, 6, `=IF(OR($B$3="",$B$4="",A${r}="",B${r}="",C${r}="",D${r}=""),"No draft yet",NS_STATUS(E${r}))`);
  }
  line(s, 16, 'Select prepared cells in column E → Blockchain → Review actions. Inspect exact amounts, recipients and calls.');
  line(s, 17, 'Signing submits one proposal per payment to the shared treasury. Editing and refreshing never sign or submit.');
  line(s, 18, 'A submitted proposal still needs treasury approval and execution; it does not prove payment completion.');
  line(s, 19, 'Amounts keep all entered digits. To pay a calculated amount, choose any rounding explicitly before entering it.');
  line(s, 20, 'Notes in columns G and H are for your records; they do not change the proposal or schedule a payment.');
  return workbook(title, s);
}

function treasuryOverview() {
  const s = sheet('Treasury', [210, 450, 220, 260, 200, 200, 200]);
  line(s, 1, 'Treasury overview', true);
  line(s, 2, 'See a shared treasury balance and recent proposals in one place. Enter your own treasury account below.');
  input(s, 4, 'shared treasury account (Sputnik)'); input(s, 5, 'network', 'testnet');
  cell(s, 7, 1, 'NEAR balance (approximate)');
  cell(s, 7, 2, '=IF(OR(B4="",B5=""),"Enter treasury and network",NEAR_BALANCE(B4,B5))');
  line(s, 8, 'Select a balance and choose Blockchain → Inspect for full precision and source details.');
  line(s, 10, 'Recent proposals: the first 100 are shown below. Keep A13:D113 free for the results.');
  line(s, 11, 'A proposal submission is not a completed payment. Balances may include amounts reserved for storage and fees.');
  cell(s, 13, 1, '=IF(OR(B4="",B5=""),"Enter treasury and network",SPUTNIK_PROPOSALS(B4,B5))');
  return workbook('Treasury overview', s);
}

function internationalPayouts() {
  const s = sheet('International payout', [290, 380, 250, 240, 250, 240, 220]);
  line(s, 1, 'International payouts', true);
  line(s, 2, 'Plan one cross-chain payout from a shared Sputnik treasury using NEAR Intents.');
  input(s, 3, 'shared treasury account (also the refund account)');
  input(s, 4, 'unique action reference');
  input(s, 5, 'origin asset ID (NEAR fungible token)');
  input(s, 6, 'destination asset ID');
  input(s, 7, 'destination chain');
  input(s, 8, 'recipient address on destination chain');
  input(s, 9, 'amount');
  input(s, 10, 'slippage in basis points', '100');
  cell(s, 11, 1, 'Network'); cell(s, 11, 2, 'mainnet', true);
  line(s, 13, 'Use asset IDs from the Intents provider catalog. Funding supports NEAR fungible tokens on mainnet only.');
  line(s, 14, 'An estimate does not allocate a deposit. Review the prepared action to explicitly prepare a route.');
  line(s, 15, 'Quotes expire. A submitted treasury proposal still needs approval; expiry may require a new proposal.');
  cell(s, 17, 1, 'Prepared payout proposal');
  cell(s, 17, 2, '=IF(OR(B3="",B4="",B5="",B6="",B7="",B8="",B9="",B10="",B11=""),"Enter payout inputs above",INTENTS_SWAP(B4,B3,B5,B6,B9,B7,B8,B3,VALUE(B10),B11))');
  cell(s, 18, 1, 'Recorded status');
  cell(s, 18, 2, '=IF(OR(B3="",B4="",B5="",B6="",B7="",B8="",B9="",B10="",B11=""),"Enter payout inputs above",NS_STATUS(B17))');
  line(s, 20, 'Estimate below: keep A22:C40 free. Provider availability, destination support and quote limits apply.');
  cell(s, 22, 1, '=IF(OR(B3="",B5="",B6="",B7="",B8="",B9="",B10=""),"Enter payout inputs above",INTENTS_QUOTE(B5,B6,B9,B7,B8,B3,VALUE(B10)))');
  return workbook('International payouts', s);
}

const templates: readonly WorkbookTemplate[] = [
  { id: 'getting-started', name: 'Getting started with NearSheets', description: 'Read NEAR and USDT balances, inspect blockchain data and optionally sign a proposal.', preview: [['Public account', 'NEAR', 'USDT'], ['Live balances', 'NEAR_BALANCE', 'FT_BALANCE'], ['Proposal draft', 'Wallet transaction', '']], createWorkbook: gettingStarted },
  { id: 'contributor-payments', name: 'Team payroll', description: 'Calculate hours and rates, then review treasury payments.', preview: [['Reference', 'Team member', 'Amount'], ['Pay run', 'Recipient', 'Amount'], ['Treasury proposal', 'Status', '']], createWorkbook: () => paymentWorkbook() },
  { id: 'invoices-expenses', name: 'Invoices & expenses', description: 'Track outstanding bills and due dates before preparing payments.', preview: [['Reference', 'Vendor', 'Amount'], ['Invoice', 'Recipient', 'Amount']], createWorkbook: () => paymentWorkbook('Invoices & expenses', 'vendor', ['Invoice / category', 'Due date (note)']) },
  { id: 'community-budget', name: 'Community budget', description: 'Compare category budgets and commitments, then prepare spending.', preview: [['Reference', 'Recipient', 'Amount'], ['Community expense', 'Recipient', 'Amount']], createWorkbook: () => paymentWorkbook('Community budget', 'recipient', ['Purpose', 'Budget category']) },
  { id: 'international-payouts', name: 'International payouts', description: 'Compare live NEAR Intents estimates and prepare a cross-chain payout.', preview: [['Origin asset', 'Destination asset'], ['Amount', 'Recipient'], ['Estimate', 'Treasury proposal']], createWorkbook: internationalPayouts },
  { id: 'treasury-overview', name: 'Treasury overview', description: 'Inspect balances and proposals, and prepare compatible pool staking.', preview: [['Treasury', 'NEAR balance'], ['Proposal', 'Status']], createWorkbook: treasuryOverview },
  { id: 'grants-rewards', name: 'Grants & rewards', description: 'Calculate milestone releases and track award proposals.', preview: [['Reference', 'Recipient', 'Award'], ['Grant', 'Recipient', 'Amount']], createWorkbook: () => paymentWorkbook('Grants & rewards', 'recipient', ['Program / grant', 'Award note']) },
  { id: 'account-balances', name: 'Portfolio & balances', description: 'Track live NEAR, USDT and USDC across accounts with separate asset totals.', preview: [['Input: account', 'NEAR', 'Token'], ['Your account', 'Balance', 'Balance'], ['Total', 'NEAR only', '']], createWorkbook: accountBalances },
  { id: 'dao-proposals', name: 'Proposal review', description: 'Read the proposal queue and prepare explicit voting decisions.', preview: [['Input: DAO', ''], ['ID', 'Description', 'Status'], ['↓', 'Proposal results', '↓']], createWorkbook: daoProposals },
];
const galleryPreviews:Partial<Record<TemplateId,readonly (readonly string[])[]>>={
 'account-balances':[['Public accounts','USDT','USDC'],['Ref Finance','Live balance','Live balance'],['NEAR Intents','Live balance','Live balance']],
 'international-payouts':[['wNEAR → USDC','Input','Live output'],['Ethereum','1','INTENTS_QUOTE'],['Compare amounts','5','INTENTS_QUOTE']],
 'contributor-payments':[['Treasury','Live funds'],['Pay run','Payment proposals'],['Results','NS_RECEIPT']],
 'invoices-expenses':[['Treasury','Live funds'],['Due bills','Payment proposals'],['Receipts','Recorded attempts']],
 'community-budget':[['Live treasury','Budget coverage'],['Categories','Remaining funds'],['Payments','Payment proposals']],
 'treasury-overview':[['Ref Finance','Live balance'],['Proposals','SPUTNIK_PROPOSALS'],['Staking','Prepare proposal']],
 'grants-rewards':[['Treasury','Live funds'],['Milestone release','Payment proposal'],['Results','Submission receipt']],
 'dao-proposals':[['Public treasury','Live proposals'],['Proposal ID','Current status'],['Decision','SPUTNIK_VOTE']],
};
const galleryOrder:TemplateId[]=['getting-started','account-balances','international-payouts','contributor-payments','invoices-expenses','community-budget','treasury-overview','grants-rewards','dao-proposals'];
export const WORKBOOK_TEMPLATES:readonly WorkbookTemplate[]=galleryOrder.map(id=>{
 const template=templates.find(t=>t.id===id)!;
 return {...template,preview:galleryPreviews[id]??template.preview,createWorkbook:()=>designTemplate(id,template.createWorkbook())};
});
export function getWorkbookTemplate(id: TemplateId): WorkbookTemplate {
  const template = WORKBOOK_TEMPLATES.find(t => t.id === id);
  if (!template) throw new Error('Unknown workbook template.');
  return template;
}
