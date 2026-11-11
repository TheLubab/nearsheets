import { ArrayValueObject, AsyncObject, BaseFunction, ErrorValueObject, StringValueObject, NumberValueObject, BooleanValueObject, NullValueObject, ErrorType } from '@univerjs/engine-formula';
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

/** Native value-object functions expose cell identity and propagate real errors. */
export function createTableFunctionCatalog(runtime:TableRuntime, readFormula:(cell:CellLocation)=>string) {
  return TABLE_FUNCTIONS.map(([name])=> {
    class TableFunction extends BaseFunction {
      override isAsync() { return true; }
      override calculate(...variants:BaseValueObject[]) {
        const cell={unitId:this.unitId ?? '',sheetId:this.subUnitId ?? '',row:this.row,column:this.column};
        const formula=readFormula(cell);
        const version=runtime.requestVersion();
        const args=variants.map(value=>value.isArray() ? (value as ArrayValueObject).toValue() : value.getValue());
        const finish=runtime.diagnostics.begin(cell,formula,name+' '+JSON.stringify(args));
        return new AsyncObject((async()=>{
          try {
            for(const variant of variants) {
              const value=variant.isArray() && (variant as ArrayValueObject).getRowCount()===1 && (variant as ArrayValueObject).getColumnCount()===1
                ? (variant as ArrayValueObject).getFirstCell() : variant;
              if(value.isError()) { finish();return value; }
              if(value.isArray())throw invalidInput('This argument requires a single value or cell reference.');
            }
            const result=await runtime.calculate(name,args);
            runtime.accept(version);
            if(readFormula(cell)===formula)finish();
            return resultObject(result);
          } catch(cause) {
            const problem=toProblem(cause);
            if(runtime.requestVersion()===version && readFormula(cell)===formula)finish(problem);
            return ErrorValueObject.create(problem.cellError as ErrorType,problem.message+' '+problem.recovery);
          }
        })());
      }
    }
    return [TableFunction,name] as [typeof BaseFunction,string];
  });
}
