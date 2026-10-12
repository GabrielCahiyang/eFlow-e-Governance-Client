import {describe,expect,it} from 'vitest';
import {workspaceChoices} from '../../src/app/features/workspaces/selectors/workspaceChoices';
import type {Workspace} from '../../src/app/features/workspaces/types';
const workspace=(id:string)=>({id,name:`Workspace ${id}`,kind:'office',owner_id:'owner',office_id:id} as Workspace);
describe('unique workspace choices',()=>{
 it('renders one small list even when every workspace is recent or records/recent IDs repeat',()=>{
  const choices=workspaceChoices([workspace('a'),workspace('b'),workspace('a')],['a','b','a','removed'],'');expect(choices.map(group=>group.label)).toEqual(['Workspaces']);expect(choices[0].rows.map(row=>row.id)).toEqual(['a','b']);
 });
 it('uses recent only as a proper subset of a larger authorized set and subtracts it from the remainder',()=>{
  const choices=workspaceChoices(Array.from({length:7},(_,i)=>workspace(String(i))),['2','0','2','removed'],'');expect(choices[0].rows.map(row=>row.id)).toEqual(['2','0']);expect(choices[1].rows.map(row=>row.id)).toEqual(['1','3','4','5','6']);
 });
 it('searches all unique workspaces and shows one list, including type/owner matches',()=>{
  const rows=[workspace('a'),{...workspace('b'),kind:'personal' as const,owner_name:'Alex'}];expect(workspaceChoices(rows,['a'],'Alex')[0].rows.map(row=>row.id)).toEqual(['b']);expect(workspaceChoices(rows,['a'],'missing')[0].rows).toEqual([]);
 });
});
