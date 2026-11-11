import type { Problem } from './problems';

export interface CellLocation { unitId: string; sheetId: string; row: number; column: number }
const keyOf = (cell: CellLocation) => JSON.stringify([cell.unitId,cell.sheetId,cell.row,cell.column]);
interface Evaluation { formula: string; cycle: number; requests: Map<string,symbol>; problems: Map<string,Problem> }

/** Ephemeral diagnostics: never restore an old network failure as current truth. */
export class CellDiagnostics {
  private cycle = 0;
  private cells = new Map<string,Evaluation>();
  private listeners = new Set<()=>void>();
  nextCalculation() { this.cycle++; }
  subscribe(listener:()=>void) { this.listeners.add(listener);return {dispose:()=>{this.listeners.delete(listener);}}; }
  private changed() { this.listeners.forEach(listener=>listener()); }
  begin(cell:CellLocation, formula:string, invocation:string) {
    const key=keyOf(cell);
    let evaluation=this.cells.get(key);
    if (!evaluation || evaluation.formula!==formula || evaluation.cycle!==this.cycle) {
      evaluation={formula,cycle:this.cycle,requests:new Map(),problems:new Map()};
      this.cells.set(key,evaluation);
    }
    const token=Symbol();evaluation.requests.set(invocation,token);
    const current=evaluation;
    this.changed();
    return (problem?:Problem) => {
      if(this.cells.get(key)!==current || current.requests.get(invocation)!==token)return;
      if(problem)current.problems.set(invocation,problem);else current.problems.delete(invocation);
      this.changed();
    };
  }
  get(cell:CellLocation, formula:string, value:unknown):Problem[] {
    const evaluation=this.cells.get(keyOf(cell));
    if(!evaluation || evaluation.formula!==formula)return [];
    // IFERROR and other handlers may consume an inner failure successfully.
    return [...evaluation.problems.values()].filter(problem=>problem.cellError===value);
  }
  clear() { this.cells.clear();this.cycle++;this.changed(); }
}
