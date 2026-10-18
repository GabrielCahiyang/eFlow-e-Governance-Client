// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
async function chooseWorkAction(label:string, action:string){const trigger=await screen.findByRole('button',{name:label,exact:true});fireEvent.keyDown(trigger,{key:'Enter'});fireEvent.click(await screen.findByRole('menuitem',{name:action,exact:true}));await screen.findByLabelText('Subitem title');}

const api=vi.hoisted(()=>({actor:'actor' as string|null,load:vi.fn(),save:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:api.actor?{id:api.actor}:null})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:api.load,saveWorkTree:api.save,WorkTreeUnavailable:class extends Error{}}));
import {useWorkEditorDraft} from '../../src/app/features/nested-work/hooks/useWorkEditorDraft';
import {useWorkTree} from '../../src/app/features/nested-work/hooks/useWorkTree';
import {WorkTree} from '../../src/app/features/nested-work/components/WorkTree';
import {WorkRootOwner} from '../../src/app/features/nested-work/components/WorkRootOwner';
import {captureWorkEditorBaseline} from '../../src/app/features/nested-work/selectors/editorDraft';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {isolateWorkDraftActor,readWorkDrafts,removeWorkDraft,workDraftKey,writeWorkDraft,type WorkDraftRecord} from '../../src/app/features/nested-work/services/workDraftStore';
import {installNavigationConfirmation,requestNavigation} from '../../src/app/shared/navigationGuard';
import type {WorkRequest,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import {WorkRequestFailure} from '../../src/app/features/nested-work/types/editor';
const allow={allowed:true,reason_code:null} as const;
function tree(revision=7,root='root'):WorkTreeSnapshot {
 const data:WorkTreeSnapshot={root:{id:root,project:'project',office:'office',lead:'actor',people:['actor'],kind:'office',open:true,due:'2026-12-31',capabilities:{create_child:allow,appoint_lead:allow,manage_contributors:allow,order_children:allow}},revision,can_manage:true,can_transfer:true,people:[{id:'actor',name:'Actor',eligible:true},{id:'worker',name:'Worker',eligible:true}],leaf_total:1,leaf_completed:0,nodes:[{id:'node',task_id:root,parent_subtask_id:null,lead_id:'actor',title:'Original',assigned_to_ids:['actor'],sibling_order:0,depth:1,due_date:null,is_standalone:false,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:true,can_work:true,can_review:true,capabilities:{create_child:allow,appoint_lead:allow,manage_contributors:allow,order_children:allow,edit_details:allow,move:allow,delete:allow,execute:allow,submit:allow,review:allow}}]};
 rememberWorkCapabilityContext(data,api.actor||'actor');return data;
}
const context=(data:WorkTreeSnapshot,actorId=api.actor)=>({actorId,rootId:data.root.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision});
function record(data=tree(),title='Retained'):WorkDraftRecord {
 const baseline=captureWorkEditorBaseline(data,{command:'create'},'actor','created-id');return {version:1,mode:'create',baseline,fields:{...baseline.fields,title}};
}
function editor(data=tree()) {return renderHook(({snapshot})=>useWorkEditorDraft({data:snapshot,edit:{command:'create'},context:context(snapshot),refreshPending:false,onCancel:vi.fn()}),{initialProps:{snapshot:data}});}
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.actor='actor';api.load.mockImplementation(async(root:string)=>tree(7,root));});
afterEach(()=>{cleanup();sessionStorage.clear();vi.useRealTimers();vi.restoreAllMocks();});
describe('NW5.4 scoped recovery store',()=>{
 it('stores only whitelisted fields and scalar request terms',()=>{
  const value=record();Object.assign(value,{snapshot:tree(),access_token:'secret',evidence:{signedUrl:'secret'}});Object.assign(value.fields,{file:new File(['secret'],'evidence'),signedUrl:'secret'});
  expect(writeWorkDraft(value)).toBe(true);const raw=sessionStorage.getItem(workDraftKey(value))!;expect(raw).not.toMatch(/snapshot|access_token|evidence|signedUrl|secret/);expect(readWorkDrafts(tree(),context(tree()))[0].fields.title).toBe('Retained');
 });
 it('rejects nested evidence payloads rather than serializing them',()=>{
  const value=record();value.request={id:'request',revision:7,command:'submit',payload:{id:'node',evidence:{path:'private'}}};expect(writeWorkDraft(value)).toBe(false);expect(sessionStorage.length).toBe(0);
 });
 it('requires fresh verified snapshot identity, not a persisted clone',()=>{
  writeWorkDraft(record());const data=JSON.parse(JSON.stringify(tree()));expect(readWorkDrafts(data,context(data))).toEqual([]);const fresh=tree();expect(readWorkDrafts(fresh,context(fresh))).toHaveLength(1);
 });
 it.each(['actor','project','root','office','kind'])('isolates the %s scope',scope=>{
  writeWorkDraft(record());const data=tree(),scopeContext=context(data);
  if(scope==='actor')scopeContext.actorId='other';if(scope==='project')scopeContext.projectId='other';if(scope==='root')scopeContext.rootId='other';if(scope==='office')scopeContext.officeId='other';if(scope==='kind')scopeContext.kind='personal';
  expect(readWorkDrafts(data,scopeContext)).toEqual([]);
 });
 it('clears only the discarded item/revision',()=>{
  const first=record(),second=record(tree(8));writeWorkDraft(first);writeWorkDraft(second);removeWorkDraft(first);expect(sessionStorage.getItem(workDraftKey(first))).toBeNull();expect(sessionStorage.getItem(workDraftKey(second))).not.toBeNull();
 });
 it('makes previous actor data unavailable on account change and logout',()=>{
  writeWorkDraft(record());isolateWorkDraftActor('other');expect(sessionStorage.length).toBe(0);writeWorkDraft(record());isolateWorkDraftActor(null);expect(sessionStorage.length).toBe(0);
 });
 it('ignores corrupt records and storage write failure without losing in-memory state',()=>{
  sessionStorage.setItem(workDraftKey(record()),'{broken');expect(readWorkDrafts(tree(),context(tree()))).toEqual([]);const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota');});expect(writeWorkDraft(record())).toBe(false);spy.mockRestore();
 });
});
describe('NW5.4 editor recovery',()=>{
 it('recovers fields and original IDs on remount without saving',()=>{
  const first=editor();act(()=>first.result.current.update('title','Draft'));const created=first.result.current.baseline.createdId;first.unmount();const second=editor();expect(second.result.current.fields.title).toBe('Draft');expect(second.result.current.baseline.createdId).toBe(created);expect(second.result.current.recovered).toBe(true);expect(api.save).not.toHaveBeenCalled();
 });
 it('marks stale recovery and blocks a new write using the old revision',()=>{
  writeWorkDraft(record());const hook=editor(tree(8));expect(hook.result.current.staleRecovery).toBe(true);expect(hook.result.current.baseline.revision).toBe(7);expect(hook.result.current.authorized).toBe(false);expect(hook.result.current.dirty).toBe(true);
 });
 it('persists before dispatch and recovers exact uncertain terms after a real remount',async()=>{
  const first=editor();act(()=>first.result.current.update('title','Frozen'));const save=vi.fn(()=>new Promise<WorkTreeSnapshot>(()=>{}));act(()=>{void first.result.current.submit({save,onDone:vi.fn()});});
  const original=save.mock.calls[0][0] as WorkRequest;first.unmount();const second=editor(tree(9));expect(second.result.current.request).toEqual(original);expect(Object.isFrozen(second.result.current.request!.payload)).toBe(true);expect(second.result.current.unresolvedReceipt).toBe(true);
  const retry=vi.fn().mockResolvedValue(tree(10));await act(async()=>second.result.current.submit({save:retry,onDone:vi.fn()}));expect(retry.mock.calls[0][0]).toEqual(original);expect(sessionStorage.length).toBe(0);
 });
 it('clears saved draft even if the owner refresh fails',async()=>{
  const hook=editor();act(()=>hook.result.current.update('title','Saved'));await act(async()=>hook.result.current.submit({save:vi.fn().mockResolvedValue(tree(8)),onDone:()=>{throw new Error('Refresh');}}));expect(hook.result.current.outcome.kind).toBe('committed_refresh_failed');expect(sessionStorage.length).toBe(0);
 });
 it.each(['stale_revision','revoked_authority'] as const)('retains known %s after reload without converting it to uncertainty',async kind=>{
  const first=editor();act(()=>first.result.current.update('title','Blocked'));await act(async()=>first.result.current.submit({save:vi.fn().mockRejectedValue(new WorkRequestFailure(kind,'Blocked')),onDone:vi.fn()}));first.unmount();const second=editor();expect(second.result.current.outcome.kind).toBe(kind);expect(second.result.current.unresolvedReceipt).toBe(false);expect(second.result.current.authorized).toBe(false);
 });
 it('accepted discard clears only its draft and invokes its owner once',async()=>{
  writeWorkDraft(record(tree(8),'Other revision'));const hook=editor(tree(8));const uninstall=installNavigationConfirmation(vi.fn().mockResolvedValue(true));try{expect(await requestNavigation(hook.result.current.discard)).toBe(true);expect(sessionStorage.length).toBe(0);}finally{uninstall();}
 });
 it('cannot close or discard during a pending command',async()=>{
  const hook=editor();act(()=>hook.result.current.update('title','Waiting'));act(()=>{void hook.result.current.submit({save:vi.fn(()=>new Promise(()=>{})),onDone:vi.fn()});});const close=vi.fn();expect(await requestNavigation(close)).toBe(false);expect(close).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(1);
 });
 it('retains a pending untouched review request for reload recovery',()=>{
  const data=tree(),edit={command:'review' as const,node:data.nodes[0]},first=renderHook(()=>useWorkEditorDraft({data,edit,context:context(data),refreshPending:false,onCancel:vi.fn()}));expect(first.result.current.dirty).toBe(false);
  act(()=>{void first.result.current.submit({save:vi.fn(()=>new Promise(()=>{})),onDone:vi.fn()});});expect(sessionStorage.length).toBe(1);const original=first.result.current.request;first.unmount();
  const second=renderHook(()=>useWorkEditorDraft({data,edit,context:context(data),refreshPending:false,onCancel:vi.fn()}));expect(second.result.current.request).toEqual(original);expect(second.result.current.unresolvedReceipt).toBe(true);
 });
 it('does not apply a late receipt to a new item in the same root',async()=>{
  const data=tree(),firstEdit={command:'edit' as const,node:data.nodes[0]},hook=renderHook(({edit})=>useWorkEditorDraft({data,edit,context:context(data),refreshPending:false,onCancel:vi.fn()}),{initialProps:{edit:firstEdit}});
  let resolve!:(data:WorkTreeSnapshot)=>void;const onDone=vi.fn();act(()=>{hook.result.current.update('title','Old item');});let pending!:Promise<void>;act(()=>{pending=hook.result.current.submit({save:vi.fn(()=>new Promise(yes=>{resolve=yes;})),onDone});});
  hook.rerender({edit:{command:'edit',node:{...data.nodes[0],id:'other-item'}}});await act(async()=>{resolve(tree(8));await pending;});expect(onDone).not.toHaveBeenCalled();expect(hook.result.current.authorized).toBe(false);
 });
});
describe('NW5.4 current reads and owners',()=>{
 it('retains a dirty editor on timer failure and blocks saving until retry succeeds',async()=>{
  render(<WorkTree rootId="root"/>);await chooseWorkAction('Task work actions','Add subitem');fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Dirty'}});
  api.load.mockRejectedValueOnce(new Error('Network offline'));fireEvent(window,new Event('focus'));await screen.findByText(/Network offline/);expect(screen.getByDisplayValue('Dirty')).toBeTruthy();expect((screen.getByRole('button',{name:/^Save (?:work )?changes$/}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Retry work'}));await waitFor(()=>expect((screen.getByRole('button',{name:/^Save (?:work )?changes$/}) as HTMLButtonElement).disabled).toBe(false));expect(screen.getByDisplayValue('Dirty')).toBeTruthy();
 });
 it('clears protected display on coded revocation and quarantines the draft until renewed read',async()=>{
  render(<WorkTree rootId="root"/>);await chooseWorkAction('Task work actions','Add subitem');fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Private draft'}});
  api.load.mockRejectedValueOnce(Object.assign(new Error('Forbidden'),{code:'42501'}));fireEvent(window,new Event('focus'));await screen.findByText('Forbidden');expect(screen.queryByDisplayValue('Private draft')).toBeNull();expect(screen.queryByText('Original')).toBeNull();expect(sessionStorage.length).toBe(1);
  fireEvent.click(screen.getByRole('button',{name:'Retry work'}));expect(await screen.findByDisplayValue('Private draft')).toBeTruthy();expect(await screen.findByText(/Draft recovered after current access verification/)).toBeTruthy();expect(api.save).not.toHaveBeenCalled();
 });
 it('offers recovery after owner remount only after fresh read',async()=>{
  const view=render(<WorkTree rootId="root"/>);await chooseWorkAction('Task work actions','Add subitem');fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Reloaded'}});view.unmount();
  let resolve!:(data:WorkTreeSnapshot)=>void;api.load.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));render(<WorkTree rootId="root"/>);expect(screen.queryByRole('button',{name:'Recover new subitem draft'})).toBeNull();await act(async()=>resolve(tree()));fireEvent.click(await screen.findByRole('button',{name:'Recover new subitem draft'}));expect(screen.getByDisplayValue('Reloaded')).toBeTruthy();expect(api.save).not.toHaveBeenCalled();
 });
 it('retains staffing through transient failure and recovers it after owner remount',async()=>{
  const view=render(<WorkRootOwner rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));fireEvent.click(screen.getByRole('button',{name:'Add contributor Worker'}));api.load.mockRejectedValueOnce(new Error('Offline'));fireEvent(window,new Event('focus'));await screen.findByText('Offline');expect(screen.getByRole('button',{name:'Remove contributor Worker'})).toBeTruthy();expect((screen.getByRole('button',{name:/^Save (?:work )?changes$/}) as HTMLButtonElement).disabled).toBe(true);view.unmount();
  render(<WorkRootOwner rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));expect(screen.getByRole('button',{name:'Remove contributor Worker'})).toBeTruthy();expect(screen.getByText(/People draft recovered/)).toBeTruthy();
 });
 it('ignores late reads across root changes',async()=>{
  let resolve!:(data:WorkTreeSnapshot)=>void;api.load.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));const hook=renderHook(({root})=>useWorkTree(root),{initialProps:{root:'root'}});hook.rerender({root:'other'});await waitFor(()=>expect(hook.result.current.data?.root.id).toBe('other'));await act(async()=>resolve(tree()));expect(hook.result.current.data?.root.id).toBe('other');
 });
 it('continues polling while a dirty editor is open',async()=>{
  vi.useFakeTimers();render(<WorkTree rootId="root"/>);await act(async()=>{});fireEvent.keyDown(screen.getByRole('button',{name:'Task work actions'}),{key:'Enter'});fireEvent.click(screen.getByRole('menuitem',{name:'Add subitem',exact:true}));await act(async()=>vi.advanceTimersByTime(0));fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Polling'}});await act(async()=>vi.advanceTimersByTime(15000));expect(api.load).toHaveBeenCalledTimes(2);expect(screen.getByDisplayValue('Polling')).toBeTruthy();
 });
});
