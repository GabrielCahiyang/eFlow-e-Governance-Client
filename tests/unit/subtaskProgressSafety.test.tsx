// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:api.load}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({saveSubtaskWorkUpdate:api.save}));
import {SubtaskProgressForm} from '../../src/app/features/subtasks/components/SubtaskProgressForm';
import {verifySubtaskProgressAccess} from '../../src/app/features/subtasks/services/subtaskProgressAccess';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {MutationRejectedError} from '../../src/app/shared/MutationRejectedError';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import type {Subtask} from '../../src/app/services/subtaskService';

const allow={allowed:true,reason_code:null} as const;
function tree():WorkTreeSnapshot {
 const value:WorkTreeSnapshot={root:{id:'task',project:'project',office:'office',kind:'office',lead:'task-lead',people:[],open:true,status:'in_progress',project_status:'active',due:null},revision:7,can_manage:false,can_transfer:false,leaf_total:1,leaf_completed:0,people:[],
  nodes:[{id:'step',task_id:'task',parent_subtask_id:null,lead_id:'lead',assigned_to_ids:['lead'],title:'Step',status:'in_progress',percent_complete:0,sibling_order:0,depth:1,due_date:null,is_standalone:true,can_manage:false,can_appoint:false,can_order:false,can_work:true,can_review:false,capabilities:{execute:allow}}]};
 rememberWorkCapabilityContext(value,'lead');return value;
}
const context={actorId:'lead',rootId:'task',projectId:'project',officeId:'office',kind:'office' as const,revision:7};
const subtask={id:'step',taskId:'task',title:'Step',status:'in_progress',percentComplete:0,assignedToIds:['lead'],dependencyIds:[]} as Subtask;
beforeEach(()=>{vi.resetAllMocks();api.load.mockImplementation(async()=>tree());api.save.mockResolvedValue(undefined);});
afterEach(cleanup);

describe('fresh direct subtask progress access',()=>{
 it('accepts only current scope, revision, explicit execution permission and participation',async()=>{
  await expect(verifySubtaskProgressAccess(tree(),'step',context)).resolves.toBeUndefined();
  expect(api.load).toHaveBeenCalledWith('task');
 });
 it.each(['revision','office','project','actor','permission','participation','hold','missing'])('rejects changed %s before a write',async change=>{
  const baseline=tree(),fresh=tree();
  if(change==='revision')fresh.revision++;
  if(change==='office')fresh.root.office='other';
  if(change==='project')fresh.root.project='other';
  if(change==='permission')fresh.nodes[0].capabilities!.execute={allowed:false,reason_code:'branch_denied'};
  if(change==='participation'){fresh.nodes[0].lead_id='someone';fresh.nodes[0].assigned_to_ids=[];}
  if(change==='hold')fresh.root.project_status='on_hold';
  if(change==='missing')fresh.nodes=[];
  rememberWorkCapabilityContext(fresh,change==='actor'?'someone':'lead');api.load.mockResolvedValue(fresh);
  await expect(verifySubtaskProgressAccess(baseline,'step',context)).rejects.toThrow(/access or revision changed/);
  expect(api.save).not.toHaveBeenCalled();
 });
});

describe('direct blocker updates',()=>{
 function open(onSaved=vi.fn().mockResolvedValue(undefined),recheck=vi.fn().mockResolvedValue(undefined)){
  render(<SubtaskProgressForm subtask={subtask} initialBlocker="Waiting for equipment" showCompletion={false} onSaved={onSaved} recheckProgress={recheck}/>);
  return {onSaved,recheck};
 }
 it('clears a blocker only after fresh validation and refreshes once',async()=>{
  const {onSaved,recheck}=open();
  fireEvent.change(screen.getByLabelText('Work status'),{target:{value:'in_progress'}});
  fireEvent.click(screen.getByRole('button',{name:'Save update'}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
  expect(recheck).toHaveBeenCalledOnce();
  expect(api.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({subtaskId:'step',state:'in_progress',blocker:''}));
 });
 it('preserves the draft when a fresh preflight rejects the update',async()=>{
  open(undefined,vi.fn().mockRejectedValue(new Error('Work access or revision changed.')));
  fireEvent.change(screen.getByLabelText('Work update'),{target:{value:'Keep this note'}});
  fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
  await screen.findByText('Work access or revision changed.');
  expect(api.save).not.toHaveBeenCalled();expect((screen.getByLabelText('Work update') as HTMLTextAreaElement).value).toBe('Keep this note');
 });
 it('blocks edits and blind retries after an uncertain response',async()=>{
  api.save.mockRejectedValue(new Error('Connection lost'));
  const {onSaved}=open();fireEvent.change(screen.getByLabelText('Work update'),{target:{value:'Keep this note'}});
  fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
  await screen.findByText(/check its work history before posting again/);
  const button=screen.getByRole('button',{name:'Report blocker'});
  expect(button.getAttribute('aria-disabled')).toBe('true');expect(screen.getByLabelText('Work update').matches(':disabled')).toBe(true);
  fireEvent.click(button);expect(api.save).toHaveBeenCalledOnce();expect(onSaved).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Work update') as HTMLTextAreaElement).value).toBe('Keep this note');
 });
 it('allows a corrected retry only after a confirmed rejection',async()=>{
  api.save.mockRejectedValueOnce(new MutationRejectedError('Rejected before commit','23514'));
  const {onSaved}=open();fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
  await screen.findByText('Rejected before commit');
  expect(screen.getByRole('button',{name:'Report blocker'}).matches(':disabled')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());expect(api.save).toHaveBeenCalledTimes(2);
 });
 it('keeps a confirmed update locked when the refresh fails',async()=>{
  open(vi.fn().mockRejectedValue(new Error('Refresh failed')));fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
  await screen.findByText(/Your update was saved, but this view could not refresh/);
  fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));expect(api.save).toHaveBeenCalledOnce();
  expect(screen.getByRole('button',{name:'Report blocker'}).getAttribute('aria-disabled')).toBe('true');
 });
 it('does not send twice while the preflight is pending',async()=>{
  let resolve!:()=>void;const preflight=vi.fn(()=>new Promise<void>(done=>{resolve=done;}));
  open(undefined,preflight);const button=screen.getByRole('button',{name:'Report blocker'});
  fireEvent.click(button);fireEvent.click(button);expect(preflight).toHaveBeenCalledOnce();
  await act(async()=>resolve());await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());
 });
 it('keeps the opening revision when a background refresh arrives during a draft',async()=>{
  const baseline=tree(),onSaved=vi.fn();
  const view=render(<SubtaskProgressForm subtask={subtask} showCompletion={false} onSaved={onSaved} recheckProgress={()=>verifySubtaskProgressAccess(baseline,'step',context)}/>);
  fireEvent.change(screen.getByLabelText('Work update'),{target:{value:'My draft'}});
  const changed=tree();changed.revision=8;rememberWorkCapabilityContext(changed,'lead');api.load.mockResolvedValue(changed);
  view.rerender(<SubtaskProgressForm subtask={subtask} showCompletion={false} onSaved={onSaved} recheckProgress={()=>verifySubtaskProgressAccess(changed,'step',{...context,revision:8})}/>);
  fireEvent.click(screen.getByRole('button',{name:'Save update'}));
  await screen.findByText(/Work access or revision changed/);expect(api.save).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Work update') as HTMLTextAreaElement).value).toBe('My draft');
 });
});
