import {expect,it} from 'vitest';
import type {WorkNode,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {captureWorkEditorBaseline,workEditorDateError,workEditorDefinitionError,workEditorPayload,workEditorDirty} from '../../src/app/features/nested-work/selectors/editorDraft';
const policy={version:1 as const,task_id:'task',node_id:'node',updated_at:null,started:true,details:true,due:false,planning:false};
function fixture(){
 const node={id:'node',task_id:'task',title:'Saved',parent_subtask_id:null,start_date:'2026-11-16',due_date:'2026-11-24',priority:'medium',is_standalone:false,status:'todo',percent_complete:0,assigned_to_ids:[],detail_edit:{...policy}} as WorkNode;
 const tree={root:{id:'task',project:'project',office:'office',kind:'office',due:'2026-11-30',scheduleBounds:{projectStart:'2026-11-01',projectDue:'2026-11-30',taskStart:'2026-11-15',taskDue:'2026-11-30'}},nodes:[node],revision:4} as WorkTreeSnapshot;
 const baseline=captureWorkEditorBaseline(tree,{command:'edit',node},'actor','created');
 return {node,tree,baseline,fields:{...baseline.fields}};
}
it('uses recorded history policy even when status and percentage look unstarted',()=>{
 const {tree,baseline,fields}=fixture();
 expect(workEditorDefinitionError(tree,baseline,{...fields,title:'Correction',priority:'high'})).toBe('');
 expect(workEditorDefinitionError(tree,baseline,{...fields,start:'2026-11-17'})).toContain('cannot change');
 expect(workEditorDefinitionError(tree,baseline,{...fields,standalone:true})).toContain('cannot change');
 expect(workEditorDefinitionError(tree,baseline,{...fields,due:'2026-11-25',note:'Reason'})).toContain('supervising');
});
it('requires supervising due permission and a bounded reason without losing title/priority edits',()=>{
 const {tree,node,baseline,fields}=fixture();node.detail_edit!.due=true;
 expect(workEditorDefinitionError(tree,baseline,{...fields,due:'2026-11-25'})).toContain('reason');
 expect(workEditorDefinitionError(tree,baseline,{...fields,due:'2026-11-25',note:'x'.repeat(1001)})).toContain('1,000');
 expect(workEditorDefinitionError(tree,baseline,{...fields,due:'2026-11-25',note:'Approved reschedule'})).toBe('');
 node.detail_edit!.started=false;node.detail_edit!.planning=true;
 expect(workEditorDefinitionError(tree,baseline,{...fields,start:'2026-11-17'})).toContain('reason');
 expect(workEditorDefinitionError(tree,baseline,{...fields,start:'2026-11-17',note:'Adjusted start window'})).toBe('');
 node.detail_edit!.details=false;
 expect(workEditorDefinitionError(tree,baseline,{...fields,title:'Correction'})).toContain('read-only');
});
it('rejects missing, unsupported and mismatched record policies',()=>{
 for(const changed of [null,{...policy,version:2},{...policy,node_id:'other'},{...policy,task_id:'other'}]){
  const {tree,node,baseline,fields}=fixture();node.detail_edit=changed as WorkNode['detail_edit'];
  expect(workEditorDefinitionError(tree,baseline,fields)).toContain('could not be verified');
 }
});
it('preserves unchanged legacy payload fields and only sends an actual priority correction',()=>{
 const {baseline,fields}=fixture();
 expect(workEditorPayload(baseline,fields)).not.toHaveProperty('priority');
 expect(workEditorPayload(baseline,{...fields,priority:'high'})).toHaveProperty('priority','high');
 expect(workEditorDirty(baseline,{...fields,priority:'high'})).toBe(true);
});
it('keeps own schedule bounds independently of prerequisite dates',()=>{
 const {tree,baseline,fields}=fixture();
 expect(workEditorDateError(tree,baseline,{...fields,start:'2026-10-31'})).toContain('cannot be before');
 expect(workEditorDateError(tree,baseline,{...fields,due:'2026-12-01'})).toContain('cannot be after');
 expect(workEditorDateError(tree,baseline,{...fields,start:'2026-11-25'})).toContain('on or after');
 expect(workEditorDateError(tree,baseline,{...fields,due:'2026-11-25'})).toBe('');
});
