// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,renderHook,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {installNavigationConfirmation,useNavigationBlocker} from '../../src/app/shared/navigationGuard';
const calls=vi.hoisted(()=>({team:vi.fn(),appointment:vi.fn()}));
vi.mock('../../src/app/features/task-inspector/components/InspectorTeam',()=>({InspectorTeam:(props:unknown)=>{calls.team(props);return <p>Existing people and hierarchy</p>;}}));
vi.mock('../../src/app/features/nested-work',()=>({supportsNestedWork:()=>true,WorkRootStaffingDialog:(props:unknown)=>{calls.appointment(props);return <p>Canonical appointment</p>;}}));
vi.mock('../../src/app/features/staffing/hooks/useStaffingReview',()=>({useStaffingReview:()=>({appointment:{leadId:'recommended'},cancelAppointment:vi.fn(),appointmentSaved:vi.fn(),pending:{current:false},setSelected:vi.fn()})}));
import {InspectorWork} from '../../src/app/features/task-inspector/components/InspectorWork';
import {StaffingDialog} from '../../src/app/features/staffing/components/StaffingDialog';
import type {Task} from '../../src/app/features/tasks';
import type {WorkTreeController} from '../../src/app/features/nested-work';
const task={id:'root',title:'Assessment',linkedProjectId:'project'} as Task;
const controller={rootId:'root',actorId:'actor'} as WorkTreeController;
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('NW7.2 Work composition and advisory handoff',()=>{
 it('passes the supplied owner and read-only/project context directly and guards advisory navigation',async()=>{
  const recommend=vi.fn(),decision=vi.fn().mockResolvedValue(false),uninstall=installNavigationConfirmation(decision);
  const blocker=renderHook(()=>useNavigationBlocker({dirty:true,label:'Existing work draft',onDiscard:vi.fn()}));
  try{
   render(<InspectorWork task={task} profiles={[]} projectTitle="Project" controller={controller} readOnly canManageTaskTeam={false} canManageSubtasks={false} currentUserIsLead={false} onManage={vi.fn()} staffingReason={null} onRecommend={recommend}/>);
   expect(calls.team.mock.lastCall?.[0]).toMatchObject({task,controller,readOnly:true,projectTitle:'Project'});
   await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Recommend staff'})));
   expect(decision).toHaveBeenCalledOnce();expect(recommend).not.toHaveBeenCalled();
  }finally{blocker.unmount();uninstall();}
 });
 it('hands a reviewed AI recommendation to the same canonical controller',()=>{
  render(<StaffingDialog task={task} controller={controller} onClose={vi.fn()}/>);
  expect(calls.appointment.mock.lastCall?.[0]).toMatchObject({rootId:'root',controller,preselectedLeadId:'recommended'});
 });
});
