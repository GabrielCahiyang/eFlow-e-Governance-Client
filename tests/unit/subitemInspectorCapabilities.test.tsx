// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
import type {WorkNode,WorkTreeController,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
const api=vi.hoisted(()=>({actor:'actor',load:vi.fn(),save:vi.fn(),progress:vi.fn(),submit:vi.fn(),sign:vi.fn(),reviewReads:vi.fn(),decide:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,role:'member',org_id:'office',is_active:true}})}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({fetchSubitemInspectorRecord:api.load,saveSubtaskWorkUpdate:api.progress,submitSubtaskForReview:api.submit,getSubtaskEvidenceUrl:api.sign,subscribeToPendingSubtaskReviews:api.reviewReads,decideSubtaskReview:api.decide}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:vi.fn(),saveWorkTree:api.save,fetchWorkImpact:vi.fn(),WorkTreeUnavailable:class extends Error{}}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('../../src/app/features/subtasks/hooks/useSubtaskReviewerDirectory',()=>({useSubtaskReviewerDirectory:()=>({reviewersById:{actor:{id:'actor',name:'Current reviewer',role:'member'}},loading:false})}));
vi.mock('../../src/app/features/budget/hooks/useDepartmentBudget',()=>({useDepartmentBudget:()=>({summary:{status:'locked'},allocations:[],allocationLines:[],requests:[],requestAttachments:[],releases:[],liquidations:[],loading:false,refresh:vi.fn()})}));
vi.mock('../../src/app/features/budget/hooks/useTaskFundingContext',()=>({useTaskFundingContext:()=>({context:{funded:true,taskId:'root',subtaskId:'node',taskLeaderId:'root-lead',taskBudget:1000,available:500,lines:[]},loading:false,refresh:vi.fn()})}));
vi.mock('../../src/app/features/subtasks/components/SubtaskDeadlineEditor',()=>({SubtaskDeadlineEditor:({canManage}:{canManage:boolean})=><div>{canManage?'Authorized deadline control':'Deadline history'}</div>}));
import {SubitemInspector} from '../../src/app/features/subtasks/components/SubitemInspector';
const allow={allowed:true,reason_code:null} as const,deny={allowed:false,reason_code:'branch_denied'} as const;
const task:Task={id:'root',title:'Root',status:'todo',linkedProjectId:'project',orgId:'office',assigneeId:'root-lead',createdAt:1,updatedAt:1};
function tree(patch:Partial<WorkNode>={}):WorkTreeSnapshot{
 const node:WorkNode={id:'node',task_id:'root',title:'Assigned item',parent_subtask_id:null,lead_id:'actor',assigned_to_ids:[],depth:1,sibling_order:0,due_date:null,is_standalone:true,status:'todo',percent_complete:20,can_manage:true,can_appoint:true,can_work:true,can_order:true,can_review:true,capabilities:{execute:deny,submit:deny,review:deny,manage_contributors:deny,appoint_lead:deny,create_child:deny,order_children:deny,edit_details:deny,move:deny,delete:deny},...patch};
 const value:WorkTreeSnapshot={root:{id:'root',kind:'office',office:'office',project:'project',lead:'root-lead',people:['root-lead'],open:true,due:null},revision:7,nodes:[node],people:[{id:'actor',name:'Actor',eligible:true},{id:'root-lead',name:'Root Lead',eligible:true}],can_manage:true,can_transfer:true,leaf_total:1,leaf_completed:0};rememberWorkCapabilityContext(value,api.actor);return value;
}
function controller(data:WorkTreeSnapshot):WorkTreeController{return {rootId:'root',actorId:api.actor,data,loading:false,error:'',unavailable:false,authorityFresh:true,pending:false,refreshPending:false,reload:vi.fn(),save:api.save};}
const submission={id:'attempt',subtaskId:'node',taskId:'root',submitterId:'worker',submitterName:'Historical worker',reviewerId:'old-reviewer',note:'Recorded evidence',version:1,status:'pending' as const,submittedAt:1,attachments:[]};
beforeEach(()=>{vi.clearAllMocks();api.actor='actor';api.load.mockResolvedValue({subtask:{id:'node',taskId:'root',title:'Assigned item',assignedToIds:[],status:'todo',isStandalone:true,percentComplete:20,createdAt:1,updatedAt:1},submissions:[],progressUpdates:[]});api.progress.mockResolvedValue(undefined);api.sign.mockResolvedValue(null);api.reviewReads.mockImplementation((_actor,_all,callback)=>{callback([{subtask:{id:'node',taskId:'root',title:'Assigned item',status:'for_review'},submission,taskTitle:'Root'}]);return()=>{};});});
afterEach(cleanup);
describe('NW8.2 independent Inspector action capabilities',()=>{
 it('does not grant execution on a sibling branch from an actor\'s own Lead appointment',async()=>{
  const data=tree({lead_id:'other-lead'});data.nodes.push({...data.nodes[0],id:'owned-sibling',lead_id:'actor',capabilities:{...data.nodes[0].capabilities,execute:allow}});
  render(<SubitemInspector rootTask={task} itemId="node" controller={controller(data)} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});expect(screen.queryByRole('button',{name:'Start work'})).toBeNull();expect(api.progress).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Child work actions'})).toBeNull();
 });
 it('requires independent submit capability and retains the note/evidence until it is granted',async()=>{
  const data=tree();data.nodes[0].capabilities!.execute=allow;const c=controller(data),view=render(<SubitemInspector rootTask={task} itemId="node" controller={c} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});
  await screen.findByLabelText('Work status');fireEvent.change(screen.getByLabelText('Work status'),{target:{value:'submit'}});fireEvent.change(screen.getByLabelText('Completion note'),{target:{value:'Ready for independent review'}});const file=new File(['proof'],'proof.pdf',{type:'application/pdf'});fireEvent.change(screen.getByLabelText('Evidence files'),{target:{files:[file]}});
  expect(screen.getByRole('button',{name:'Submit for review'}).hasAttribute('aria-disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Submit for review'}));expect(api.submit).not.toHaveBeenCalled();
  data.nodes[0].capabilities!.submit=allow;view.rerender(<SubitemInspector rootTask={task} itemId="node" controller={c} onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Submit for review'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());expect(api.submit.mock.calls[0][0]).toEqual({subtaskId:'node',note:'Ready for independent review',evidence:[file]});
 });
 it('allows own eligible Lead-only execution without a contributor assignment or financial privilege',async()=>{
  const data=tree();data.nodes[0].capabilities!.execute=allow;data.nodes[0].capabilities!.submit=allow;
  render(<SubitemInspector rootTask={task} itemId="node" controller={controller(data)} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});
  expect(await screen.findByRole('button',{name:'Start work'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();
  fireEvent.change(screen.getByLabelText('Work update'),{target:{value:'Lead work'}});fireEvent.click(screen.getByRole('button',{name:'Start work'}));await waitFor(()=>expect(api.progress).toHaveBeenCalledOnce());expect(api.progress.mock.calls[0][0].subtaskId).toBe('node');
 });
 it('keeps reviewer-only access independent of permissive old execute/manage flags',async()=>{
  const data=tree({status:'for_review',percent_complete:100,current_reviewer:'actor'});data.nodes[0].capabilities!.review=allow;
  render(<SubitemInspector rootTask={task} itemId="node" controller={controller(data)} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});
  expect(screen.queryByRole('button',{name:'Save update'})).toBeNull();expect(screen.queryByRole('button',{name:'Child work actions'})).toBeNull();expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();
  // The review workspace now loads at its public view boundary. Await readiness
  // before asserting the same decision permissions and absence of work writes.
  fireEvent.click(screen.getByRole('button',{name:'Review evidence'}));await screen.findByRole('button',{name:'Approve evidence'},{timeout:10000});expect(api.reviewReads).toHaveBeenCalledWith('actor',false,expect.any(Function),expect.any(Function));expect(api.progress).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();
 },15000);
 it('retains feedback but disables review decisions when current review authority is revoked',async()=>{
  const data=tree({status:'for_review',current_reviewer:'actor'});data.nodes[0].capabilities!.review=allow;const c=controller(data),view=render(<SubitemInspector rootTask={task} itemId="node" controller={c} onClose={()=>{}}/>);await screen.findByRole('button',{name:'Review evidence'});fireEvent.click(screen.getByRole('button',{name:'Review evidence'}));
  const feedback=await screen.findByPlaceholderText('Explain what needs correction…');fireEvent.change(feedback,{target:{value:'Retain my review feedback'}});
  const revoked=tree({status:'for_review',current_reviewer:'replacement'});view.rerender(<SubitemInspector rootTask={task} itemId="node" controller={{...c,data:revoked}} onClose={()=>{}}/>);
  expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Retain my review feedback');expect(screen.getByRole('button',{name:'Approve evidence'}).hasAttribute('aria-disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Approve evidence'}));expect(api.decide).not.toHaveBeenCalled();expect(submission.reviewerId).toBe('old-reviewer');
 });
 it('lets an assigned contributor execute/request cash while management remains absent',async()=>{
  const data=tree({assigned_to_ids:['actor'],lead_id:'other'});data.nodes[0].capabilities!.execute=allow;
  render(<SubitemInspector rootTask={task} itemId="node" controller={controller(data)} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});expect(await screen.findByRole('button',{name:'Start work'})).toBeTruthy();fireEvent.click(screen.getByText('Funding details'));await screen.findByRole('button',{name:'Request cash'});expect(screen.queryByRole('button',{name:'Child work actions'})).toBeNull();expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();
 });
 it('allows branch management without converting it into execution or cap authority',async()=>{
  const data=tree();data.nodes[0].capabilities!.manage_contributors=allow;data.nodes[0].capabilities!.edit_details=allow;
  render(<SubitemInspector rootTask={task} itemId="node" controller={controller(data)} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});expect(screen.queryByRole('button',{name:'Start work'})).toBeNull();expect(screen.getByText('Authorized deadline control')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('button',{name:'Child work actions'}),{key:'Enter'});await screen.findByRole('menuitem',{name:'Choose people'});expect(screen.queryByRole('menuitem',{name:'Review',exact:true})).toBeNull();expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();expect(api.save).not.toHaveBeenCalled();
 });
 for(const [label,patch,eligible] of [['history-only',{},true],['archived',{archivedAt:1},true],['expired',{},false]] as const)it(`blocks old assigned-worker funding and execution for ${label}`,async()=>{
  const data=tree({assigned_to_ids:['actor']});data.nodes[0].capabilities!.execute=label==='expired'?{allowed:false,reason_code:'access_unavailable'}:allow;data.people[0].eligible=eligible;
  render(<SubitemInspector rootTask={{...task,...patch}} itemId="node" controller={controller(data)} readOnly={label==='history-only'} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});expect(screen.queryByRole('button',{name:'Start work'})).toBeNull();expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();expect(screen.queryByRole('button',{name:'Child work actions'})).toBeNull();
 });
 it('keeps funding rights independent of execution and review capabilities',async()=>{
  const data=tree({assigned_to_ids:['actor']});const c=controller(data),view=render(<SubitemInspector rootTask={task} itemId="node" controller={c} executionBlocked onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Assigned item'});fireEvent.click(screen.getByText('Funding details'));await screen.findByRole('button',{name:'Request cash'});expect(screen.queryByRole('button',{name:'Start work'})).toBeNull();
  view.rerender(<SubitemInspector rootTask={task} itemId="node" controller={{...c,refreshPending:true}} onClose={()=>{}}/>);expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();
 });
 it('keeps formal evidence denied when the signing service returns no URL',async()=>{
  api.load.mockResolvedValue({subtask:{id:'node',taskId:'root',assignedToIds:[],status:'todo'},submissions:[{...submission,attachments:[{fileName:'private.pdf',filePath:'sealed/path',fileSize:1,mimeType:'application/pdf'}]}],progressUpdates:[]});
  render(<SubitemInspector rootTask={task} itemId="node" controller={controller(tree())} onClose={()=>{}}/>);await screen.findByText('private.pdf');await waitFor(()=>expect(api.sign).toHaveBeenCalledWith('sealed/path'));expect(screen.getByText('private.pdf').closest('a')!.getAttribute('href')).toBeNull();expect(screen.getByText('private.pdf').closest('a')!.getAttribute('aria-disabled')).toBe('true');
 });
});
