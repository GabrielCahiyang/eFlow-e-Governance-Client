import { describe, expect, it } from 'vitest';
import { membershipDiff, officeStaffingReason, removalWork } from '../../src/app/features/project-offices/presentation';
import type { ProjectOffice } from '../../src/app/features/project-offices';
import type { Task } from '../../src/app/features/tasks';
import type { Organization, UserProfile } from '../../src/app/types';
const office={id:'p',office_id:'own',project_id:'project',relationship_type:'collaborating',invitation_status:'joined'} as ProjectOffice;
const user={id:'head',org_id:'own',is_active:true,role:'head'} as UserProfile, orgs=[{id:'own',head_user_id:'head'}] as Organization[];
describe('Phase 14 participation capabilities and impact',()=>{
 it('separates own Head staffing from observer, governance and closed states',()=>{
  expect(officeStaffingReason(office,user,orgs,'planning',false)).toBe('');
  expect(officeStaffingReason({...office,relationship_type:'observer'},user,orgs,'planning',false)).toContain('Observers');
  expect(officeStaffingReason({...office,invitation_status:'awaiting_head'},user,orgs,'planning',false)).toContain('confirm');
  expect(officeStaffingReason(office,user,orgs,'completed',false)).toContain('closed'); expect(officeStaffingReason(office,user,orgs,'planning',true)).toContain('Proposal Context');
  for(const role of ['member','admin','accounting_staff'])expect(officeStaffingReason(office,{...user,role} as UserProfile,orgs,'planning',false)).toContain('appointed Head');
  expect(officeStaffingReason(office,{...user,org_id:'foreign'},orgs,'planning',false)).toContain('appointed Head');
 });
 it('diffs unique IDs and matches server active-work blockers without exempting archived active work',()=>{
  expect(membershipDiff(['a','b'],['b','c','c'])).toEqual({added:['c'],removed:['a']});
  const task={id:'t',linkedProjectId:'project',orgId:'own',status:'todo',assigneeId:'a',archivedAt:1} as Task;
  expect(removalWork(office,['a'],[task]).map(t=>t.id)).toEqual(['t']);
  for(const patch of [{status:'completed'},{status:'cancelled'},{orgId:'foreign'},{linkedProjectId:'other'}])expect(removalWork(office,['a'],[{...task,...patch} as Task])).toEqual([]);
  expect(removalWork(office,['a'],[{...task,assigneeId:'b',recommendationLeadId:'a'}])).toHaveLength(1);
 });
});
