import { ArrayValueObject, BaseFunction, ErrorValueObject, StringValueObject, NumberValueObject, BooleanValueObject, NullValueObject, ErrorType } from '@univerjs/engine-formula';
import type { BaseValueObject } from '@univerjs/engine-formula';
import type { CellLocation } from '../../table/cell-diagnostics';
import { TABLE_FUNCTIONS } from '../../table/runtime';
import type { TableRuntime, TableResult } from '../../table/runtime';
import { invalidInput, toProblem } from '../../table/problems';

function resultObject(value:TableResult):BaseValueObject {
  // Bypass facade string parsing: exact decimal text stays text without quoting.
  if(Array.isArray(value))return ArrayValueObject.create({calculateValueList:value.map(row=>row.map(resultObject)),rowCount:value.length,columnCount:value[0]?.length ?? 0,unitId:'',sheetId:'',row:-1,column:-1});
  if(typeof value==='string')return StringValueObject.create(value);
  if(typeof value==='number')return NumberValueObject.create(value);
  if(typeof value==='boolean')return BooleanValueObject.create(value);
  return NullValueObject.create();
}

/** Network work runs outside Univer's sequential evaluator. Pending cells are real errors,
 * so dependent arithmetic never mistakes a loading read for zero. */
export function createTableFunctionCatalog(runtime:TableRuntime, readFormula:(cell:CellLocation)=>string, onResult:(cells:CellLocation[])=>void) {
  type Entry={cell:CellLocation;formula:string;context:ReturnType<typeof runtime.bindings.begin>;result?:BaseValueObject;problem?:ReturnType<typeof toProblem>;at:number};
  const entries=new Map<string,Entry>();
  const touched=new Set<string>(),seen=new Set<string>();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const completed=new Map<string,CellLocation>();
  const notify=(cell:CellLocation)=>{completed.set(JSON.stringify(cell),cell);if(timer===undefined)timer=setTimeout(()=>{timer=undefined;const cells=[...completed.values()];completed.clear();onResult(cells);},20);};
  runtime.onRefresh((keys,stopped)=>{
    if(stopped){
      for(const entry of entries.values())if(!entry.result){
        entry.problem={code:"read-stopped",title:"Read stopped",message:"The read was stopped.",recovery:"Use Blockchain → Refresh to try again.",cellError:"#N/A"};
        entry.result=ErrorValueObject.create(ErrorType.NA,entry.problem.message+" "+entry.problem.recovery);
        entry.at=Date.now();notify(entry.cell);
      }
      return;
    }
    for(const [key,entry] of entries)if(!keys || [...entry.context.keys].some(key=>keys.has(key)))entries.delete(key);
    if(!keys && timer!==undefined){clearTimeout(timer);timer=undefined;completed.clear();}
  });
  const prune=(obsolete:(key:string,entry:Entry)=>boolean=()=>false)=>{
    const unused=new Set<string>();
    for(const [key,entry] of entries)if(readFormula(entry.cell)!==entry.formula || obsolete(key,entry)){entries.delete(key);entry.context.keys.forEach(key=>unused.add(key));}
    for(const entry of entries.values())entry.context.keys.forEach(key=>unused.delete(key));
    for(const key of unused)void runtime.query.cancelQueries({queryKey:JSON.parse(key),exact:true});
  };
  const functions=TABLE_FUNCTIONS.map(([name])=> {
    class TableFunction extends BaseFunction {
      override calculate(...variants:BaseValueObject[]):BaseValueObject {
        const cell={unitId:this.unitId ?? '',sheetId:this.subUnitId ?? '',row:this.row,column:this.column};
        const formula=readFormula(cell);
        touched.add(JSON.stringify(cell));
        const args=variants.map(value=>value.isArray() ? (value as ArrayValueObject).toValue() : value.getValue());
        const invocation=name+' '+JSON.stringify(args);
        const finish=runtime.diagnostics.begin(cell,formula,invocation);
        for(const variant of variants) {
          const value=variant.isArray() && (variant as ArrayValueObject).getRowCount()===1 && (variant as ArrayValueObject).getColumnCount()===1
            ? (variant as ArrayValueObject).getFirstCell() : variant;
          if(value.isError()){finish();return value;}
          if(value.isArray()){
            const problem=toProblem(invalidInput('This argument requires a single value or cell reference.'));
            finish(problem);return ErrorValueObject.create(problem.cellError as ErrorType,problem.message);
          }
        }
        // Receipt/field helpers must observe changed journal and action revisions too.
        const operation=runtime.operations.get(String(args[0]));
        const state=name.startsWith('NS_') || name==='INTENTS_STATUS' ? JSON.stringify([operation?.revision,operation?runtime.executions[operation.id]:null]) : '';
        const key=JSON.stringify([cell,formula,invocation,state]);
        seen.add(key);
        let entry=entries.get(key);
        const ttl=name.startsWith('INTENTS_')?5000:30_000;
        if(entry?.result && entry.problem?.code!=='read-stopped' && Date.now()-entry.at>=ttl){entries.delete(key);entry=undefined;}
        if(entry){runtime.bindings.retain(entry.context,name);finish(entry.problem);return entry.result ?? ErrorValueObject.create(ErrorType.CONNECT,'Loading blockchain data…');}
        const context=runtime.bindings.begin(cell,formula,args,name);
        const current:Entry={cell,formula,context,at:Date.now()};entries.set(key,current);
        const version=runtime.requestVersion();
        void runtime.calculate(name,args,context).then(result=>{if(runtime.requestVersion()===version && entries.get(key)===current)current.result=resultObject(result);},cause=>{
          if(runtime.requestVersion()!==version || entries.get(key)!==current)return;
          current.problem=toProblem(cause);
          current.result=ErrorValueObject.create(current.problem.cellError as ErrorType,current.problem.message+' '+current.problem.recovery);
        }).then(()=>{
          if(runtime.requestVersion()!==version || entries.get(key)!==current || readFormula(cell)!==formula)return;
          current.at=Date.now();notify(cell);
        });
        finish();return ErrorValueObject.create(ErrorType.CONNECT,'Loading blockchain data…');
      }
    }
    return [TableFunction,name] as [typeof BaseFunction,string];
  });
  return Object.assign(functions,{
    prune:()=>prune(),
    beginCalculation:()=>{touched.clear();seen.clear();},
    endCalculation:()=>prune((key,entry)=>touched.has(JSON.stringify(entry.cell))&&!seen.has(key)),
    reset:()=>{entries.clear();completed.clear();if(timer!==undefined)clearTimeout(timer);timer=undefined;},
  });
}
