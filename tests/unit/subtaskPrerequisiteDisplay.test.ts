import {expect,it} from 'vitest';
import type {WorkNode,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import {displayedSubtaskPrerequisiteIds,subtaskPrerequisiteChoices} from '../../src/app/features/nested-work/selectors/prerequisites';
const node=(id:string,patch:Partial<WorkNode>={})=>({id,task_id:'task',parent_subtask_id:null,sibling_order:0,is_standalone:false,status:'todo',...patch}) as WorkNode;
it('derives only earlier sequential siblings while preserving cancelled and completed inherited edges',()=>{
 const target=node('target',{sibling_order:4,dependency_ids:null});
 const tree={root:{id:'task'},nodes:[target,node('first',{sibling_order:0,status:'completed'}),node('cancelled',{sibling_order:1,status:'cancelled' as WorkNode['status']}),node('independent',{sibling_order:2,is_standalone:true}),node('later',{sibling_order:5}),node('other-parent',{sibling_order:1,parent_subtask_id:'parent'}),node('other-root',{task_id:'other'})]} as WorkTreeSnapshot;
 const before=JSON.stringify(tree);
 expect(displayedSubtaskPrerequisiteIds(tree,target)).toEqual(['first','cancelled']);
 expect(subtaskPrerequisiteChoices(tree,'',target.id,displayedSubtaskPrerequisiteIds(tree,target)).map(item=>item.id)).toContain('cancelled');
 expect(JSON.stringify(tree)).toBe(before);
});
it('preserves explicit independence, selected missing IDs, unavailable contracts, and legacy standalone work',()=>{
 const tree={nodes:[]} as unknown as WorkTreeSnapshot;
 expect(displayedSubtaskPrerequisiteIds(tree,node('n',{dependency_ids:[]}))).toEqual([]);
 const selected=['missing'];const existing=node('n',{dependency_ids:selected});
 expect(displayedSubtaskPrerequisiteIds(tree,existing)).toEqual(['missing']);
 expect(displayedSubtaskPrerequisiteIds(tree,existing)).not.toBe(selected);
 expect(displayedSubtaskPrerequisiteIds(tree,node('n'))).toEqual([]);
 expect(displayedSubtaskPrerequisiteIds(tree,node('n',{dependency_ids:null,is_standalone:true}))).toEqual([]);
});
