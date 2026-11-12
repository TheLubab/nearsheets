import type { CellLocation } from './cell-diagnostics';
export const cellKey=(cell:CellLocation)=>JSON.stringify([cell.unitId,cell.sheetId,cell.row,cell.column]);
export interface CalculationContext { cell:CellLocation; formula:string; keys:Set<string>; args:unknown[]; rows:number; columns:number; token:symbol }
/** Session-owned evidence links. Multiple calls inside one formula share an anchor. */
export class ReadBindings {
 private cycle=0;
 private entries=new Map<string,{cycle:number;formula:string;calls:Map<string,CalculationContext>}>();
 nextCalculation(){this.cycle++;}
 begin(cell:CellLocation,formula:string,args:unknown[],name=''):CalculationContext {
  const key=cellKey(cell);let entry=this.entries.get(key);
  if(!entry||entry.cycle!==this.cycle||entry.formula!==formula){entry={cycle:this.cycle,formula,calls:new Map()};this.entries.set(key,entry);}
  const context={cell,formula,args,keys:new Set<string>(),rows:1,columns:1,token:Symbol()};
  entry.calls.set(name+' '+JSON.stringify(args),context);return context;
 }
 current(context:CalculationContext){return [...(this.entries.get(cellKey(context.cell))?.calls.values()??[])].includes(context);}
 all(){return [...this.entries.values()].flatMap(e=>[...e.calls.values()]);}
 forCell(cell:CellLocation) {return [...this.entries.values()].flatMap(e=>[...e.calls.values()]).filter(b=>b.cell.unitId===cell.unitId&&b.cell.sheetId===cell.sheetId&&cell.row>=b.cell.row&&cell.row<b.cell.row+b.rows&&cell.column>=b.cell.column&&cell.column<b.cell.column+b.columns);}
 prune(readFormula:(cell:CellLocation)=>string) {for(const [key,entry] of this.entries){const first=entry.calls.values().next().value;if(first&&readFormula(first.cell)!==entry.formula)this.entries.delete(key);}}
 clear(){this.entries.clear();this.cycle++;}
}
