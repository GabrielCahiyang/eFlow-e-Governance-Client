// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {InspectorHeader} from '../../src/app/features/task-inspector/components/InspectorHeader';
import {TASK_INSPECTOR_SECTIONS,resolveTaskInspectorSection,type TaskInspectorSection} from '../../src/app/features/task-inspector/types';
import {installNavigationConfirmation,useNavigationBlocker} from '../../src/app/shared/navigationGuard';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({role:'member',projectStatus:'active',shared:false,taskVisible:true,reviewEligible:true,panel:vi.fn(),task:{proposedOfficeIdentityId:undefined as string|undefined,id:'task',orgId:'office',title:'Assessment',status:'for_review',assigneeId:'me',reviewerId:'me',linkedProjectId:'project',createdAt:1,updatedAt:1}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'me'},userProfile:{id:'me',role:state.role,org_id:'office',is_active:true}})}));
vi.mock('../../src/app/hooks/useFirebaseData',()=>({useTasks:()=>({tasks:state.taskVisible?[state.task]:[],loading:false})}));
vi.mock('../../src/app/hooks/useSupabaseData',()=>({useOrgs:()=>({orgs:[]}),useProfiles:()=>({profiles:[]}),useProjectsData:()=>({projects:[{id:'project',status:state.projectStatus}]})}));
vi.mock('../../src/app/features/project-offices',async()=>{const {createContext}=await import('react');const data=()=>({projectId:'project',offices:state.shared?[{id:'joined',office_id:'office',relationship_type:'lead',invitation_status:'joined'},{id:'other',office_id:'other',relationship_type:'collaborator',invitation_status:'joined'}]:[],members:[],loading:false,error:null});return{ProjectOfficeContext:createContext(data()),useProjectOfficeContext:()=>data(),useProjectOffices:()=>data()};});
vi.mock('../../src/app/features/staffing',()=>({StaffingDialog:()=>null,staffingEntryReason:()=> 'Keep existing staffing scope.'}));
vi.mock('../../src/app/features/subtasks',()=>({useTaskSubtasks:()=>({subtasks:[]})}));
vi.mock('../../src/app/features/task-inspector/components/InspectorSummary',()=>({InspectorSummary:()=> <p>Description, schedule, dependencies and budget</p>}));
vi.mock('../../src/app/features/task-inspector/components/InspectorTeam',()=>({InspectorTeam:({readOnly,canManageTaskTeam}:{readOnly:boolean;canManageTaskTeam:boolean})=> <p data-testid="inspector-team" data-read-only={String(readOnly)} data-legacy-manage={String(canManageTaskTeam)}>Team and subtasks</p>}));
vi.mock('../../src/app/features/task-inspector/components/InspectorProgressUpdates',()=>({InspectorProgressUpdates:()=>null}));
vi.mock('../../src/app/features/task-inspector/components/InspectorExecution',()=>({InspectorExecution:({initialAction}:{initialAction?:string})=><section aria-label="Work status and update" data-action={initialAction}>Update controls</section>}));
vi.mock('../../src/app/features/task-inspector/components/InspectorFiles',()=>({InspectorFiles:({readOnly}:{readOnly:boolean})=><p>{readOnly?'Read-only files':'Writable files'}</p>}));
vi.mock('../../src/app/shared/motion',()=>({InspectorPanel:(props:{children:React.ReactNode;ariaLabel:string})=>{state.panel(props);return <div role="dialog" aria-label={props.ariaLabel}>{props.children}</div>;}}));
vi.mock('../../src/app/features/tasks',()=>({
 TaskDepartmentLabel:()=> <span>Responsible Office</span>,TaskTeamEditorDialog:()=>null,
 TaskStatusLabel:({status}:{status:string})=> <span role="status">{status}</span>,
 TaskActivityTimeline:()=> <p>Immutable history</p>,TaskDiscussion:({canParticipate}:{canParticipate:boolean})=><p>{canParticipate?'Can discuss':'Read-only discussion'}</p>,ProgressUpdateForm:()=> <p>Progress form</p>,
 isTaskLead:()=>true,resolveSubtaskManagementCapability:(readOnly:boolean,lead:boolean)=>!readOnly&&lead,
 resolveTaskDetailCapabilities:(readOnly:boolean,cap:Record<string,boolean>)=>Object.fromEntries(Object.entries(cap).map(([key,value])=>[key,!readOnly&&value])),
}));
vi.mock('../../src/app/features/reviews',()=>({TaskReviewPanel:({canReview,showDecision}:{canReview:boolean;showDecision:boolean})=> <><p>Authorized review history</p>{canReview&&showDecision&&<p>Authorized review panel</p>}</>,SubmitForReviewForm:()=> <p>Submission form</p>,canUserReviewTask:(_t:unknown,_u:unknown,role:string)=>state.reviewEligible&&role!=='admin'}));
vi.mock('../../src/app/features/task-inspector/hooks/useInspectorLifecycle',()=>({useInspectorLifecycle:()=>({busy:false,error:'',start:vi.fn()})}));
import {TaskInspector} from '../../src/app/features/task-inspector/components/TaskInspector';
const workController={rootId:'task',actorId:'me',loading:false,error:'',unavailable:false,authorityFresh:false,refreshPending:false,pending:false,reload:vi.fn(),save:vi.fn()};
vi.mock('../../src/app/features/nested-work',async original=>({...await original<Record<string,unknown>>(),useWorkTree:vi.fn(()=>workController)}));
import {useWorkTree} from '../../src/app/features/nested-work';
beforeEach(()=>{state.role='member';state.projectStatus='active';state.shared=false;state.taskVisible=true;state.reviewEligible=true;state.task.status='for_review';state.task.proposedOfficeIdentityId=undefined;state.panel.mockClear();});afterEach(cleanup);

function NavigationProbe(){
 const [section,setSection]=useState<TaskInspectorSection>('updates');
 return <InspectorHeader task={state.task as never} tab={section} tabs={TASK_INSPECTOR_SECTIONS} onTab={setSection} onClose={()=>{}} busy={false}/>;
}

describe('My Work task page',()=>{
 it('uses the main content region with four cohesive sections and no drawer',async()=>{
  const close=vi.fn();
  render(<TaskInspector presentation="page" task={state.task as never} origin={{view:'My Work',section:'work'}} onClose={close}/>);
  expect(screen.getByRole('region',{name:'Task details: Assessment'})).toBeTruthy();
  expect(screen.getByRole('heading',{name:'Assessment',level:1})).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();expect(state.panel).not.toHaveBeenCalled();
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.queryByRole('region',{name:'Advisory staffing'})).toBeNull();
  await act(async()=>fireEvent.click(screen.getByRole('tab',{name:'Updates',exact:true})));
  expect(screen.getByText('Can discuss')).toBeTruthy();
  const updates=screen.getByRole('tab',{name:'Updates',exact:true});updates.focus();
  await act(async()=>fireEvent.keyDown(updates,{key:'ArrowRight'}));
  const files=screen.getByRole('tab',{name:'Files',exact:true});
  expect(files.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(files);
  expect(files.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
  expect(screen.getByText('Writable files')).toBeTruthy();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Back to My Work'})));
  expect(close).toHaveBeenCalledOnce();
 });
 it('renders centered dialog presentation without leaving the workspace',async()=>{
  const close=vi.fn();
  render(<TaskInspector presentation="dialog" task={state.task as never} origin={{view:'project',section:'overview'}} onClose={close}/>);
  expect(screen.getByRole('heading',{name:'Assessment',level:1})).toBeTruthy();
  expect(screen.getAllByRole('tab').map(t=>t.textContent)).toEqual(['Overview','Work','Updates','Files']);
  expect(screen.queryByRole('button',{name:'Back to project'})).toBeNull();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Close dialog'})));
  expect(close).toHaveBeenCalledOnce();
 });
 it('retains dirty drafts when a return to My Work is canceled',async()=>{
  const close=vi.fn(),uninstall=installNavigationConfirmation(vi.fn().mockResolvedValue(false));
  const blocker=renderHook(()=>useNavigationBlocker({dirty:true,label:'Task draft',onDiscard:vi.fn()}));
  try{
   render(<TaskInspector presentation="page" task={state.task as never} origin={{view:'My Work',section:'updates'}} onClose={close}/>);
   await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Back to My Work'})));
   expect(close).not.toHaveBeenCalled();expect(screen.getByRole('region',{name:'Task details: Assessment'})).toBeTruthy();
   await act(async()=>fireEvent.click(screen.getByRole('tab',{name:'Files',exact:true})));
   const active=screen.getByRole('tab',{name:'Updates',exact:true});
   expect(active.getAttribute('aria-selected')).toBe('true');expect(screen.getByRole('tab',{name:'Files',exact:true}).getAttribute('aria-selected')).toBe('false');
   active.focus();await act(async()=>fireEvent.keyDown(active,{key:'ArrowRight'}));
   expect(active.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(active);
  }finally{blocker.unmount();uninstall();}
 });
 it('keeps the return path available when task access is lost',()=>{
  state.taskVisible=false;
  render(<TaskInspector presentation="page" taskId="task" onClose={vi.fn()}/>);
  expect(screen.getByRole('region',{name:'Task unavailable'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Back to My Work'})).toBeTruthy();expect(screen.queryByRole('dialog')).toBeNull();
 });
});
describe('NW7.1 section contract and guarded keyboard navigation',()=>{
 it('resolves historical aliases into the four unified sections and defaults to Overview',()=>{
  expect(resolveTaskInspectorSection('details')).toBe('overview');expect(resolveTaskInspectorSection('team')).toBe('work');
  expect(resolveTaskInspectorSection('report-blocker')).toBe('work');expect(resolveTaskInspectorSection('submit-work')).toBe('work');
  expect(resolveTaskInspectorSection('update-work')).toBe('work');expect(resolveTaskInspectorSection('review')).toBe('work');
  expect(resolveTaskInspectorSection('activity')).toBe('updates');
  for(const section of TASK_INSPECTOR_SECTIONS)expect(resolveTaskInspectorSection(section.id)).toBe(section.id);
  expect(resolveTaskInspectorSection()).toBe('overview');
 });
 it('guards every click and arrow/Home/End transition and moves focus only after accepted discard',async()=>{
  const decision=vi.fn().mockResolvedValue(false),discard=vi.fn(),uninstall=installNavigationConfirmation(decision);
  const blocker=renderHook(()=>useNavigationBlocker({dirty:true,label:'Inspector draft',onDiscard:discard}));
  try{
   render(<NavigationProbe/>);const updates=screen.getByRole('tab',{name:'Updates'});updates.focus();
   for(const tab of screen.getAllByRole('tab')){await act(async()=>fireEvent.click(tab));expect(updates.getAttribute('aria-selected')).toBe('true');}
   for(const key of ['ArrowLeft','ArrowRight','Home','End']){await act(async()=>fireEvent.keyDown(updates,{key}));expect(updates.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(updates);}
   expect(decision).toHaveBeenCalledTimes(8);expect(discard).not.toHaveBeenCalled();
   decision.mockResolvedValue(true);await act(async()=>fireEvent.keyDown(updates,{key:'End'}));
   expect(decision).toHaveBeenCalledTimes(9);expect(discard).toHaveBeenCalledOnce();
   const files=screen.getByRole('tab',{name:'Files'});expect(files.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(files);
  }finally{blocker.unmount();uninstall();}
 });
 it('wraps keyboard selection across four sections with one tab stop',async()=>{
  render(<NavigationProbe/>);
  const select=async(key:string)=>{await act(async()=>fireEvent.keyDown(screen.getByRole('tab',{selected:true}),{key}));};
  await select('Home');expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Overview'}));
  await select('ArrowLeft');expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Files'}));
  await select('ArrowRight');expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Overview'}));
  await select('End');expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Files'}));
  expect(screen.getAllByRole('tab').filter(tab=>tab.tabIndex===0)).toHaveLength(1);
 });
 it('blocks mouse and keyboard transitions during a pending request without prompting',async()=>{
  const decision=vi.fn(),uninstall=installNavigationConfirmation(decision);
  const blocker=renderHook(()=>useNavigationBlocker({dirty:true,pending:true,label:'Saving work',onDiscard:vi.fn()}));
  try{
   render(<NavigationProbe/>);const updates=screen.getByRole('tab',{name:'Updates'});updates.focus();
   await act(async()=>fireEvent.click(screen.getByRole('tab',{name:'Work'})));
   await act(async()=>fireEvent.keyDown(updates,{key:'ArrowRight'}));
   expect(updates.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(updates);expect(decision).not.toHaveBeenCalled();
  }finally{blocker.unmount();uninstall();}
 });
});
describe('R6 shared inspector presentation and support boundary',()=>{
 it('combines team, subtasks, and execution controls cleanly inside Work',()=>{
  render(<TaskInspector task={state.task as never} presentation="page" origin={{view:'My Work',section:'work'}} onClose={()=>{}} canPostProgress/>);
  expect(screen.getByText('Team and subtasks')).toBeTruthy();
  expect(screen.getByRole('region',{name:'Work status and update'})).toBeTruthy();
 });
 it.each(['report-blocker','submit-work'] as const)('opens Work with %s action preselected',section=>{
  render(<TaskInspector task={state.task as never} origin={{view:'Inbox',section}} onClose={()=>{}} canPostProgress/>);
  expect(screen.getByRole('tab',{name:'Work',exact:true}).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('region',{name:'Work status and update'}).getAttribute('data-action')).toBe(section==='report-blocker'?'stuck':'submit');
 });
 for(const [originSection,selected] of [['details','Overview'],['overview','Overview'],['team','Work'],['work','Work'],['update-work','Work'],['review','Work'],['updates','Updates'],['activity','Updates'],['files','Files']] as const)it('opens '+originSection+' origins directly in '+selected,()=>{
  const returnFocus=document.createElement('button'),restoreFocus=vi.fn();
  render(<TaskInspector taskId="task" origin={{view:'Table',section:originSection,returnFocus,restoreFocus}} onClose={()=>{}}/>);
  const tab=screen.getByRole('tab',{name:selected});expect(tab.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tab.id);expect(tab.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
  expect(state.panel.mock.lastCall?.[0]).toMatchObject({returnFocus,onReturnFocus:restoreFocus});
 });
 it('fails closed for an unavailable canonical ID and a changed project scope',()=>{
  state.taskVisible=false;const view=render(<TaskInspector taskId="task" onClose={()=>{}} canReview/>);
  expect(screen.getByRole('dialog',{name:'Task unavailable'})).toBeTruthy();expect(screen.queryByRole('tab')).toBeNull();
  state.taskVisible=true;view.rerender(<TaskInspector task={{...state.task,linkedProjectId:'other-project'} as never} onClose={()=>{}} canReview/>);
  expect(screen.getByRole('dialog',{name:'Task unavailable'})).toBeTruthy();expect(screen.queryByRole('tab')).toBeNull();
 });
 it('keeps review history visible while current decision authority is revoked',()=>{
  const view=render(<TaskInspector task={state.task as never} origin={{view:'Inbox',section:'review'}} onClose={()=>{}} canReview/>);
  expect(screen.getByText('Authorized review panel')).toBeTruthy();
  state.reviewEligible=false;view.rerender(<TaskInspector task={state.task as never} origin={{view:'Inbox',section:'review'}} onClose={()=>{}} canReview/>);
  expect(screen.getByText('Authorized review history')).toBeTruthy();expect(screen.queryByText('Authorized review panel')).toBeNull();
 });
 for(const locked of ['completed','readOnly','proposed','noCallerPermission'])it('shows historical Review without decisions for '+locked,()=>{
  if(locked==='completed')state.task.status='completed';
  if(locked==='proposed')state.task.proposedOfficeIdentityId='proposed';
  render(<TaskInspector task={state.task as never} origin={{view:'Table',section:'review'}} onClose={()=>{}} canReview={locked!=='noCallerPermission'} readOnly={locked==='readOnly'}/>);
  expect(screen.getByText('Authorized review history')).toBeTruthy();
  expect(screen.queryByText('Authorized review panel')).toBeNull();
 });
 it('shows four unified sections with distinct Overview, Work, Updates, and Files and no task chat link',async()=>{
  render(<TaskInspector task={state.task as never} onClose={()=>{}} canReview canPostProgress/>);
  expect(screen.getAllByRole('tab').map(t=>t.textContent)).toEqual(['Overview','Work','Updates','Files']);
  await screen.findByText('Description, schedule, dependencies and budget');expect(screen.queryByRole('link',{name:'Open task chat'})).toBeNull();expect(screen.queryByRole('button',{name:'Open task chat'})).toBeNull();expect(screen.queryByText('Team and subtasks')).toBeNull();
  fireEvent.click(screen.getByRole('tab',{name:'Work',exact:true}));await screen.findByText('Team and subtasks');expect(screen.getByText('Authorized review panel')).toBeTruthy();expect(screen.queryByText('Description, schedule, dependencies and budget')).toBeNull();
  fireEvent.click(screen.getByRole('tab',{name:'Updates',exact:true}));await screen.findByText('Can discuss');fireEvent.click(screen.getByRole('button',{name:'Activity log'}));await waitFor(()=>expect(screen.getByText('Immutable history')).toBeTruthy());
  fireEvent.click(screen.getByRole('tab',{name:'Files',exact:true}));await screen.findByText('Writable files');expect(screen.queryByText('Authorized review panel')).toBeNull();
 });
 it('keeps Admin support read only even when a caller passes operational flags',async()=>{
  state.role='admin';render(<TaskInspector task={state.task as never} origin={{view:'Inbox',section:'updates'}} onClose={()=>{}} canReview canPostProgress canSubmitForReview canDiscuss/>);
  expect(screen.getByText('Read-only discussion')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Activity log'}));await waitFor(()=>expect(screen.getByText('Immutable history')).toBeTruthy());
  fireEvent.click(screen.getByRole('tab',{name:'Work',exact:true}));await screen.findByText('Authorized review history');expect(screen.queryByText('Authorized review panel')).toBeNull();expect(screen.queryByText('Progress form')).toBeNull();
  fireEvent.click(screen.getByRole('tab',{name:'Files',exact:true}));await screen.findByText('Read-only files');
 });
});

describe('NW3.3 Inspector staffing scope',()=>{
 it('keeps one supported controller owner across section changes and starts none for proposed work',async()=>{
  vi.mocked(useWorkTree).mockClear();
  const view=render(<TaskInspector task={state.task as never} onClose={()=>{}}/>);
  expect(useWorkTree).toHaveBeenCalledTimes(1);expect(useWorkTree).toHaveBeenCalledWith('task');
  await act(async()=>fireEvent.click(screen.getByRole('tab',{name:'Work',exact:true})));
  await act(async()=>fireEvent.click(screen.getByRole('tab',{name:'Overview',exact:true})));
  await act(async()=>fireEvent.click(screen.getByRole('tab',{name:'Work',exact:true})));
  expect(useWorkTree).toHaveBeenCalledTimes(1);
  view.unmount();vi.mocked(useWorkTree).mockClear();state.task.proposedOfficeIdentityId='proposed';
  render(<TaskInspector task={state.task as never} origin={{view:'Table',section:'work'}} onClose={()=>{}}/>);
  expect(useWorkTree).not.toHaveBeenCalled();expect(screen.getByTestId('inspector-team').getAttribute('data-read-only')).toBe('true');
 });
 it('does not impose legacy Head-only messaging on supported shared Leads',async()=>{
  state.shared=true;render(<TaskInspector task={state.task as never} onClose={()=>{}}/>);fireEvent.click(screen.getByRole('tab',{name:'Work',exact:true}));
  const team=await screen.findByTestId('inspector-team');expect(team.getAttribute('data-read-only')).toBe('false');expect(team.getAttribute('data-legacy-manage')).toBe('false');expect(screen.queryByText(/only the responsible Office Head can change/)).toBeNull();
 });
 for(const projectStatus of ['completed','archived'])it('propagates '+projectStatus+' project lock to Inspector staffing and nested widget composition',async()=>{
  state.projectStatus=projectStatus;render(<TaskInspector task={state.task as never} onClose={()=>{}}/>);fireEvent.click(screen.getByRole('tab',{name:'Work',exact:true}));expect((await screen.findByTestId('inspector-team')).getAttribute('data-read-only')).toBe('true');
 });
 it('propagates explicit read-only oversight to Inspector staffing',async()=>{
  render(<TaskInspector task={state.task as never} readOnly onClose={()=>{}}/>);fireEvent.click(screen.getByRole('tab',{name:'Work',exact:true}));expect((await screen.findByTestId('inspector-team')).getAttribute('data-read-only')).toBe('true');
 });
});
