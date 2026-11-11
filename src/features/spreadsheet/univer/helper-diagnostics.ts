import { BaseFunction } from '@univerjs/engine-formula';
import type { BaseValueObject } from '@univerjs/engine-formula';
import type { CellLocation } from '../../table/cell-diagnostics';
import type { TableRuntime } from '../../table/runtime';
import { invalidInput } from '../../table/problems';

const hints:Record<string,string>={
  NEAR_ACCOUNT:'Use a NEAR account ID such as alice.near. This function checks its format, not whether it exists.',
  NEAR_AMOUNT:'Use a non-negative numeric amount and a whole-number token precision from 0 to 24. Extra decimal places must fit that precision.',
  NS_REFERENCE:'Use a non-empty reference prefix and a valid sequence number.',
};

/** Keep the pure helper catalog independent of workbook state. */
export function withHelperDiagnostics(functions:Array<[typeof BaseFunction,string]>,runtime:TableRuntime,readFormula:(cell:CellLocation)=>string):Array<[typeof BaseFunction,string]> {
  return functions.map(([FunctionClass,name])=>{
    class DiagnosedHelper extends FunctionClass {
      override calculate(...args:BaseValueObject[]) {
        const cell={unitId:this.unitId ?? '',sheetId:this.subUnitId ?? '',row:this.row,column:this.column};
        const finish=runtime.diagnostics.begin(cell,readFormula(cell),name);
        const result=super.calculate(...args);
        if(result.isValueObject() && (result as BaseValueObject).isError() && !args.some(arg=>arg.isError())) {
          finish(invalidInput(`${name} could not use these arguments.`,hints[name] ?? 'Check the function arguments and referenced cells.').problem);
        } else finish();
        return result;
      }
    }
    return [DiagnosedHelper,name];
  });
}
