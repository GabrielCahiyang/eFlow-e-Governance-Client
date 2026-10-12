import {describe,expect,it} from 'vitest';
import {captureWorkEditorBaseline,freezeWorkEditorRequest,workEditorDirty,workEditorPayload} from '../../src/app/features/nested-work/selectors/editorDraft';
import type {WorkCommand,WorkNode,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import type {WorkEditorFields} from '../../src/app/features/nested-work/types/editor';

const node:WorkNode={id:'node',task_id:'root',parent_subtask_id:'parent',lead_id:'lead',title:'Existing work',assigned_to_ids:['lead','worker'],sibling_order:1,depth:2,due_date:'2026-12-01',is_standalone:false,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:true,can_work:true,can_review:true};
const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',lead:'head',people:['head','worker'],kind:'office',open:true,due:'2026-12-31'},revision:7,can_manage:true,can_transfer:true,nodes:[{...node,id:'parent',parent_subtask_id:null,due_date:'2026-12-15'},node,{...node,id:'sibling',sibling_order:0}],people:[],leaf_total:2,leaf_completed:0};
const fieldsByMode:Record<WorkCommand,(keyof WorkEditorFields)[]>={create:['title','due','standalone','parent','lead','people'],edit:['title','due','standalone','note'],move:['parent'],order:['order'],delete:[],progress:['progress','note'],submit:['note'],review:['progress','note'],staff:['lead','people'],contributors:['people'],root_lead:['lead','people']};
const changes:WorkEditorFields={title:'Changed work',due:'2026-11-01',standalone:true,parent:'another',lead:'another',people:['another'],note:'A reason',progress:100,order:['node','sibling']};
describe('NW5.3 pure editor baselines and mode equality',()=>{
 for(const command of Object.keys(fieldsByMode) as WorkCommand[]){
  it(`${command}: untouched fields are clean`,()=>{
   const baseline=captureWorkEditorBaseline(data,{command,node,parent:'parent'},'actor','created');expect(workEditorDirty(baseline,baseline.fields)).toBe(false);
  });
  for(const key of Object.keys(changes) as (keyof WorkEditorFields)[])it(`${command}: ${key} ${fieldsByMode[command].includes(key)?'is applicable':'is irrelevant'}`,()=>{
   const baseline=captureWorkEditorBaseline(data,{command,node,parent:'parent'},'actor','created');
   expect(workEditorDirty(baseline,{...baseline.fields,[key]:changes[key]})).toBe(fieldsByMode[command].includes(key));
  });
 }
 it('inherits deadlines and captures copies without changing the source tree or sibling order',()=>{
  const baseline=captureWorkEditorBaseline(data,{command:'create',parent:'parent'},'actor','created');
  expect(baseline.fields).toMatchObject({title:'',due:'2026-12-15',parent:'parent',order:['sibling','node']});expect(data.nodes.map(item=>item.id)).toEqual(['parent','node','sibling']);
  const staffing=captureWorkEditorBaseline(data,{command:'staff',node},'actor','created');expect(staffing.fields.people).not.toBe(node.assigned_to_ids);
 });
 it('treats contributors as a set and personal review values as the same decision',()=>{
  const baseline=captureWorkEditorBaseline(data,{command:'staff',node},'actor','created');
  expect(workEditorDirty(baseline,{...baseline.fields,people:['worker','lead','worker']})).toBe(false);
  const review={...baseline,command:'review' as const};expect(workEditorDirty(review,{...review.fields,progress:99})).toBe(false);
 });
 it('preserves every existing non-staffing command payload and manual progress limits remain with the caller/server',()=>{
  const baseline=captureWorkEditorBaseline(data,{command:'create',parent:'parent'},'actor','created');const fields={...baseline.fields,...changes,people:['worker'],lead:'lead'};
  const expected:Partial<Record<WorkCommand,Record<string,unknown>>>={create:{id:'created',title:'Changed work',parent:'another',lead:'lead',people:['worker','lead'],due:'2026-11-01',standalone:true},edit:{id:'node',title:'Changed work',due:'2026-11-01',standalone:true,note:'A reason'},move:{id:'node',parent:'another'},order:{parent:'another',order:['node','sibling']},delete:{id:'node'},progress:{id:'node',progress:100,note:'A reason'},submit:{id:'node',note:'A reason'},review:{id:'node',approve:true,note:'A reason'}};
  for(const [command,payload] of Object.entries(expected))expect(workEditorPayload({...baseline,command:command as WorkCommand,nodeId:'node'},fields)).toEqual(payload);
 });
 it('freezes all first-send terms, including array copies, optional fingerprint and created identity',()=>{
  const baseline=captureWorkEditorBaseline(data,{command:'create',parent:'parent'},'actor','created');const draft={...baseline.fields,title:'Original',people:['worker']};
  const request=freezeWorkEditorRequest(baseline,draft,'request','original-fingerprint');draft.title='Changed';draft.people.push('another');
  expect(request).toMatchObject({id:'request',revision:7,command:'create',impactFingerprint:'original-fingerprint',payload:{id:'created',title:'Original',people:['worker']}});
  expect(Object.isFrozen(request)).toBe(true);expect(Object.isFrozen(request.payload)).toBe(true);expect(Object.isFrozen(request.payload.people)).toBe(true);
  expect(()=>{(request.payload.people as string[]).push('tampered');}).toThrow();
  expect(freezeWorkEditorRequest(baseline,draft,'second','').impactFingerprint).toBe('');expect(freezeWorkEditorRequest(baseline,draft,'ordinary')).not.toHaveProperty('impactFingerprint');
 });
});
