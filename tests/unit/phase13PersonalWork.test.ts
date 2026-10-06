import { resolveInboxUpdateDestination } from '../../src/app/features/action-center/services/updateDestination';
import type { Notification } from '../../src/app/services/notificationService';
import { describe,it,expect } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import { selectPersonalWork,personalTaskRelation } from '../../src/app/features/personal-work/selectors';
import { personalReviewActions } from '../../src/app/features/action-center/selectors';
import type { SubtaskReviewItem } from '../../src/app/features/subtasks';
import { buildShellNavigation,readNavigationLocation,getSidebarContent } from '../../src/app/features/navigation';
const now=new Date(2026,9,6,12), task=(id:string,patch:Partial<Task>={}):Task=>({id,title:id,status:'todo',assigneeId:'me',createdAt:1,updatedAt:now.getTime(),...patch});
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
