import { describe, expect, it } from 'vitest';
import { canStaffProjectOffice, canHandoverTask, projectOfficePeople } from '../../src/app/features/project-offices/selectors';
import type { ProjectOffice } from '../../src/app/features/project-offices/types';
import type { Organization, UserProfile } from '../../src/app/types';
import type { Task } from '../../src/app/features/tasks';
const office = { id:'participation',project_id:'project',office_id:'cpdo',relationship_type:'collaborating',invitation_status:'joined' } as ProjectOffice;
const head = { id:'head',org_id:'cpdo',role:'head',is_active:true } as UserProfile;
const organizations = [{id:'cpdo',head_user_id:'head'}] as Organization[];
describe('Project Office authority',()=>{
 it('Allows only the appointed Head of a joined collaborating Office to staff it',()=>{
  expect(canStaffProjectOffice(office,head,organizations)).toBe(true);
  expect(canStaffProjectOffice(office,{...head,id:'lead',org_id:'ledipo'},organizations)).toBe(false);
  expect(canStaffProjectOffice(office,{...head,id:'not-appointed'},organizations)).toBe(false);
  expect(canStaffProjectOffice({...office,relationship_type:'observer'},head,organizations)).toBe(false);
  expect(canStaffProjectOffice({...office,invitation_status:'awaiting_head'},head,organizations)).toBe(false);
 });
 it('Offers the own Office Head and selected active members, excluding other Office employees',()=>{
  const people=[head,{id:'selected',org_id:'cpdo',role:'member',is_active:true},{id:'unselected',org_id:'cpdo',role:'member',is_active:true},{id:'other',org_id:'ledipo',role:'member',is_active:true},{id:'inactive',org_id:'cpdo',is_active:false}] as UserProfile[];
  expect(projectOfficePeople(office,[{project_office_id:'participation',user_id:'selected'}],people,organizations).map(p=>p.id)).toEqual(['head','selected']);
 });
 it('Prevents Office handover once work or staffing has started',()=>{
  const task={status:'pending_assignment',teamMemberIds:[]} as unknown as Task;
  expect(canHandoverTask(task,false)).toBe(true);
  for(const patch of [{status:'todo'},{assigneeId:'member'},{teamMemberIds:['member']},{archivedAt:1},{recommendationLeadId:'lead'}])expect(canHandoverTask({...task,...patch} as Task,false)).toBe(false);
  expect(canHandoverTask(task,true)).toBe(false);
 });
});
