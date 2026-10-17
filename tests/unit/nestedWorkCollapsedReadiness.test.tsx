// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {useState} from 'react';
import type {Task} from '../../src/app/features/tasks';
import type {Subtask} from '../../src/app/features/subtasks';
import type {WorkNode,WorkTreeSnapshot} from '../../src/app/features/nested-work';
const mocks=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'task-lead'},userProfile:{id:'task-lead',role:'member',org_id:'office',is_active:true}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:mocks.load,saveWorkTree:mocks.save,fetchPersonalWorkRoots:vi.fn(),fetchOfficeWorkRoots:vi.fn(),fetchWorkEvents:vi.fn(),WorkTreeUnavailable:class WorkTreeUnavailable extends Error{}}));
vi.mock('../../src/app/features/subtasks',async()=>{
 const {WorkTree}=await import('../../src/app/features/nested-work');
 return {TaskSubtasksWidget:({taskId,controller}:{taskId:string;controller?:import('../../src/app/features/nested-work').WorkTreeController})=><WorkTree rootId={taskId} controller={controller}/>,createSubtask:vi.fn(),updateSubtask:vi.fn(),parentTaskDueDate:vi.fn()};
});
vi.mock('../../src/app/features/tasks',async()=>{
 const {getTaskLeadId}=await import('../../src/app/features/tasks/selectors/teamMembership');
 const {isTaskLead}=await import('../../src/app/features/tasks/selectors/leadership');
 return {getTaskLeadId,isTaskLead,TASK_STATUS_LABELS:{todo:'To Do',in_progress:'In Progress',for_review:'For Review',completed:'Completed',cancelled:'Cancelled'},TaskTeamEditorDialog:()=>null};
});
vi.mock('../../src/app/features/project-offices',()=>({useProjectOfficeContext:()=>({offices:[],members:[],error:''}),projectOfficePeople:()=>[],moveProjectOfficeTask:vi.fn()}));
vi.mock('../../src/app/features/project-table/services/workspaceService',()=>({patchWorkspaceTask:vi.fn()}));
vi.mock('../../src/app/features/project-table/components/ProjectTaskCells',()=>({ProjectTaskCell:()=>null}));
vi.mock('../../src/app/features/staffing',()=>({StaffingDialog:()=>null}));
import {ProjectTaskRow} from '../../src/app/features/project-table/components/ProjectTaskRow';
import {SubmitForReviewModal} from '../../src/app/features/tasks/components/board/TaskSubmissionModals';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';

afterEach(()=>{cleanup();vi.resetAllMocks();});
describe('NW4.2 Main Table collapse preserves required descendant readiness',()=>{
 it.each([1,8])('keeps a required depth-%i descendant in readiness while the real task row is collapsed',async depth=>{
  const nodes:WorkNode[]=Array.from({length:depth},(_,i)=>({id:'depth-'+(i+1),task_id:'root',parent_subtask_id:i?'depth-'+i:null,lead_id:'task-lead',title:'Required depth '+(i+1),assigned_to_ids:['task-lead'],depth:i+1,sibling_order:0,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:false,can_appoint:false,can_order:false,can_work:false,can_review:false}));
  const snapshot:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',lead:'task-lead',kind:'office',open:true,due:null,people:['task-lead']},revision:1,can_manage:false,can_transfer:false,nodes,people:[],leaf_total:1,leaf_completed:0};
  rememberWorkCapabilityContext(snapshot,'task-lead');
  mocks.load.mockResolvedValue(snapshot);
  const task:Task={id:'root',title:'Office delivery',orgId:'office',linkedProjectId:'project',assigneeId:'task-lead',status:'in_progress',percentComplete:37,subtaskCount:depth,subtaskCompletedCount:0,createdAt:1,updatedAt:1};
  const subtasks=nodes.map((n,i)=>({id:n.id,taskId:'root',title:n.title,status:n.status,isCompleted:false,percentComplete:0,assignedToIds:['task-lead'],position:i,isStandalone:true,source:'manual',createdAt:1,updatedAt:1})) as Subtask[];
  const onSubmit=vi.fn();
  function Surface(){const [open,setOpen]=useState(false);return <><table><tbody><ProjectTaskRow task={task} tasks={[task]} groups={[]} profiles={[]} orgs={[]} columns={[]} editable={false} userId="task-lead" subtasks={subtasks} onOpen={vi.fn()} onOpenSubitem={vi.fn()} refreshSubitems={vi.fn()} reorderable={false} onMove={vi.fn()} run={async fn=>{await fn();}}/></tbody></table><button onClick={()=>setOpen(true)}>Check readiness</button><SubmitForReviewModal open={open} task={task} note="Explicit root note" attachments={[]} onNoteChange={vi.fn()} onAttachmentsChange={vi.fn()} onRemoveAttachment={vi.fn()} onClose={()=>setOpen(false)} onSubmit={onSubmit} submitting={false} error=""/></>;}
  render(<Surface/>);
  const toggle=screen.getByRole('button',{name:'Subitems for Office delivery'});
  expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(screen.queryByText('Required depth '+depth)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Check readiness'}));
  expect(screen.getByText(`0 of ${depth} subtasks approved`)).toBeTruthy();expect((screen.getByRole('button',{name:'Submit for Review'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  fireEvent.click(toggle);await screen.findByRole('button',{name:'Required depth '+depth,exact:true});
  expect(screen.getByText(/Final steps approved: 0 of 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Check readiness'}));
  expect((screen.getByRole('button',{name:'Submit for Review'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  fireEvent.click(toggle);expect(screen.queryByText('Required depth '+depth)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Check readiness'}));
  fireEvent.click(screen.getByRole('button',{name:'Submit for Review'}));expect(onSubmit).not.toHaveBeenCalled();expect(task.percentComplete).toBe(37);
  expect(snapshot.nodes).toHaveLength(depth);expect(snapshot.nodes.at(-1)?.status).toBe('todo');expect(mocks.save).not.toHaveBeenCalled();
 });
});
