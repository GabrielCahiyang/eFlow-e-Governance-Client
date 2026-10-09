// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({role:'member',task:{id:'task',title:'Assessment',status:'for_review',assigneeId:'me',reviewerId:'me',linkedProjectId:'project',createdAt:1,updatedAt:1}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'me'},userProfile:{id:'me',role:state.role,org_id:'office',is_active:true}})}));
vi.mock('../../src/app/hooks/useFirebaseData',()=>({useTasks:()=>({tasks:[state.task],loading:false})}));
vi.mock('../../src/app/hooks/useSupabaseData',()=>({useOrgs:()=>({orgs:[]}),useProfiles:()=>({profiles:[]}),useProjectsData:()=>({projects:[{id:'project',status:'active'}]})}));
vi.mock('../../src/app/features/project-offices',async()=>{const {createContext}=await import('react');const data={projectId:'project',offices:[],members:[],loading:false,error:null};return{ProjectOfficeContext:createContext(data),useProjectOfficeContext:()=>data,useProjectOffices:()=>data};});
vi.mock('../../src/app/features/staffing',()=>({StaffingDialog:()=>null,staffingEntryReason:()=> 'Keep existing staffing scope.'}));
vi.mock('../../src/app/features/subtasks',()=>({useTaskSubtasks:()=>({subtasks:[]})}));
vi.mock('../../src/app/features/task-inspector/components/InspectorSummary',()=>({InspectorSummary:()=> <p>Description, schedule, dependencies and budget</p>}));
vi.mock('../../src/app/features/task-inspector/components/InspectorTeam',()=>({InspectorTeam:()=> <p>Team and subitems</p>}));
vi.mock('../../src/app/features/task-inspector/components/InspectorProgressUpdates',()=>({InspectorProgressUpdates:()=>null}));
vi.mock('../../src/app/features/task-inspector/components/InspectorFiles',()=>({InspectorFiles:({readOnly}:{readOnly:boolean})=><p>{readOnly?'Read-only files':'Writable files'}</p>}));
vi.mock('../../src/app/shared/motion',()=>({InspectorPanel:({children,ariaLabel}:{children:React.ReactNode;ariaLabel:string})=><div role="dialog" aria-label={ariaLabel}>{children}</div>}));
vi.mock('../../src/app/features/tasks',()=>({
 TaskDepartmentLabel:()=> <span>Responsible Office</span>,TaskTeamEditorDialog:()=>null,
 TaskActivityTimeline:()=> <p>Immutable history</p>,TaskDiscussion:({canParticipate}:{canParticipate:boolean})=><p>{canParticipate?'Can discuss':'Read-only discussion'}</p>,ProgressUpdateForm:()=> <p>Progress form</p>,
 isTaskLead:()=>true,resolveSubtaskManagementCapability:(readOnly:boolean,lead:boolean)=>!readOnly&&lead,
 resolveTaskDetailCapabilities:(readOnly:boolean,cap:Record<string,boolean>)=>Object.fromEntries(Object.entries(cap).map(([key,value])=>[key,!readOnly&&value])),
}));
vi.mock('../../src/app/features/reviews',()=>({TaskReviewPanel:()=> <p>Authorized review panel</p>,SubmitForReviewForm:()=> <p>Submission form</p>,canUserReviewTask:(_t:unknown,_u:unknown,role:string)=>role!=='admin'}));
vi.mock('../../src/app/features/task-inspector/hooks/useInspectorLifecycle',()=>({useInspectorLifecycle:()=>({busy:false,error:'',start:vi.fn()})}));
import {TaskInspector} from '../../src/app/features/task-inspector/components/TaskInspector';
beforeEach(()=>{state.role='member';});afterEach(cleanup);
describe('R6 shared inspector presentation and support boundary',()=>{
 it('shows exactly three primary sections, Details on demand and contextual review',async()=>{
  render(<TaskInspector task={state.task as never} onClose={()=>{}} canReview canPostProgress/>);
  expect(screen.getAllByRole('tab').map(t=>t.textContent)).toEqual(['Updates','Files','Activity']);expect(screen.queryByText('Team and subitems')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}));await screen.findByText('Team and subitems');
  fireEvent.click(screen.getByRole('button',{name:'Review submission',exact:true}));await screen.findByText('Authorized review panel');expect(screen.queryByText('Can discuss')).toBeNull();
  fireEvent.click(screen.getByRole('tab',{name:'Files',exact:true}));await screen.findByText('Writable files');expect(screen.queryByText('Authorized review panel')).toBeNull();
 });
 it('keeps Admin support read only even when a caller passes operational flags',async()=>{
  state.role='admin';render(<TaskInspector task={state.task as never} onClose={()=>{}} canReview canPostProgress canSubmitForReview canDiscuss/>);
  expect(screen.queryByRole('button',{name:'Review submission',exact:true})).toBeNull();expect(screen.queryByText('Progress form')).toBeNull();expect(screen.getByText('Read-only discussion')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:'Files',exact:true}));await screen.findByText('Read-only files');
  fireEvent.click(screen.getByRole('tab',{name:'Activity',exact:true}));await waitFor(()=>expect(screen.getByText('Immutable history')).toBeTruthy());
 });
});
