import { resolveInboxUpdateDestination } from '../../src/app/features/action-center/services/updateDestination';
import type { Notification } from '../../src/app/services/notificationService';
import { describe,it,expect } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import { selectPersonalWork,personalTaskRelation } from '../../src/app/features/personal-work/selectors';
import { personalReviewActions } from '../../src/app/features/action-center/selectors';
import type { SubtaskReviewItem } from '../../src/app/features/subtasks';
import { buildShellNavigation,readNavigationLocation,getSidebarContent } from '../../src/app/features/navigation';
import {buildSubtaskDisplayMetadata,mergeWorkDisplayMetadata} from '../../src/app/features/nested-work';
import {rowToSubtask,type SubtaskSubmission} from '../../src/app/features/subtasks';
import type {WorkRow} from '../../src/app/features/personal-work/types';
import {selectWorkRows} from '../../src/app/features/personal-work/workSelectors';
const now=new Date(2026,9,6,12), task=(id:string,patch:Partial<Task>={}):Task=>({id,title:id,status:'todo',assigneeId:'me',createdAt:1,updatedAt:now.getTime(),...patch});
describe('NW9.2 personal path filtering preserves actor and workspace boundaries',()=>{
 it('searches the displayed path without admitting unassigned siblings or foreign workspaces',()=>{
  const context=buildSubtaskDisplayMetadata([{id:'parent',taskId:'root',title:'Allowed ancestor',position:0,assignedToIds:[]},
   {id:'item',taskId:'root',title:'Same',parentSubtaskId:'parent',leadId:'me',position:0,assignedToIds:['worker'],dueDate:'2026-10-06'}],
   {rootId:'root',rootTitle:'Private root',people:[{id:'me',name:'Personal Lead'}]}).get('item');
  const row:WorkRow={id:'item',key:'personal-node:item',rootId:'root',title:'Same',kind:'personal-node',projectTitle:'Research',workspaceId:'private',
   workspaceName:'Private',timezone:'Asia/Singapore',status:'todo',due:'2026-10-06',progress:0,mine:true,leading:true,actionable:true,history:false,relation:'Subitem Lead',workContext:context};
  const rows=[row,{...row,id:'sibling',key:'personal-node:sibling',mine:false},{...row,id:'foreign',key:'personal-node:foreign',workspaceId:'foreign'}];
  expect(selectWorkRows(rows,'Subtasks','All my work','allowed ancestor','private').map(row=>row.id)).toEqual(['item']);
  expect(selectWorkRows(rows,'Leading','All my work',context!.pathLabel,'private').map(row=>row.id)).toEqual(['item']);
  expect(selectWorkRows(rows,'Assigned work','All my work','allowed ancestor')).toEqual([]);
  expect(selectWorkRows([{...row,actionable:false}],'Subtasks','All my work')).toEqual([]);
 });
});
describe('NW9.1 optional authorized personal/workflow context',()=>{
 const raw={id:'item',task_id:'root',title:'Same',parent_subtask_id:'parent',lead_id:'lead',assigned_to:'worker',assigned_to_ids:['worker'],
  status:'changes_requested',percent_complete:30,source:'template',position:4,sibling_order:2,is_standalone:true,due_date:'2026-10-21',
  created_by:'original-author',created_at:'2026-10-01T01:00:00Z',updated_at:'2026-10-02T02:00:00Z',
  reviewer_id:'original-reviewer',latest_submission_id:'submission',completed_by:'original-completer',completed_at:'2026-10-01T02:00:00Z',
  due_date_change_reason:'Recorded reason',due_date_changed_by:'date-author',due_date_changed_at:'2026-10-02T01:00:00Z'};
 const scope={rootId:'root',rootTitle:'Task',people:[{id:'lead',name:'Appointed Lead'},{id:'worker',name:'Worker'}]};
 it('adds metadata to a full authorized record without rewriting history, timestamps, worker fields or due dates',()=>{
  const full=rowToSubtask(raw),parent=rowToSubtask({...raw,id:'parent',parent_subtask_id:null,due_date:'2026-10-20'});
  const contexts=buildSubtaskDisplayMetadata([full,parent],scope);
  const merged=mergeWorkDisplayMetadata(full,contexts.get(full.id));
  const {workContext,...originalFields}=merged;
  expect(originalFields).toEqual(full);
  expect(workContext).toMatchObject({nodeId:'item',parentId:'parent',dueDate:'2026-10-21',leadId:'lead',
   pathLabel:'Task / Same / Same',participantIds:['lead','worker']});
  expect('workContext' in full).toBe(false);
  expect(merged.assignedToIds).toBe(full.assignedToIds);
 });
 it('retains legacy records without optional metadata and ignores untrusted wire metadata',()=>{
  const legacy=rowToSubtask({...raw,parent_subtask_id:null,lead_id:null,workContext:{pathLabel:'SECRET wire title'}});
  expect('workContext' in legacy).toBe(false);
  expect(mergeWorkDisplayMetadata(legacy,undefined)).toBe(legacy);
  expect(legacy).toMatchObject({parentSubtaskId:undefined,leadId:undefined,assignedTo:'worker',assignedToIds:['worker']});
  expect(buildSubtaskDisplayMetadata([legacy],scope).get('item')).toMatchObject({parentId:null,leadId:null,leadName:null});
 });
 it('clears stale or foreign context after a denied refresh without looking up a parent',()=>{
  const full=rowToSubtask(raw),metadata=buildSubtaskDisplayMetadata([full],scope).get('item')!;
  expect(metadata).toMatchObject({context:'missing_parent',pathLabel:'Parent context unavailable / Same'});
  const merged=mergeWorkDisplayMetadata(full,metadata);
  for(const context of [undefined,{...metadata,nodeId:'duplicate-title-item'},{...metadata,rootId:'foreign'}]){
   const cleared=mergeWorkDisplayMetadata(merged,context);
   expect(cleared.workContext).toBeUndefined();
   const {workContext,...fields}=cleared;
   expect(fields).toEqual(full);
  }
 });
 it('keeps submission IDs/authorship and WorkRow IDs in their distinct contracts',()=>{
  const full=rowToSubtask(raw),context=buildSubtaskDisplayMetadata([full],scope).get('item');
  const submission:SubtaskSubmission={id:'submission',subtaskId:'item',taskId:'root',version:2,submitterId:'recorded-author',
   submitterName:'Original author',reviewerId:'recorded-reviewer',note:'Evidence',status:'approved',decidedByName:'Original decision author',submittedAt:1,attachments:[]};
  const withContext:SubtaskSubmission={...submission,workContext:context};
  const {workContext,...history}=withContext;
  expect(history).toEqual(submission);
  expect(withContext.id).not.toBe(workContext?.nodeId);
  const row:WorkRow={id:'item',key:'office-node:item',rootId:'root',title:'Same',kind:'office-node',projectTitle:'Project',workspaceName:'Office',
   timezone:'Asia/Singapore',status:'changes_requested',progress:30,mine:true,leading:false,actionable:false,history:false,relation:'Contributor',subtask:full};
  const decorated:WorkRow={...row,workContext:context};
  const {workContext:display,...rowFields}=decorated;
  expect(rowFields).toEqual(row);
  expect(display?.nodeId).toBe(row.id);
  expect(decorated.leading).toBe(false);
  expect(decorated.actionable).toBe(false);
 });
});
describe('Phase 13 personal discovery',()=>{
 it('separates membership, assignment and stale AI recommendations from effective leadership',()=>{
  const tasks=[task('lead'),task('member',{assigneeId:'other',teamMemberIds:['me']}),task('suggestion',{assigneeId:'other',recommendationLeadId:'me'}),task('foreign',{assigneeId:'other'})];
  expect(selectPersonalWork(tasks,'me','All my work', '',now).map(t=>t.id)).toEqual(['lead','member','suggestion']);
  expect(selectPersonalWork(tasks,'me','Assigned to me','',now).map(t=>t.id)).toEqual(['lead','member']);
  expect(selectPersonalWork(tasks,'me','Leading','',now).map(t=>t.id)).toEqual(['lead']);
  expect(personalTaskRelation(tasks[2],'me')).toBe('Recommended lead');
  expect(selectPersonalWork(tasks,undefined,'All my work','',now)).toEqual([]);
 });
 it('uses Monday–Sunday calendar buckets and keeps undated/malformed dates out of due filters',()=>{
  const tasks=[task('yesterday',{deadline:'2026-10-05'}),task('today',{deadline:'2026-10-06T23:59:00+08:00'}),task('sunday',{deadline:'2026-10-11'}),task('next',{deadline:'2026-10-12'}),task('none'),task('invalid',{deadline:'invalid'})];
  expect(selectPersonalWork(tasks,'me','Due today','',now).map(t=>t.id)).toEqual(['today']);
  expect(selectPersonalWork(tasks,'me','Due this week','',now).map(t=>t.id)).toEqual(['yesterday','today','sunday']);
  expect(selectPersonalWork(tasks,'me','Overdue','',now).map(t=>t.id)).toEqual(['yesterday']);
 });
 it('does not put cancelled, archived or completed work in active buckets; labels the recent completion proxy',()=>{
  const tasks=[task('active'),task('cancelled',{status:'cancelled'}),task('archived',{archivedAt:1}),task('recent',{status:'completed'}),task('old',{status:'completed',updatedAt:new Date(2026,8,25).getTime()})];
  expect(selectPersonalWork(tasks,'me','All my work','',now).map(t=>t.id)).toEqual(['active']);
  expect(selectPersonalWork(tasks,'me','Recently completed','',now).map(t=>t.id)).toEqual(['recent']);
 });
 it('searches context without widening personal scope',()=>{
  const tasks=[task('mine',{projectTitle:'Outreach'}),task('foreign',{assigneeId:'other',projectTitle:'Outreach'})];
  expect(selectPersonalWork(tasks,'me','All my work','outreach',now).map(t=>t.id)).toEqual(['mine']);
 });
 it('separates sources, deduplicates and respects explicit routing and self-review blockers',()=>{
  const parent=task('t',{status:'for_review',reviewerId:'me',assigneeId:'other'});
  const child={subtask:{id:'t',taskId:'parent',title:'Evidence',status:'for_review'},submission:{status:'pending',reviewerId:'me',submitterId:'other'},taskTitle:'Parent'} as SubtaskReviewItem;
  expect(personalReviewActions([parent,parent],[child,child],'me','member').map(item=>item.key)).toEqual(['task-review:t','subtask-review:t']);
  expect(personalReviewActions([parent],[child],'me','admin')).toEqual([]);
  expect(personalReviewActions([task('self',{...parent,latestSubmission:{submitterId:'me'} as Task['latestSubmission']})],[{...child,submission:{...child.submission,submitterId:'me'}}],'me','member')).toEqual([]);
  expect(personalReviewActions([parent],[child],'foreign','head')).toEqual([]);
 });
 it.each(['head','member','accounting_staff'])('adds personal destinations for %s without retiring legacy entries',role=>{
  const nav=buildShellNavigation({role,can:()=>true,hasLeadingWork:true});
  expect(nav.slice(0,2).map(item=>item.id)).toEqual(['personal_work','inbox']);
  expect(nav.some(item=>item.id==='tasks')).toBe(true);expect(nav.some(item=>item.id==='reviews')).toBe(true);
 });
 it('Admin receives only personal updates discovery, not operational My Work',()=>{
  const nav=buildShellNavigation({role:'admin',can:()=>true});expect(nav[0].id).toBe('inbox');expect(nav.some(item=>item.id==='personal_work')).toBe(false);
 });
});

describe('Accounting retains personal and financial update destinations',()=>{
 it('opens personal task updates without redirecting financial records away from Accounting',()=>{
  const notification={id:'n',type:'assignment',title:'Task assigned',message:'Assigned task',taskId:'t',read:false,createdAt:1} as Notification;
  expect(resolveInboxUpdateDestination(notification,'accounting_staff')).toMatchObject({section:'tasks',intent:{kind:'task'}});
  expect(resolveInboxUpdateDestination({...notification,type:'petty_cash_liquidation'},'accounting_staff')).toMatchObject({section:'accounting_releases',intent:{kind:'budget'}});
  expect(resolveInboxUpdateDestination(notification,'admin')).toBeNull();
 });
});
