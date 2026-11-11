import { describe,expect,it,vi } from 'vitest';
import { getTableSelection } from '../src/features/table/selection';
import type { WorkbookSession } from '../src/features/spreadsheet/univer/create-workbook-session';
import type { Operation } from '../src/features/table/runtime';

function fixture(ranges:Array<{startRow:number;endRow:number;startColumn:number;endColumn:number}>,cells:Array<[number,number,string]>) {
  const operation={id:'testnet:dao.testnet:invoice-1'} as Operation;
  const scan=vi.fn(callback=>{cells.forEach(([row,col])=>callback(row,col));});
  const sheet={getSelection:()=>({getActiveRangeList:()=>ranges.map((range,index)=>({getRange:()=>range,getA1Notation:()=>index?'D20':'B1:B1000000'}))}),getSheet:()=>({getCellMatrix:()=>({forValue:scan})}),getRange:(row:number,col:number)=>({getValue:()=>cells.find(cell=>cell[0]===row&&cell[1]===col)?.[2]})};
  const session={getWorkbook:()=>({getActiveSheet:()=>sheet}),tableRuntime:{operations:new Map([['Draft',operation]]),calculating:false}} as unknown as WorkbookSession;
  return {session,operation,scan};
}
describe('selection-driven table controls',()=>{
  it('reads sparse populated cells for full-column selections and excludes drafts outside the selection',()=>{
    const {session,operation,scan}=fixture([{startRow:0,endRow:999999,startColumn:1,endColumn:1}],[[500000,1,'Draft'],[500000,3,'Draft'],[0,1,'Ordinary value']]);
    expect(getTableSelection(session)).toMatchObject({ready:true,label:'B1:B1000000',operations:[operation]});
    expect(scan).toHaveBeenCalledOnce();
  });
  it('includes disjoint ranges once per cell and retains copied action identities for duplicate validation',()=>{
    const {session,operation}=fixture([{startRow:0,endRow:999999,startColumn:1,endColumn:1},{startRow:19,endRow:19,startColumn:3,endColumn:3}],[[500000,1,'Draft'],[19,3,'Draft']]);
    const selection=getTableSelection(session);
    expect(selection.operations).toEqual([operation,operation]);expect(selection.label).toBe('B1:B1000000, D20');
  });
  it('reports no actionable cells while the workbook starts or a regular cell is selected',()=>{
    expect(getTableSelection(null)).toMatchObject({ready:false,operations:[]});
    const {session}=fixture([{startRow:0,endRow:0,startColumn:0,endColumn:0}],[[0,0,'A normal cell']]);
    expect(getTableSelection(session).operations).toEqual([]);
  });
});
