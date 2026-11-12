import { afterEach,describe,expect,it,vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FunctionMenu } from '../src/features/table/FunctionMenu';
import type { Workflow } from '../src/features/table/function-registry';
import { env } from '../src/config/env';

afterEach(()=>vi.unstubAllGlobals());
function render(category:Workflow,recents:string[]=[]) {
 vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(recents)});
 return renderToStaticMarkup(createElement(FunctionMenu,{category,onChange:()=>{}}));
}
describe('Blockchain function menu',()=>{
 it('shows human titles and descriptions without implementation names',()=>{
  const markup=render('Read data');
  expect(markup).toContain('NEAR balance');
  expect(markup).toContain('Read an account balance');
  expect(markup).not.toContain('NEAR_BALANCE');
  expect(markup).not.toContain('SPUTNIK_');
 });
 it('moves recent functions to the top without labelling them',()=>{
  const markup=render('Prepare action',['SPUTNIK_TRANSFER','SPUTNIK_VOTE','SPUTNIK_STAKE']);
  expect(markup).not.toContain('Recent');
  expect(markup).not.toContain('function-menu__divider');
  const positions=['DAO transfer proposal','DAO vote','DAO staking proposal','DAO contract-call proposal','DAO swap proposal'].map(title=>markup.indexOf(title));
  expect(positions.every(position=>position>=0)).toBe(true);
  expect([...positions].sort((a,b)=>a-b)).toEqual(positions);
 });
 it('never repeats the long setup explanation inside the menu',()=>{
  const markup=render('Prepare action');
  expect(markup).not.toContain('Configure the public Intents provider');
  if(!env.VITE_INTENTS_API_URL) {
   expect(markup).toContain('Setup required');
  }
 });
});