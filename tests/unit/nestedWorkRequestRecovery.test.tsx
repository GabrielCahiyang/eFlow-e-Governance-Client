// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,renderHook,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({actor:'actor',rpc:vi.fn(),session:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor}})}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
import {useWorkEditorDraft} from '../../src/app/features/nested-work/hooks/useWorkEditorDraft';
import {WorkTreeEditor} from '../../src/app/features/nested-work/components/WorkTreeEditor';
import {saveWorkTree} from '../../src/app/features/nested-work/services/workTreeService';
import {workRpcFailure} from '../../src/app/features/nested-work/services/workRequestOutcome';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {installNavigationConfirmation,requestNavigation} from '../../src/app/shared/navigationGuard';
import type {WorkCapabilityContext,WorkCommand,WorkNode,WorkRequest,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import type {WorkEdit} from '../../src/app/features/nested-work/types/editor';

const allow={allowed:true,reason_code:null} as const,deny={allowed:false,reason_code:'branch_denied'} as const;
const node=():WorkNode=>({id:'node',task_id:'root',parent_subtask_id:null,lead_id:'actor',assigned_to_ids:['actor'],title:'Original',sibling_order:0,depth:1,due_date:'2026-12-01',is_standalone:false,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:true,can_work:true,can_review:true,capabilities:{create_child:allow,order_children:allow,edit_details:allow,move:allow,delete:allow,execute:allow,submit:allow,review:allow,manage_contributors:allow,appoint_lead:allow}});
function tree(revision=7):WorkTreeSnapshot {
 const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',lead:'actor',people:['actor'],open:true,due:'2026-12-31',capabilities:{create_child:allow,order_children:allow,manage_contributors:allow,appoint_lead:allow}},revision,can_manage:true,can_transfer:true,nodes:[node()],people:[{id:'actor',name:'Actor',eligible:true}],leaf_total:1,leaf_completed:0};rememberWorkCapabilityContext(data,'actor');return data;
}
const context=(data:WorkTreeSnapshot,actorId='actor'):WorkCapabilityContext=>({actorId,rootId:data.root.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision});
function editor(data=tree(),edit:WorkEdit={command:'create'}) {
 return renderHook(({snapshot,actorId,refreshPending})=>useWorkEditorDraft({data:snapshot,edit,context:context(snapshot,actorId),refreshPending,onCancel:vi.fn()}),{initialProps:{snapshot:data,actorId:'actor',refreshPending:false}});
}
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.actor='actor';api.session.mockResolvedValue({data:{session:{user:{id:'actor'},access_token:'synthetic-token'}},error:null});});afterEach(cleanup);
describe('NW5.3 request recovery and current action authority',()=>{
 it('rejects a duplicate sibling name before dispatch but allows the same name under a different parent',async()=>{
  const hook=editor(),save=vi.fn().mockResolvedValue(tree(8));
  act(()=>hook.result.current.update('title','  ORIGINAL  '));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));
  expect(save).not.toHaveBeenCalled();expect(hook.result.current.outcome).toMatchObject({kind:'confirmed_failure',message:expect.stringContaining('already exists')});
  act(()=>{hook.result.current.update('parent','node');hook.result.current.update('due','2026-12-01');});
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));
  expect(save).toHaveBeenCalledTimes(1);
 });
 it('does not prompt when cancelling an untouched form and guards a changed applicable field',async()=>{
  const confirmation=vi.fn().mockResolvedValue(false),uninstall=installNavigationConfirmation(confirmation);
  try{
   const data=tree(),onCancel=vi.fn(),view=render(<WorkTreeEditor data={data} edit={{command:'edit',node:data.nodes[0]}} save={vi.fn()} onCancel={onCancel} onDone={vi.fn()}/>);
   fireEvent.click(screen.getByRole('button',{name:'Cancel changes'}));expect(onCancel).toHaveBeenCalledTimes(1);expect(confirmation).not.toHaveBeenCalled();
   fireEvent.change(screen.getByLabelText('Subitem due date'),{target:{value:'2026-11-01'}});expect(await requestNavigation(vi.fn())).toBe(false);expect(confirmation).toHaveBeenCalledTimes(1);view.unmount();
  }finally{uninstall();}
 });
 it('coalesces synchronous double submission and blocks navigation while waiting',async()=>{
  const hook=editor();let resolve!:(receipt:WorkTreeSnapshot)=>void;const save=vi.fn(()=>new Promise<WorkTreeSnapshot>(yes=>{resolve=yes;})),onDone=vi.fn();
  let pending!:Promise<void>;
  act(()=>{hook.result.current.update('title','Created');pending=hook.result.current.submit({save,onDone});void hook.result.current.submit({save,onDone});});
  expect(save).toHaveBeenCalledTimes(1);expect(await requestNavigation(vi.fn())).toBe(false);
  await act(async()=>{resolve(tree(8));await pending;});expect(hook.result.current.outcome.kind).toBe('committed');expect(onDone).toHaveBeenCalledTimes(1);
 });
 it('retains edited fields and initial revision across a fresh tree revision',async()=>{
  const hook=editor();act(()=>hook.result.current.update('title','Retained'));const baseline=hook.result.current.baseline;
  hook.rerender({snapshot:tree(9),actorId:'actor',refreshPending:false});expect(hook.result.current.fields.title).toBe('Retained');expect(hook.result.current.baseline).toBe(baseline);
  const save=vi.fn().mockRejectedValue(workRpcFailure({code:'40001',message:'Work changed'}));await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));
  expect(save.mock.calls[0][0].revision).toBe(7);expect(hook.result.current.outcome.kind).toBe('stale_revision');expect(hook.result.current.authorized).toBe(false);expect(hook.result.current.fields.title).toBe('Retained');
 });
 it('retries uncertain results with the same object, UUIDs, payload, revision and fingerprint',async()=>{
  const hook=editor();act(()=>hook.result.current.update('title','Created'));const save=vi.fn().mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce(tree(9));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn(),impactFingerprint:'first'}));const original=save.mock.calls[0][0];
  expect(hook.result.current.outcome.kind).toBe('unknown_result');expect(hook.result.current.locked).toBe(true);
  act(()=>hook.result.current.update('title','Tampered'));hook.rerender({snapshot:tree(9),actorId:'actor',refreshPending:false});
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn(),impactFingerprint:'changed'}));expect(save.mock.calls[1][0]).toBe(original);
  expect(original).toMatchObject({revision:7,impactFingerprint:'first',payload:{title:'Created'}});expect(original.payload.id).toBe(hook.result.current.baseline.createdId);
 });
 it('retains the original uncertain request when a later receipt lookup is rejected',async()=>{
  const hook=editor(),save=vi.fn().mockRejectedValueOnce(new Error('First response lost')).mockRejectedValueOnce(workRpcFailure({code:'PGRST202',message:'Receipt RPC unavailable'})).mockResolvedValueOnce(tree(8));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn(),impactFingerprint:'first'}));const original=save.mock.calls[0][0];
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn(),impactFingerprint:'second'}));
  expect(hook.result.current.outcome.kind).toBe('unknown_result');expect(hook.result.current.request).toBe(original);expect(hook.result.current.locked).toBe(true);expect(hook.result.current.dirty).toBe(true);
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn(),impactFingerprint:'third'}));expect(save.mock.calls.map(call=>call[0])).toEqual([original,original,original]);
 });
 it.each(['40001','42501'])('retains uncertain-request navigation protection after blocking retry %s',async code=>{
  const data=tree(),hook=editor(data,{command:'review',node:data.nodes[0]}),save=vi.fn().mockRejectedValueOnce(new Error('Response lost')).mockRejectedValueOnce(workRpcFailure({code,message:'Lookup blocked'})).mockResolvedValueOnce(tree(8));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));const original=save.mock.calls[0][0];await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));
  expect(hook.result.current.request).toBe(original);expect(hook.result.current.dirty).toBe(true);expect(hook.result.current.authorized).toBe(false);
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(save).toHaveBeenCalledTimes(2);
  hook.rerender({snapshot:tree(8),actorId:'actor',refreshPending:false});expect(hook.result.current.authorized).toBe(true);
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(save.mock.calls[2][0]).toBe(original);expect(hook.result.current.unresolvedReceipt).toBe(false);
 });
 it('allows exact receipt lookup after a lost delete result removes mutation eligibility',async()=>{
  const data=tree(),hook=editor(data,{command:'delete',node:data.nodes[0]}),save=vi.fn().mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce(tree(8));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));const removed=tree(8);removed.nodes=[];removed.root.open=false;
  hook.rerender({snapshot:removed,actorId:'actor',refreshPending:false});expect(hook.result.current.authorized).toBe(true);
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);
 });
 it('guards an uncertain request even when the original review fields were untouched',async()=>{
  const data=tree(),hook=editor(data,{command:'review',node:data.nodes[0]}),save=vi.fn().mockRejectedValue(new Error('Response lost'));
  expect(hook.result.current.dirty).toBe(false);await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(hook.result.current.dirty).toBe(true);
  const confirm=vi.fn().mockResolvedValue(false),uninstall=installNavigationConfirmation(confirm);
  try{expect(await requestNavigation(vi.fn())).toBe(false);expect(confirm).toHaveBeenCalledTimes(1);}finally{uninstall();}
 });
 it('uses a new request identity only after confirmed non-commit and explicit corrected submission',async()=>{
  const hook=editor(),save=vi.fn().mockRejectedValueOnce(workRpcFailure({code:'23514',message:'Choose a valid title'})).mockResolvedValueOnce(tree(8));
  act(()=>hook.result.current.update('title','Invalid'));await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));const original=save.mock.calls[0][0];
  expect(hook.result.current.outcome.kind).toBe('confirmed_failure');expect(hook.result.current.locked).toBe(false);act(()=>hook.result.current.update('title','Corrected'));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(save.mock.calls[1][0].id).not.toBe(original.id);expect(save.mock.calls[1][0].payload.id).toBe(original.payload.id);expect(original.payload.title).toBe('Invalid');
 });
 it('cannot submit again after committed save plus asynchronous failed refresh',async()=>{
  const hook=editor(),save=vi.fn().mockResolvedValue(tree(8));let reject!:(reason:Error)=>void;const onDone=vi.fn(()=>new Promise<void>((_yes,no)=>{reject=no;}));let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.submit({save,onDone});});await act(async()=>{});expect(hook.result.current.outcome.kind).toBe('committed');expect(hook.result.current.dirty).toBe(false);
  await act(async()=>hook.result.current.submit({save,onDone}));expect(save).toHaveBeenCalledTimes(1);
  await act(async()=>{reject(new Error('Refresh failed'));await pending;});expect(hook.result.current.outcome.kind).toBe('committed_refresh_failed');
  await act(async()=>hook.result.current.submit({save,onDone}));expect(save).toHaveBeenCalledTimes(1);expect(hook.result.current.authorized).toBe(false);
 });
 it('renders a committed refresh error without a retry submit button',async()=>{
  const save=vi.fn().mockResolvedValue(tree(8));render(<WorkTreeEditor data={tree()} edit={{command:'create'}} save={save} onDone={()=>{throw new Error('Refresh');}} onCancel={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Created'}});fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));
  await screen.findByText(/Work was saved, but the view could not refresh/);expect(screen.queryByRole('button',{name:'Retry saved request'})).toBeNull();expect(screen.queryByRole('button',{name:'Save work changes'})).toBeNull();expect(screen.getByRole('button',{name:'Close'})).toBeTruthy();
 });
 it('blocks revoked authority, actor/scope changes and unverified snapshots without losing the draft',async()=>{
  const hook=editor(),save=vi.fn().mockRejectedValue(workRpcFailure({code:'42501',message:'Work access denied'}));act(()=>hook.result.current.update('title','Retained'));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(hook.result.current.outcome.kind).toBe('revoked_authority');expect(hook.result.current.authorized).toBe(false);
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(save).toHaveBeenCalledTimes(1);expect(hook.result.current.fields.title).toBe('Retained');
  hook.rerender({snapshot:tree(),actorId:'another',refreshPending:false});expect(hook.result.current.authorized).toBe(false);
 });
 for(const [command,action] of [['create','create_child'],['edit','edit_details'],['move','move'],['delete','delete'],['order','order_children'],['progress','execute'],['submit','submit'],['review','review']] as const)it(`${command} uses current ${action} capability despite affirmative legacy booleans`,()=>{
  const data=tree(),edit:WorkEdit={command:command as WorkCommand,...(command==='create'?{parent:'node'}:command==='order'?{parent:'node'}:{node:data.nodes[0]})},hook=editor(data,edit);
  expect(hook.result.current.authorized).toBe(true);const fresh=tree(8);fresh.nodes[0].capabilities![action]=deny;
  hook.rerender({snapshot:fresh,actorId:'actor',refreshPending:false});expect(hook.result.current.authorized).toBe(false);expect(hook.result.current.locked).toBe(true);
 });
 it('fails closed for a cloned snapshot and during refresh, and ignores late receipts after unmount',async()=>{
  const hook=editor(),save=vi.fn();hook.rerender({snapshot:structuredClone(tree()),actorId:'actor',refreshPending:false});expect(hook.result.current.authorized).toBe(false);
  hook.rerender({snapshot:tree(),actorId:'actor',refreshPending:true});await act(async()=>hook.result.current.submit({save,onDone:vi.fn()}));expect(save).not.toHaveBeenCalled();
  hook.rerender({snapshot:tree(),actorId:'actor',refreshPending:false});let resolve!:(receipt:WorkTreeSnapshot)=>void;save.mockImplementation(()=>new Promise(yes=>{resolve=yes;}));const onDone=vi.fn();let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.submit({save,onDone});});hook.unmount();await act(async()=>{resolve(tree(8));await pending;});expect(onDone).not.toHaveBeenCalled();
 });
 it('cancelling confirmation sends no command and loses no draft',async()=>{
  const hook=editor(),save=vi.fn();act(()=>hook.result.current.update('title','Retained'));
  await act(async()=>hook.result.current.submit({save,onDone:vi.fn(),confirm:vi.fn().mockResolvedValue(false)}));expect(save).not.toHaveBeenCalled();expect(hook.result.current.request).toBeUndefined();expect(hook.result.current.dirty).toBe(true);expect(hook.result.current.busy).toBe(false);
 });
 it('reports a preparation failure as confirmed non-send without inventing a retained request',async()=>{
  const hook=editor(),save=vi.fn();await act(async()=>hook.result.current.submit({save,onDone:vi.fn(),confirm:vi.fn().mockRejectedValue(new Error('Confirmation unavailable'))}));
  expect(save).not.toHaveBeenCalled();expect(hook.result.current.request).toBeUndefined();expect(hook.result.current.outcome.kind).toBe('confirmed_failure');expect(hook.result.current.dirty).toBe(false);
 });
 it('rechecks current capability after confirmation and sends nothing when authority was revoked',async()=>{
  const hook=editor(),save=vi.fn();let resolve!:(accepted:boolean)=>void;const confirm=vi.fn(()=>new Promise<boolean>(yes=>{resolve=yes;}));let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.submit({save,onDone:vi.fn(),confirm});});const fresh=tree(8);fresh.root.capabilities!.create_child=deny;
  hook.rerender({snapshot:fresh,actorId:'actor',refreshPending:false});await act(async()=>{resolve(true);await pending;});expect(save).not.toHaveBeenCalled();expect(hook.result.current.outcome.kind).toBe('revoked_authority');
 });
 it('does not deliver an old actor receipt to the current owner after an identity change',async()=>{
  const hook=editor();let resolve!:(receipt:WorkTreeSnapshot)=>void;const save=vi.fn(()=>new Promise<WorkTreeSnapshot>(yes=>{resolve=yes;})),onDone=vi.fn();let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.submit({save,onDone});});hook.rerender({snapshot:tree(),actorId:'another',refreshPending:false});
  await act(async()=>{resolve(tree(8));await pending;});expect(onDone).not.toHaveBeenCalled();expect(hook.result.current.authorized).toBe(false);expect(hook.result.current.busy).toBe(false);
 });
});
describe('NW5.3 transport certainty preserves RPC compatibility',()=>{
 for(const [code,kind] of [['40001','stale_revision'],['42501','revoked_authority'],['23514','confirmed_failure'],['P0001','confirmed_failure'],['PGRST202','confirmed_failure'],['08006','unknown_result'],['','unknown_result'],['PGRST500','unknown_result']] as const)it(`${code||'untyped'} reports ${kind} without changing message or RPC dispatch`,async()=>{
  api.rpc.mockResolvedValue({data:null,error:{code,message:'Original server message'}});const request:WorkRequest={id:'request',command:'edit',revision:7,payload:{id:'node',title:'Changed'},impactFingerprint:'fingerprint'};
  await expect(saveWorkTree('root',request)).rejects.toMatchObject({kind,message:'Original server message'});expect(api.rpc).toHaveBeenCalledExactlyOnceWith('nw_work_command',{p_root:'root',p_revision:7,p_request:'request',p_command:'edit',p_payload:request.payload,p_impact_fingerprint:'fingerprint'});
 });
 it('missing/invalid receipts remain unknown and never trigger an automatic fallback',async()=>{
  api.rpc.mockResolvedValue({data:null,error:null});await expect(saveWorkTree('root',{id:'request',command:'delete',revision:7,payload:{id:'node'}})).rejects.toMatchObject({kind:'unknown_result'});expect(api.rpc).toHaveBeenCalledTimes(1);
 });
});
