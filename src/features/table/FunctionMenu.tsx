import { useState } from 'react';
import { availability, getFunction, recentFunctions, searchFunctions } from './function-registry';
import type { FunctionDefinition, Workflow } from './function-registry';
import { env } from '../../config/env';
/** Embedded in Univer's native selector. onChange lets Univer dismiss and restore focus. */
export function FunctionMenu({category,onChange}:{category:Workflow;onChange(value:string):void}) {
 const [search,setSearch]=useState('');
 const entries=searchFunctions(category,search),recent=search?'':recentFunctions(category);
 const ordered=recent?[...recent.flatMap(id=>{const entry=getFunction(id);return entry?[entry]:[]}),...entries.filter(f=>!recent.includes(f.name))]:entries;
 const item=(f:FunctionDefinition)=>{const reason=availability(f,!!env.VITE_INTENTS_API_URL);return <button key={f.name} type="button" aria-disabled={!!reason} onClick={()=>onChange(f.name)}>
  <span className="function-menu__title"><strong>{f.title}</strong>{reason&&<em className="function-menu__badge">Setup required</em>}</span>
  <span className="function-menu__description">{f.description}</span>
 </button>;};
 return <div className="function-menu" onKeyDown={event=>{
  if(event.key==='Escape')return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp') {event.preventDefault();const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('input,button:not(:disabled)')];const index=controls.indexOf(document.activeElement as HTMLElement);controls[(index+(event.key==='ArrowDown'?1:controls.length-1))%controls.length]?.focus();}
  event.stopPropagation();
 }}>
  <input aria-label={`Search ${category.toLowerCase()}`} placeholder="Search functions…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>
  <div className="function-menu__scroll" role="group" aria-label={category}>
   {ordered.map(item)}
  </div>
  {!entries.length&&<p className="function-menu__empty">No matching functions.</p>}
 </div>;
}
