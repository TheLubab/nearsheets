import { afterEach,describe,expect,it,vi } from 'vitest';
import { Univer,IConfigService,ICommandService,ILogService } from '@univerjs/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FUniver } from '@univerjs/core/facade';
import { IMenuManagerService,MenuManagerService,IconManager } from '@univerjs/preset-sheets-core';
import { registerBlockchainRibbon,ribbonCommandId } from '../src/features/spreadsheet/univer/blockchain-ribbon';

afterEach(()=>vi.unstubAllGlobals());
function fixture() {
 const univer=new Univer();
 const injector=univer.__getInjector();
 const menus=new MenuManagerService(injector,injector.get(IConfigService));
 injector.add([IMenuManagerService,{useValue:menus}]);
 const icons=new IconManager(injector.get(ILogService));
 injector.add([IconManager,{useValue:icons}]);
 const api={updateMenuConfig:(config:Parameters<MenuManagerService['updateMenuConfig']>[0])=>menus.updateMenuConfig(config)} as unknown as FUniver;
 const registration=registerBlockchainRibbon(univer,api);
 return {menus,icons,commands:injector.get(ICommandService),dispose:()=>{registration.dispose();univer.dispose();}};
}
describe('native Blockchain ribbon integration',()=>{
 it('exposes a native tab with direct commands in separate groups, not a nested dropdown',()=>{
  const {menus,dispose}=fixture();
  const tab=menus.getMenuByPositionKey('ribbon').find(item=>item.key==='ribbon.blockchain');
  expect(tab?.title).toBe('Blockchain');expect(tab?.item).toBeUndefined();
  expect(tab?.children).toHaveLength(3);
  const tools=menus.getFlatMenuByPositionKey('ribbon.blockchain');
  expect(tools.some(tool=>tool.item?.id===ribbonCommandId('dao'))).toBe(true);
  expect(tools.some(tool=>tool.item?.id===ribbonCommandId('review'))).toBe(true);
  dispose();
 });
 it('exposes all function choices through native dropdowns and registers Solar visuals',()=>{
  const {menus,icons,dispose}=fixture();
  const tools=menus.getFlatMenuByPositionKey('ribbon.blockchain.functions');
  expect(tools).toHaveLength(5);
  const dao=tools.find(tool=>tool.item?.id===ribbonCommandId('dao'))?.item;
  expect(dao?.type).toBe(1);
  if(dao && 'selections' in dao)expect(dao.selections).toEqual(expect.arrayContaining([expect.objectContaining({value:'SPUTNIK_TRANSFER',label:{name:'SPUTNIK_TRANSFER',selectable:false}})]));
  const visual=ribbonCommandId('accounts')+'.visual';
  expect(icons.has(visual)).toBe(true);
  const markup=renderToStaticMarkup(createElement(icons.get(visual)));
  expect(markup).toContain('<svg');expect(markup).not.toContain('Balances');
  dispose();expect(icons.has(visual)).toBe(false);
 });
 it('dispatches guided insertion/review intent without signing or directly executing actions',()=>{
  const events=new EventTarget();vi.stubGlobal('window',events);
  const onCommand=vi.fn();events.addEventListener('nearsheets:command',onCommand);
  const {commands,dispose}=fixture();
  commands.syncExecuteCommand(ribbonCommandId('accounts'),{value:'NEAR_BALANCE'});
  expect((onCommand.mock.calls[0]?.[0] as CustomEvent).detail).toBe('function:NEAR_BALANCE');
  expect(commands.syncExecuteCommand(ribbonCommandId('accounts'),{value:'INVALID'})).toBe(false);
  expect(onCommand).toHaveBeenCalledTimes(1);
  commands.syncExecuteCommand(ribbonCommandId('review'));
  expect((onCommand.mock.calls[1]?.[0] as CustomEvent).detail).toBe('review');
  dispose();
 });
});
