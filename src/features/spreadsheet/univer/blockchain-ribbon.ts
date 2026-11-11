import { createElement } from 'react';
import { WalletMoneyIcon } from '@solar-icons/react/linear/wallet-money';
import { ClipboardListIcon } from '@solar-icons/react/linear/clipboard-list';
import { TransferHorizontalIcon } from '@solar-icons/react/linear/transfer-horizontal';
import { CodeSquareIcon } from '@solar-icons/react/linear/code-square';
import { ChecklistIcon } from '@solar-icons/react/linear/checklist';
import { RefreshIcon } from '@solar-icons/react/linear/refresh';
import { InfoCircleIcon } from '@solar-icons/react/linear/info-circle';
import { CommandType, ICommandService } from '@univerjs/core';
import type { Univer } from '@univerjs/core';
import type { FUniver } from '@univerjs/core/facade';
import { IMenuManagerService, MenuItemType, IconManager } from '@univerjs/preset-sheets-core';
import type { MenuSchemaType } from '@univerjs/preset-sheets-core';

export const BLOCKCHAIN_CATEGORIES = [
  {key:'accounts',title:'Balances',entries:[['NEAR_BALANCE','NEAR_BALANCE'],['FT_BALANCE','FT_BALANCE'],['NEAR_BALANCE_EXACT','NEAR_BALANCE_EXACT'],['FT_BALANCE_EXACT','FT_BALANCE_EXACT']]},
  {key:'dao',title:'DAO proposals',entries:[['SPUTNIK_PROPOSALS','SPUTNIK_PROPOSALS'],['SPUTNIK_TRANSFER','SPUTNIK_TRANSFER'],['SPUTNIK_VOTE','SPUTNIK_VOTE']]},
  {key:'swaps',title:'Cross-chain swaps',entries:[['INTENTS_QUOTE','INTENTS_QUOTE'],['INTENTS_SWAP','INTENTS_SWAP']]},
  {key:'contracts',title:'Contracts & staking',entries:[['NEAR_VIEW','NEAR_VIEW'],['SPUTNIK_CALL','SPUTNIK_CALL'],['SPUTNIK_STAKE','SPUTNIK_STAKE']]},
  {key:'results',title:'Action results',entries:[['NS_FIELD','NS_FIELD'],['NS_STATUS','NS_STATUS'],['NS_RECEIPT','NS_RECEIPT'],['INTENTS_STATUS','INTENTS_STATUS']]},
] as const;
export const BLOCKCHAIN_TOOLS = [
  ...BLOCKCHAIN_CATEGORIES.map(category=>({key:category.key,title:category.title,group:'functions',command:'',hint:'Choose a function to insert',entries:category.entries})),
  {key:'refresh',title:'Refresh',group:'manage',command:'refresh',hint:'Refresh blockchain data without signing'},
  {key:'details',title:'Details',group:'manage',command:'inspect',hint:'Inspect cell data and transaction receipts'},
  {key:'review',title:'Review actions',group:'execute',command:'review',hint:'Select action cells to review exact calls before signing'},
];
export const ribbonCommandId=(key:string)=>'nearsheets.blockchain.'+key;

export function registerBlockchainRibbon(univer:Univer,api:FUniver) {
  const injector=univer.__getInjector();
  const commands=injector.get(ICommandService),menus=injector.get(IMenuManagerService),icons=injector.get(IconManager);
  const groups:Record<string,MenuSchemaType>={};
  const symbols={accounts:WalletMoneyIcon,dao:ClipboardListIcon,swaps:TransferHorizontalIcon,contracts:CodeSquareIcon,results:ChecklistIcon,refresh:RefreshIcon,details:InfoCircleIcon};
  const iconRegistrations=BLOCKCHAIN_TOOLS.flatMap(tool=>{
    if(tool.key==='review')return [];
    const Symbol=symbols[tool.key as keyof typeof symbols];
    return [icons.register(ribbonCommandId(tool.key)+'.visual',()=>createElement(Symbol,{size:16,strokeWidth:1.5,'aria-hidden':true}))];
  });
  const disposables=BLOCKCHAIN_TOOLS.map((tool,index)=>{
    const group='ribbon.blockchain.'+tool.group;
    const entries=groups[group]??={order:['functions','manage','execute'].indexOf(tool.group)};
    (entries as Record<string,MenuSchemaType>)[ribbonCommandId(tool.key)]={order:index,menuItemFactory:()=>({
      id:ribbonCommandId(tool.key),
      ...('entries' in tool?{type:MenuItemType.SELECTOR,commandId:ribbonCommandId(tool.key),selections:tool.entries.map(([value,label])=>({value,label:{name:label,selectable:false}}))}:{type:MenuItemType.BUTTON}),
      ...(tool.key==='review'?{}:{icon:ribbonCommandId(tool.key)+'.visual'}),title:tool.title,tooltip:tool.hint,
    })};
    return commands.registerCommand({id:ribbonCommandId(tool.key),type:CommandType.OPERATION,handler:(_accessor,params)=>{
      let detail=tool.command;
      if('entries' in tool) {
        const value=(params as {value?:unknown}|undefined)?.value;
        if(!tool.entries.some(([name])=>name===value))return false;
        detail='function:'+value;
      }
      window.dispatchEvent(new CustomEvent('nearsheets:command',{detail}));return true;
    }});
  });
  menus.mergeMenu({ribbon:{'ribbon.blockchain':{order:5,title:'Blockchain',...groups}}});
  api.updateMenuConfig(Object.fromEntries(BLOCKCHAIN_TOOLS.map(tool=>[ribbonCommandId(tool.key),{disabled:true}])));
  return {dispose:()=>[...disposables,...iconRegistrations].forEach(item=>item.dispose())};
}
