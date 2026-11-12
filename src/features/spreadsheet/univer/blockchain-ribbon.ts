import { FunctionMenu } from '../../table/FunctionMenu';
import { searchFunctions } from '../../table/function-registry';
import type { Workflow } from '../../table/function-registry';
import { createElement } from 'react';
import { WalletMoneyIcon } from '@solar-icons/react/linear/wallet-money';
import { ClipboardListIcon } from '@solar-icons/react/linear/clipboard-list';
import { ChecklistIcon } from '@solar-icons/react/linear/checklist';
import { RefreshIcon } from '@solar-icons/react/linear/refresh';
import { InfoCircleIcon } from '@solar-icons/react/linear/info-circle';
import { CommandType, ICommandService } from '@univerjs/core';
import type { Univer } from '@univerjs/core';
import type { FUniver } from '@univerjs/core/facade';
import { IMenuManagerService, MenuItemType, IconManager, ComponentManager } from '@univerjs/preset-sheets-core';
import type { MenuSchemaType } from '@univerjs/preset-sheets-core';

export const BLOCKCHAIN_CATEGORIES = ([['read','Read data'],['prepare','Prepare action'],['track','Track results']] as const).map(([key,title])=>({key,title,entries:searchFunctions(title,'').map(f=>[f.name,f.title] as const)}));
export const BLOCKCHAIN_TOOLS = [
 ...BLOCKCHAIN_CATEGORIES.map(category=>({key:category.key,title:category.title,group:'functions',command:'',hint:'Discover functions and edit arguments',entries:category.entries})),
 {key:'refresh',title:'Refresh',group:'manage',command:'refresh',hint:'Refresh reads without signing',entries:[['selected','Refresh selected reads'],['all','Refresh all workbook data']] as readonly (readonly [string,string])[]},
 {key:'details',title:'Inspect',group:'manage',command:'inspect',hint:'Inspect selected cells and transaction receipts'},
 {key:'review',title:'Review actions',group:'execute',command:'review',hint:'Review every selected action before choosing a subset'},
];
export const ribbonCommandId=(key:string)=>'nearsheets.blockchain.'+key;

export function registerBlockchainRibbon(univer:Univer,api:FUniver) {
  const injector=univer.__getInjector();
  const commands=injector.get(ICommandService),menus=injector.get(IMenuManagerService),icons=injector.get(IconManager);
  const components=injector.get(ComponentManager);
  const panels=BLOCKCHAIN_CATEGORIES.map(category=>components.register(ribbonCommandId(category.key)+'.menu',FunctionMenu));
  const groups:Record<string,MenuSchemaType>={};
  const symbols={read:WalletMoneyIcon,prepare:ClipboardListIcon,track:ChecklistIcon,refresh:RefreshIcon,details:InfoCircleIcon};
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
      ...(tool.entries?{type:MenuItemType.SELECTOR,commandId:ribbonCommandId(tool.key),selections:tool.group==='functions'?[{label:{name:ribbonCommandId(tool.key)+'.menu',hoverable:false,selectable:false,props:{embedded:true,category:tool.title as Workflow}}}]:tool.entries.map(([value,label])=>({value,label:{name:label,selectable:false}}))}:{type:MenuItemType.BUTTON}),
      ...(tool.key==='review'?{}:{icon:ribbonCommandId(tool.key)+'.visual'}),title:tool.title,tooltip:tool.hint,
    })};
    return commands.registerCommand({id:ribbonCommandId(tool.key),type:CommandType.OPERATION,handler:(_accessor,params)=>{
      let detail=tool.command;
      if(tool.entries) {
        const value=(params as {value?:unknown}|undefined)?.value;
        if(!tool.entries.some(([name])=>name===value) && !(typeof value==='string'&&value.endsWith('_EXACT')&&tool.key==='read'))return false;
        detail=tool.key==='refresh'?'refresh:'+value:'function:'+value;
      }
      window.dispatchEvent(new CustomEvent('nearsheets:command',{detail}));return true;
    }});
  });
  menus.mergeMenu({ribbon:{'ribbon.blockchain':{order:5,title:'Blockchain',...groups}}});
  api.updateMenuConfig(Object.fromEntries(BLOCKCHAIN_TOOLS.map(tool=>[ribbonCommandId(tool.key),{disabled:true}])));
  return {dispose:()=>[...disposables,...iconRegistrations,...panels].forEach(item=>item.dispose())};
}
