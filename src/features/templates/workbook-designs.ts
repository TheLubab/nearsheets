import { CellValueType } from '@univerjs/core';
import type { ICellData } from '@univerjs/core';
import type { WorkbookSnapshot } from '../spreadsheet/model/workbook-snapshot';
import type { TemplateId } from './catalog';

type Sheet = WorkbookSnapshot['sheets'][string];
const palette={ink:'#302F2C',muted:'#6B6965',purple:'#E6DCF9',input:'#F4F6D8',blue:'#40549C'};
function sheet(name:string,widths=[210,190,170,170,190,210]):Sheet {
 return {id:'sheet-'+crypto.randomUUID(),name,rowCount:180,columnCount:12,defaultRowHeight:30,cellData:{},mergeData:[],columnData:Object.fromEntries(widths.map((w,i)=>[i,{w}]))};
}
function put(s:Sheet,row:number,col:number,value:string|number,input=false) {
 const c:ICellData=typeof value==='string'&&value.startsWith('=')?{f:value}:{v:value,t:typeof value==='number'?CellValueType.NUMBER:CellValueType.STRING};
 c.s={fs:11,cl:{rgb:palette.ink},...(input?{bg:{rgb:palette.input},...(typeof value==='string'?{n:{pattern:'@'}}:{})}:{})};
 s.cellData![row-1]??={};s.cellData![row-1]![col-1]=c;
}
function band(s:Sheet,row:number,text:string,title=false){put(s,row,1,text);s.cellData![row-1]![0]!.s={fs:title?17:11,bl:title?1:0,cl:{rgb:title?palette.blue:palette.muted},...(title?{bg:{rgb:palette.purple}}:{})};s.mergeData!.push({startRow:row-1,endRow:row-1,startColumn:0,endColumn:5});}
function head(s:Sheet,row:number,labels:string[]){labels.forEach((label,i)=>{put(s,row,i+1,label);s.cellData![row-1]![i]!.s={bl:1,fs:11,bg:{rgb:palette.purple}};});}
function metric(s:Sheet,col:number,label:string,value:string|number){put(s,4,col,label);put(s,5,col,value);s.cellData![4]![col-1]!.s={fs:16,bl:1,cl:{rgb:palette.blue},n:{pattern:'#,##0.00'}};}
function input(s:Sheet,row:number,label:string,value:string|number=''){put(s,row,1,label);put(s,row,2,value,true);}
function append(book:WorkbookSnapshot,s:Sheet){book.sheetOrder.push(s.id!);book.sheets[s.id!]=s;return s;}
function ref(s:Sheet,address:string){return "'"+s.name!.replaceAll("'","''")+"'!"+address;}
function example(title:string,description:string){const s=sheet('Example');band(s,1,title,true);band(s,2,'ILLUSTRATIVE DATA · editable examples, not live balances, quotes or transaction history.');band(s,3,description);return s;}
function finish(s:Sheet,next:string){band(s,18,'Try it: edit a yellow cell and watch the calculations update.');band(s,20,next);band(s,21,'Live work uses your accounts. Example calculations never create action drafts or request a wallet.');}
function numericSummary(s:Sheet){band(s,23,'Planning totals use ordinary spreadsheet numbers. Exact approved payment amounts are entered separately.');}

function portfolio(live:Sheet){
 const s=example('Portfolio & balances','See how funds are distributed across accounts. Totals stay separate for each asset.');
 head(s,8,['Account label','NEAR (sample)','Token A (sample)','Share of NEAR']);
 ['Operating','Reserve','Community'].forEach((label,i)=>{const r=9+i;put(s,r,1,label,true);put(s,r,2,[120,600,80][i]!,true);put(s,r,3,[2400,7000,600][i]!,true);put(s,r,4,`=IF(SUM(B9:B11)=0,0,B${r}/SUM(B9:B11)*100)`);});
 metric(s,1,'Total NEAR','=SUM(B9:B11)');metric(s,3,'Total Token A','=SUM(C9:C11)');metric(s,5,'Reserve share (%)','=D10');
 finish(s,'Open Balances. Enter accounts and one token contract; compare live balances and exact source values.');
 head(live,7,['Public account','NEAR balance','USDT balance','USDC balance','NEAR share (%)']);
 put(live,7,3,'=IF(B5="usdt.tether-token.near","USDT balance","Token 1 balance")');
 put(live,7,4,'=IF(B6="17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1","USDC balance","Token 2 balance")');
 for(let r=8;r<=10;r++){
 put(live,r,4,`=IF(OR(A${r}="",$B$4="",$B$6=""),"",FT_BALANCE($B$6,A${r},$B$4))`);
 put(live,r,5,`=IF(OR(A${r}="",$B$4=""),"",IF($B$12=0,0,B${r}/$B$12*100))`);
 }
 band(live,16,'Select a balance and choose Blockchain → Inspect for full precision and source details.');
 put(live,12,1,'Total NEAR');
 put(live,13,1,'Token totals (separate assets)');
 put(live,13,4,'=IF(OR(COUNTA(A8:A10)=0,B6=""),"",IF(A8="",0,D8)+IF(A9="",0,D9)+IF(A10="",0,D10))');put(live,13,3,'=IF(OR(COUNTA(A8:A10)=0,B5=""),"",IF(A8="",0,C8)+IF(A9="",0,C9)+IF(A10="",0,C10))');
 return s;
}

function payments(book:WorkbookSnapshot,live:Sheet,id:TemplateId){
 const payroll=id==='contributor-payments',invoices=id==='invoices-expenses',grants=id==='grants-rewards';
 const title=payroll?'Team payroll':invoices?'Invoices & expenses':grants?'Grants & rewards':'Community budget';
 const s=example(title,payroll?'Calculate a pay run from hours and rates before approving exact payment amounts.':invoices?'See outstanding bills and which ones are due before preparing a payment run.':grants?'Release funding by milestone and see the remaining award budget.':'Plan spending by category and see where commitments exceed the budget.');
 const plan=append(book,sheet(payroll?'Pay run':invoices?'Bills':grants?'Milestones':'Budget'));
 band(plan,1,title+' · planning',true);band(plan,2,'Use one asset per planning sheet. Calculations are approximate. Review the amount you want to pay on Payments.');
 input(plan,4,'Planning asset','near');
 if(payroll){
  head(s,8,['Team member','Hours','Rate (one asset)','Planned pay','']);head(plan,8,['Team member','Hours','Rate','Planned pay','Recipient account']);
  for(let i=0;i<5;i++){const r=9+i;put(plan,r,1,'',true);put(plan,r,2,'',true);put(plan,r,3,'',true);put(plan,r,4,`=IF(OR(B${r}="",C${r}=""),"",B${r}*C${r})`);put(plan,r,5,'',true);if(i<3){put(s,r,1,['Design','Engineering','Community'][i]!,true);put(s,r,2,[24,40,16][i]!,true);put(s,r,3,[30,40,25][i]!,true);put(s,r,4,`=B${r}*C${r}`);}}
  metric(s,1,'Planned pay','=SUM(D9:D11)');metric(s,3,'Hours','=SUM(B9:B11)');metric(s,5,'Team members','=COUNTA(A9:A11)');
 }else if(invoices){
  input(s,6,'Review date (YYYY-MM-DD)','2026-11-12');input(plan,6,'Review date (YYYY-MM-DD)');
  head(s,8,['Vendor / invoice','Amount','Due (YYYY-MM-DD)','Paid? (yes/no)','Due now']);head(plan,8,['Vendor / invoice','Amount','Due (YYYY-MM-DD)','Paid? (yes/no)','Due now','Recipient account']);
  for(let i=0;i<5;i++){const r=9+i;for(const c of [1,2,3,4,6])put(plan,r,c,'',true);put(plan,r,5,`=IF(OR(B${r}="",C${r}="",$B$6=""),"",IF(D${r}="yes",0,IF(DATEVALUE(C${r})<=DATEVALUE($B$6),B${r},0)))`);if(i<3){put(s,r,1,['Hosting','Design invoice','Research'][i]!,true);put(s,r,2,[120,800,350][i]!,true);put(s,r,3,['2026-11-10','2026-11-20','2026-11-01'][i]!,true);put(s,r,4,['no','no','yes'][i]!,true);put(s,r,5,`=IF(D${r}="yes",0,IF(DATEVALUE(C${r})<=DATEVALUE($B$6),B${r},0))`);}}
  metric(s,1,'Outstanding','=SUMIF(D9:D11,"no",B9:B11)');metric(s,3,'Due now','=SUM(E9:E11)');metric(s,5,'Paid (manual)','=SUMIF(D9:D11,"yes",B9:B11)');
 }else if(grants){
  head(s,8,['Grant / milestone','Award amount','Release (%)','Planned release','Remaining']);head(plan,8,['Grant / milestone','Award amount','Release (%)','Planned release','Remaining','Recipient account']);
  for(let i=0;i<5;i++){const r=9+i;for(const c of [1,2,3,6])put(plan,r,c,'',true);put(plan,r,4,`=IF(OR(B${r}="",C${r}=""),"",IF(OR(C${r}<0,C${r}>100),"Use 0–100",B${r}*C${r}/100))`);put(plan,r,5,`=IF(OR(B${r}="",C${r}=""),"",B${r}-D${r})`);if(i<3){put(s,r,1,['Research / 1','Tooling / 2','Education / 1'][i]!,true);put(s,r,2,[2000,5000,1500][i]!,true);put(s,r,3,[25,50,100][i]!,true);put(s,r,4,`=B${r}*C${r}/100`);put(s,r,5,`=B${r}-D${r}`);}}
  metric(s,1,'Award budget','=SUM(B9:B11)');metric(s,3,'Planned release','=SUM(D9:D11)');metric(s,5,'Unreleased','=SUM(E9:E11)');
 }else{
  head(s,8,['Category','Budget','Committed','Remaining','Budget check']);head(plan,8,['Category','Budget','Committed','Remaining','Budget check']);
  for(let i=0;i<5;i++){const r=9+i;put(plan,r,1,'',true);put(plan,r,2,'',true);put(plan,r,3,'',true);put(plan,r,4,`=IF(OR(B${r}="",C${r}=""),"",B${r}-C${r})`);put(plan,r,5,`=IF(D${r}="","",IF(D${r}<0,"Over budget","Within budget"))`);if(i<3){put(s,r,1,['Events','Tools','Outreach'][i]!,true);put(s,r,2,[1000,500,800][i]!,true);put(s,r,3,[750,650,200][i]!,true);put(s,r,4,`=B${r}-C${r}`);put(s,r,5,`=IF(D${r}<0,"Over budget","Within budget")`);}}
  metric(s,1,'Budget','=SUM(B9:B11)');metric(s,3,'Committed','=SUM(C9:C11)');metric(s,5,'Remaining','=SUM(D9:D11)');
  band(plan,17,'Committed amounts are your planning inputs, not inferred from proposal submission or settlement.');
 }
 band(plan,19,'Next: enter the amount to pay on Payments. If using a calculated result, choose any rounding explicitly.');
 band(plan,20,'The live asset must match this planning asset. Dates, paid flags and milestones are manually maintained.');
 // Link operational context into the existing exact-payment rows, without converting numeric planning output to money.
 for(let i=0;i<5;i++){const r=10+i,p=9+i;
  put(live,r,7,`=IF(${ref(plan,`A${p}`)}="","",${ref(plan,`A${p}`)})`);
  if(payroll||invoices||grants){const col=payroll?'E':'F';put(live,r,2,`=IF(${ref(plan,`${col}${p}`)}="","",${ref(plan,`${col}${p}`)})`);}
  put(live,r,4,`=${ref(plan,'$B$4')}`);
 }
 const receipts=append(book,sheet('Receipts',[240,350,250,240]));
 band(receipts,1,'Payment submission receipts',true);band(receipts,2,'Local attempts and transaction hashes. Confirmed proposal submission is not proof of payment settlement.');
 for(let i=0;i<5;i++){const r=10+i,anchor=5+i*5;band(receipts,anchor-1,'Payment row '+r,true);
 const missing=['$B$3','$B$4',`A${r}`,`B${r}`,`C${r}`,`D${r}`].map(a=>`${ref(live,a)}=""`).join(',');
 put(receipts,anchor,1,`=IF(OR(${missing}),"Enter payment inputs",NS_RECEIPT(${ref(live,`E${r}`)}))`);
 }
 finish(s,`Open ${plan.name} to build your plan, then Payments to enter exact approved amounts and review proposals.`);numericSummary(s);
 // Planning is the first live sheet; the example remains first overall.
 book.sheetOrder=book.sheetOrder.filter(key=>key!==plan.id);book.sheetOrder.unshift(plan.id!);
 return s;
}

function swaps(book:WorkbookSnapshot,live:Sheet){
 const s=example('Cross-chain payouts · NEAR Intents','Compare payout scenarios, inspect a route, and prepare a treasury-funded proposal deliberately.');
 head(s,8,['Scenario','Input Token A','Output Token B','Minimum output','Output per input']);
 for(let i=0;i<3;i++){const r=9+i;put(s,r,1,['Small payout','Team payout','Large payout'][i]!,true);put(s,r,2,[100,500,1000][i]!,true);put(s,r,3,[99,497,993][i]!,true);put(s,r,4,`=C${r}*0.99`);put(s,r,5,`=IF(B${r}=0,0,C${r}/B${r})`);}
 metric(s,1,'Example slippage (%)',1);metric(s,3,'Scenarios',3);put(s,4,5,'Route states');put(s,5,5,'Estimate → Review');
 band(s,15,'These invented quotes demonstrate comparison math. They are not market rates or executable routes.');
 finish(s,'Open International payout to configure the route; use Compare quotes for three live amount scenarios.');
 const compare=append(book,sheet('Compare quotes'));
 const estimates=append(book,sheet('Quote details',[280,340,220]));
 band(compare,1,'Compare live Intents estimates',true);band(compare,2,'Uses the origin, output asset and destination from International payout. Enter exact input amounts below.');
 head(compare,8,['Scenario','Input amount','Output amount','Minimum received','Expiry','Output/input · approx.']);
 for(let i=0;i<3;i++){const r=9+i,anchor=3+i*19;put(compare,r,1,['Small','Medium','Large'][i]!,true);put(compare,r,2,'',true);
 const config=['B3','B5','B6','B7','B8','B10'].map(a=>`${ref(live,a)}=""`).join(',');
 const guard=`OR(${ref(compare,`B${r}`)}="",${config})`;
 band(estimates,anchor-1,`Scenario ${i+1} · dry estimate`,true);
 put(estimates,anchor,1,`=IF(${guard},"Enter route and scenario amount",INTENTS_QUOTE(${ref(live,'B5')},${ref(live,'B6')},${ref(compare,`B${r}`)},${ref(live,'B7')},${ref(live,'B8')},${ref(live,'B3')},VALUE(${ref(live,'B10')})))`);
 for(const [col,offset] of [[3,2],[4,3],[5,6]] as const)put(compare,r,col,`=IF(OR(B${r}="",${config}),"",IF(${ref(estimates,`A${anchor}`)}="Estimate · no funding instructions",${ref(estimates,`B${anchor+offset}`)},${ref(estimates,`A${anchor}`)}))`);
 put(compare,r,6,`=IF(OR(B${r}="",C${r}=""),"",VALUE(C${r})/VALUE(B${r}))`);
 }
 band(compare,15,'Estimates have separate timestamps and expiry. Output/input ratios are approximate; output amounts preserve all returned digits.');
 band(compare,16,'Enter the chosen amount in International payout B9. Review B17 to explicitly prepare deposit instructions.');
 const tracking=append(book,sheet('Payout tracking',[240,350,250,240]));
 band(tracking,1,'Payout tracking',true);band(tracking,2,'Treasury submission and provider progress are separate stages. A submitted proposal still awaits approval.');
 const missing=['B3','B4','B5','B6','B7','B8','B9','B10','B11'].map(a=>`${ref(live,a)}=""`).join(',');
 band(tracking,4,'Local submission receipt',true);put(tracking,5,1,`=IF(OR(${missing}),"Enter payout inputs",NS_RECEIPT(${ref(live,'B17')}))`);
 band(tracking,7,'Intents provider progress',true);put(tracking,8,1,`=IF(OR(${missing}),"Enter payout inputs",INTENTS_STATUS(${ref(live,'B17')}))`);
 return s;
}

function treasury(book:WorkbookSnapshot,live:Sheet){
 const s=example('Treasury overview','Understand reserves and planned spending before proposing a treasury operation.');
 head(s,8,['Asset','Balance (sample)','Reserve target','Planned spending','After plan','Reserve gap']);
 for(let i=0;i<2;i++){const r=9+i;put(s,r,1,['NEAR','Token A'][i]!);put(s,r,2,[800,10000][i]!,true);put(s,r,3,[200,3000][i]!,true);put(s,r,4,[150,8000][i]!,true);put(s,r,5,`=B${r}-D${r}`);put(s,r,6,`=MAX(0,C${r}-E${r})`);}
 put(s,4,1,'NEAR after plan');put(s,5,1,'=E9');put(s,4,3,'Token A reserve gap');put(s,5,3,'=F10');put(s,4,5,'Units');put(s,5,5,'Kept separate');
 finish(s,'Open Treasury for live balances and proposals. Staking prepares a compatible pool proposal from that treasury.');
 const stake=append(book,sheet('Staking'));
 band(stake,1,'Prepare a treasury staking proposal',true);band(stake,2,'Uses the treasury and network entered on Treasury. Compatible deposit_and_stake pools only.');
 input(stake,4,'Staking pool account');input(stake,5,'Amount (NEAR)');input(stake,6,'Unique action reference');
 const guard=`OR(B4="",B5="",B6="",${ref(live,'B4')}="",${ref(live,'B5')}="")`;
 put(stake,9,1,'Proposal draft');put(stake,9,2,`=IF(${guard},"Enter treasury, pool, amount and reference",SPUTNIK_STAKE(B6,${ref(live,'B4')},B4,B5,${ref(live,'B5')}))`);
 put(stake,10,1,'Local submission');put(stake,10,2,`=IF(${guard},"",NS_STATUS(B9))`);
 band(stake,13,'Select B9 and review the exact call before signing. Proposal submission is not completed staking.');
 return s;
}

function approvals(book:WorkbookSnapshot,live:Sheet){
 const s=example('Proposal review','Review a queue of proposals, then prepare explicit approval, rejection or removal votes.');
 head(s,8,['Proposal','Purpose','State (sample)','Your decision']);
 ['Tooling','Research grant','Team payment'].forEach((name,i)=>{const r=9+i;put(s,r,1,41+i);put(s,r,2,name);put(s,r,3,['InProgress','Approved','InProgress'][i]!);put(s,r,4,'',true);});
 metric(s,1,'Open proposals','=COUNTIF(C9:C11,"InProgress")');metric(s,3,'Approved','=COUNTIF(C9:C11,"Approved")');metric(s,5,'Queue size','=COUNTA(B9:B11)');
 finish(s,'Open Proposals for chain data. Use Decisions to enter a proposal ID and the vote you intend to sign.');
 const votes=append(book,sheet('Decisions'));
 band(votes,1,'Treasury proposal decisions',true);band(votes,2,'Uses the account and network on Proposals. Voting permission and the current proposal are checked at review.');
 head(votes,8,['Unique reference','Proposal ID','Vote decision','Vote draft','Local status']);
 for(let r=9;r<=13;r++){for(let c=1;c<=3;c++)put(votes,r,c,'',true);const guard=`OR(A${r}="",B${r}="",C${r}="",${ref(live,'B3')}="",${ref(live,'B4')}="")`;put(votes,r,4,`=IF(${guard},"Enter vote inputs",SPUTNIK_VOTE(A${r},${ref(live,'B3')},VALUE(B${r}),C${r},${ref(live,'B4')}))`);put(votes,r,5,`=IF(${guard},"",NS_STATUS(D${r}))`);}
 band(votes,16,'Decision values: VoteApprove, VoteReject or VoteRemove. Select the prepared vote cells to review.');
 band(votes,17,'A confirmed vote does not establish that an underlying payment settled. Proposal reads show only the first 100.');
 return s;
}


/** Public defaults are read-only examples; action inputs stay blank. */
export function designTemplate(id:TemplateId,book:WorkbookSnapshot):WorkbookSnapshot {
 if(id==='getting-started')return book;
 const live=book.sheets[book.sheetOrder[0]!]!;
 live.columnData=Object.fromEntries([230,250,200,220,260,220,220,180].map((w,i)=>[i,{w}]));
 if(id==='account-balances') {
  portfolio(live);put(live,4,2,'mainnet',true);put(live,5,2,'usdt.tether-token.near',true);input(live,6,'Token 2 contract (USDC)', '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1');put(live,5,1,'Token 1 contract (USDT)');
  ['v2.ref-finance.near','intents.near','ref-finance.sputnik-dao.near'].forEach((account,i)=>put(live,8+i,1,account,true));
  band(live,1,'Live portfolio & balances',true);band(live,2,'NEAR, USDT and USDC across public DeFi accounts. Edit any account or token contract to recalculate.');
 } else if(id==='international-payouts') {
  swaps(book,live);
  const route=append(book,sheet('Quote route'));
  band(route,1,'NEAR Intents · live quote route',true);band(route,2,'Read-only quote configuration. The destination below is a quote-only placeholder; enter your own address to estimate.');
  input(route,3,'Quote refund account','near');input(route,5,'Origin asset','nep141:wrap.near');
  input(route,6,'Output asset','nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near');
  input(route,7,'Output chain','eth');input(route,8,'Quote-only recipient','0x0000000000000000000000000000000000000001');input(route,10,'Slippage (basis points)',100);
  band(route,13,'Open Compare quotes to see real estimates. These reads never allocate deposit instructions.');
  band(route,14,'To act: enter your treasury, intended recipient and amount separately in International payout.');
  const details=book.sheets[book.sheetOrder.find(key=>book.sheets[key]!.name==='Quote details')!]!;
  const compare=book.sheets[book.sheetOrder.find(key=>book.sheets[key]!.name==='Compare quotes')!]!;
  for(const row of Object.values(details.cellData!))for(const cell of Object.values(row??{}) as ICellData[])if(cell?.f)cell.f=cell.f.replaceAll("'International payout'!","'Quote route'!");
  for(const row of Object.values(compare.cellData!))for(const cell of Object.values(row??{}) as ICellData[])if(cell?.f)cell.f=cell.f.replaceAll("'International payout'!","'Quote route'!");
  [1,5,10].forEach((amount,i)=>put(compare,9+i,2,String(amount),true));
  band(compare,2,'Live wNEAR → USDC on Ethereum estimates. Edit amounts here; change assets and addresses on Quote route.');
  book.sheetOrder=book.sheetOrder.filter(key=>key!==compare.id);book.sheetOrder.unshift(compare.id!);
 } else if(id==='treasury-overview'||id==='dao-proposals') {
  if(id==='treasury-overview'){treasury(book,live);put(live,4,2,'ref-finance.sputnik-dao.near',true);put(live,5,2,'mainnet',true);}
  else {approvals(book,live);put(live,3,2,'ref-finance.sputnik-dao.near',true);put(live,4,2,'mainnet',true);band(live,1,'Live proposal review',true);}
  band(live,2,'Public Ref Finance treasury · read-only starting point. Change to your treasury for your own workflow.');
 } else {
  payments(book,live,id);
  const plan=book.sheets[book.sheetOrder[0]!]!;
  const funding=append(book,sheet('Funding'));
  band(funding,1,book.name+' · treasury funding',true);
  band(funding,2,'Live public treasury example. Enter your own treasury here to assess funds; configure Payments separately.');
  input(funding,4,'Read-only treasury','ref-finance.sputnik-dao.near');input(funding,5,'Network','mainnet');input(funding,6,'Token contract','wrap.near');
  head(funding,8,['Asset','Live balance']);
  put(funding,9,1,'NEAR');put(funding,9,2,'=IF(OR(B4="",B5=""),"Enter treasury",NEAR_BALANCE(B4,B5))');
  put(funding,10,1,'=B6');put(funding,10,2,'=IF(OR(B4="",B5="",B6=""),"Enter token",FT_BALANCE(B6,B4,B5))');
  put(funding,13,1,'Planning asset');put(funding,13,2,'='+ref(plan,'B4'));
  put(funding,14,1,'Planned amount (approx.)');put(funding,14,2,'=SUM('+ref(plan,id==='community-budget'?'C9:C13':id==='invoices-expenses'?'E9:E13':'D9:D13')+')');
  put(funding,15,1,'Balance less plan (approx.)');put(funding,15,2,'=IF(B13="near",B9-B14,IF(B13=B6,B10-B14,"Select matching planning asset"))');
  band(funding,18,'Select a balance and choose Blockchain → Inspect for full precision and source details.');
  band(funding,17,'A balance is not fully spendable. Storage, proposal bonds and fees require reserves.');
  band(funding,19,'Next: '+plan.name+' → Payments → review selected drafts → Receipts. Public accounts do not imply signing permission.');
  book.sheetOrder=book.sheetOrder.filter(key=>key!==funding.id);book.sheetOrder.unshift(funding.id!);
 }
 return book;
}
