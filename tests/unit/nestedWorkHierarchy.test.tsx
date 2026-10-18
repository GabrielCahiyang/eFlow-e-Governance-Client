// @vitest-environment jsdom
import {useState} from 'react';
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({actor:'actor',load:vi.fn(),save:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:api.load,saveWorkTree:api.save,fetchWorkImpact:vi.fn(),WorkTreeUnavailable:class extends Error{}}));
import {WorkHierarchy,WorkRootOwner,WorkTree,WorkStaffingDialog,useWorkTree,type WorkHierarchyProps} from '../../src/app/features/nested-work';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {captureWorkEditorBaseline,workEditorPayload} from '../../src/app/features/nested-work/selectors/editorDraft';
import type {WorkCapabilityEntry,WorkNode,WorkTreeController,WorkTreeSnapshot,WorkRequest} from '../../src/app/features/nested-work';

const allow:WorkCapabilityEntry={allowed:true,reason_code:null},deny:WorkCapabilityEntry={allowed:false,reason_code:'branch_denied'};
function node(id:string,parent:string|null=null,patch:Partial<WorkNode>={}):WorkNode {
 return {id,task_id:'root',parent_subtask_id:parent,title:id,lead_id:'actor',assigned_to_ids:['actor','worker','old'],depth:1,sibling_order:0,due_date:'2026-12-01',is_standalone:false,status:'in_progress',percent_complete:35,
  can_manage:true,can_appoint:true,can_order:true,can_work:true,can_review:true,capabilities:{manage_contributors:deny,appoint_lead:deny,create_child:deny,order_children:deny,edit_details:deny,move:deny,delete:deny,execute:deny,submit:deny,review:deny},...patch};
}
function tree(nodes=[node('Parent'),node('Child','Parent')]):WorkTreeSnapshot {
 const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',open:true,lead:'actor',people:['actor','worker'],due:null,capabilities:{manage_contributors:deny,appoint_lead:deny,create_child:deny,order_children:deny}},revision:7,can_manage:true,can_transfer:true,nodes,people:[{id:'actor',name:'Current Lead',eligible:true},{id:'worker',name:'Selected Contributor',eligible:true},{id:'old',name:'Historical Person',eligible:false}],leaf_total:1,leaf_completed:0};
 rememberWorkCapabilityContext(data,api.actor);return data;
}
const props=(snapshot=tree()):WorkHierarchyProps=>({snapshot,readOnly:false,executionBlocked:false,authorityFresh:true,collapsedIds:new Set(),onCollapsedIdsChange:vi.fn(),onOpenNode:vi.fn(),onRequestAction:vi.fn()});
const originalMatchMedia=window.matchMedia;
beforeEach(()=>{api.actor='actor';vi.resetAllMocks();sessionStorage.clear();Object.defineProperty(window,'matchMedia',{configurable:true,value:undefined});});
afterEach(()=>{cleanup();Object.defineProperty(window,'matchMedia',{configurable:true,value:originalMatchMedia});});
if(!globalThis.ResizeObserver)globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
async function openMenu(name:string){fireEvent.keyDown(screen.getByRole('button',{name}),{key:'Enter'});return screen.findByRole('menu');}

describe('one supplied work hierarchy composition',()=>{
 it('renders an empty Main Table surface and inline root create through the existing capability action',()=>{
  const data=tree([]);data.root.capabilities!.create_child=allow;const initial=props(data);render(<WorkHierarchy {...initial} presentation="project-table"/>);
  expect(screen.getByRole('table').getAttribute('data-density')).toBe('compact');const add=screen.getByRole('button',{name:'Add subitem',exact:true});expect(add.closest('tfoot')).toBeTruthy();fireEvent.click(add);expect(initial.onRequestAction).toHaveBeenCalledWith('create',undefined);expect(api.save).not.toHaveBeenCalled();
 });
 it('keeps an own-branch create capability from granting the Main Table root footer',()=>{
  const data=tree([node('Own branch',null,{capabilities:{...node('x').capabilities!,create_child:allow}})]);const initial=props(data);render(<WorkHierarchy {...initial} presentation="project-table"/>);expect(screen.queryByRole('button',{name:'Add subitem',exact:true})).toBeNull();expect(screen.getByRole('button',{name:'Actions for Own branch'})).toBeTruthy();
 });
 it('uses the canonical branch parent for an authorized inline child footer and retains readOnly/stale gates',()=>{
  const data=tree([node('Parent',null,{capabilities:{...node('x').capabilities!,create_child:allow}})]),initial=props(data);const view=render(<WorkHierarchy {...initial} branchParentId="Parent" presentation="project-table"/>);fireEvent.click(screen.getByRole('button',{name:'Add subitem',exact:true}));expect(initial.onRequestAction).toHaveBeenCalledWith('create','Parent');
  view.rerender(<WorkHierarchy {...initial} branchParentId="Parent" presentation="project-table" authorityFresh={false}/>);expect(screen.getByRole('button',{name:'Add subitem',exact:true}).hasAttribute('disabled')).toBe(true);view.rerender(<WorkHierarchy {...initial} branchParentId="Parent" presentation="project-table" readOnly/>);expect(screen.queryByRole('button',{name:'Add subitem',exact:true})).toBeNull();
 });
 it('uses native table columns, stable traversal, explicit people, shared status/date/progress and no reads',()=>{
  const data=tree([node('Child','Parent'),node('Parent')]),before=JSON.stringify(data);
  render(<WorkHierarchy {...props(data)}/>);
  expect(screen.getAllByRole('columnheader').map(header=>header.textContent)).toEqual(['Subitem','Lead','Contributors','Status','Due','Progress','Actions']);
  expect(screen.queryByRole('treegrid')).toBeNull();expect(screen.getAllByRole('row').slice(1).map(row=>row.getAttribute('data-work-row'))).toEqual(['Parent','Child']);
  const first=screen.getAllByRole('row')[1];expect(within(first).getAllByText('Current Lead')).toHaveLength(1);
  expect(first.textContent).toContain('Contributors (2): Selected Contributor, Historical Person');
  expect(within(first).getByText('In progress')).toBeTruthy();expect(first.querySelector('time')?.dateTime).toBe('2026-12-01');
  expect(within(first).getByRole('group',{name:'Progress for Parent'})).toBeTruthy();expect(within(first).queryByRole('progressbar')).toBeNull();expect(within(first).getByText('Not approved yet')).toBeTruthy();
  expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();expect(JSON.stringify(data)).toBe(before);
 });
 it('labels disclosure and keeps collapse state controlled without changing canonical parents',()=>{
  const initial=props();function Owner(){const [collapsed,setCollapsed]=useState(new Set<string>());return <WorkHierarchy {...initial} collapsedIds={collapsed} onCollapsedIdsChange={setCollapsed}/>;}
  render(<Owner/>);fireEvent.click(screen.getByRole('button',{name:'Collapse children of Parent'}));
  expect(screen.queryByRole('button',{name:'Child',exact:true})).toBeNull();expect(screen.getByRole('button',{name:'Expand children of Parent'}).getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'Expand children of Parent'}));expect(screen.getByRole('button',{name:'Child',exact:true})).toBeTruthy();
  expect(initial.snapshot.nodes[1].parent_subtask_id).toBe('Parent');
 });
 it('expands only focused ancestors, focuses the canonical deep ID and caps indentation at three',()=>{
  const nodes=Array.from({length:8},(_,index)=>node(`Level ${index+1}`,index?`Level ${index}`:null));
  nodes.push(node('Unrelated'),node('Other child','Unrelated'));
  const input=props(tree(nodes));input.collapsedIds=new Set(['Level 1','Level 4','Unrelated']);input.focusedNodeId='Level 8';render(<WorkHierarchy {...input}/>);
  expect(input.onCollapsedIdsChange).toHaveBeenCalledWith(new Set(['Unrelated']));
  const focused=screen.getByRole('button',{name:'Level 8',exact:true});expect(document.activeElement).toBe(focused);
  expect(focused.closest('.nw-hierarchy-title')?.getAttribute('style')).toContain('--nw-indent: 3');
  expect(screen.getByLabelText('Path for Level 8').textContent).toContain('Level 1');expect(screen.queryByRole('button',{name:'Other child',exact:true})).toBeNull();
 });
 it('uses supplied unknown context without looking up protected ancestors',()=>{
  render(<WorkHierarchy {...props(tree([node('Orphan','protected-parent'),node('Cycle','Cycle')]))}/>);
  expect(screen.getByText('Parent context unavailable')).toBeTruthy();expect(screen.getByText('Hierarchy context incomplete')).toBeTruthy();expect(api.load).not.toHaveBeenCalled();
 });
 it('has exactly one mobile composition and changes layout without duplicate accessible controls',()=>{
  let mobile=true;const listeners=new Set<()=>void>();
  Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({get matches(){return mobile;},addEventListener:(_event:string,listener:()=>void)=>listeners.add(listener),removeEventListener:(_event:string,listener:()=>void)=>listeners.delete(listener)})});
  render(<WorkHierarchy {...props()}/>);expect(screen.queryByRole('table')).toBeNull();expect(screen.getByRole('list',{name:'Subitem hierarchy'})).toBeTruthy();
  expect(screen.getAllByRole('button',{name:'Actions for Parent'})).toHaveLength(1);
  act(()=>{mobile=false;listeners.forEach(listener=>listener());});expect(screen.getByRole('table')).toBeTruthy();expect(screen.queryByRole('list',{name:'Subitem hierarchy'})).toBeNull();
  expect(screen.getAllByRole('button',{name:'Actions for Parent'})).toHaveLength(1);
 });
 it('keeps read-only Open and Activity, ignoring permissive legacy booleans',async()=>{
  const input=props();input.readOnly=true;render(<WorkHierarchy {...input}/>);await openMenu('Actions for Parent');
  expect(screen.getAllByRole('menuitem').map(item=>item.textContent)).toEqual(['Open work / evidence','Activity']);
  fireEvent.click(screen.getByRole('menuitem',{name:'Open work / evidence'}));expect(input.onOpenNode).toHaveBeenCalledWith('Parent');
  await openMenu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Activity'}));expect(input.onRequestAction).toHaveBeenCalledWith('activity','Parent');expect(api.save).not.toHaveBeenCalled();
 });
 it('fails closed on missing maps and hides unverified/foreign snapshots',async()=>{
  const data=tree([node('Parent')]);data.nodes[0].capabilities=undefined;
  const input=props(data),view=render(<WorkHierarchy {...input}/>);await openMenu('Actions for Parent');expect(screen.queryByRole('menuitem',{name:'Add subitem'})).toBeNull();
  fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});data.nodes[0].capabilities={create_child:allow};
  view.rerender(<WorkHierarchy {...input} snapshot={structuredClone(data)}/>);expect(screen.queryByRole('button',{name:'Actions for Parent'})).toBeNull();expect(screen.getByRole('alert').textContent).toContain('Verify current work access');
  api.actor='other';view.rerender(<WorkHierarchy {...input}/>);expect(screen.queryByRole('button',{name:'Actions for Parent'})).toBeNull();expect(screen.queryByText('Current Lead')).toBeNull();expect(screen.getByRole('alert')).toBeTruthy();
 });
 it('routes node reorder to its own child list and root reorder to parent:null using complete hidden IDs',async()=>{
  const data=tree([node('Parent',null,{capabilities:{order_children:allow}}),node('Hidden B','Parent',{sibling_order:2}),node('Hidden A','Parent',{sibling_order:1})]);data.root.capabilities={order_children:allow};
  const input=props(data);input.collapsedIds=new Set(['Parent']);render(<WorkHierarchy {...input}/>);
  await openMenu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Reorder children'}));await waitFor(()=>expect(input.onRequestAction).toHaveBeenLastCalledWith('order','Parent'));
  const nodeDraft=captureWorkEditorBaseline(data,{command:'order',parent:'Parent'},'actor','request');expect(nodeDraft.fields.order).toEqual(['Hidden A','Hidden B']);
  expect(workEditorPayload(nodeDraft,nodeDraft.fields)).toEqual({parent:'Parent',order:['Hidden A','Hidden B']});
  await openMenu('Task work actions');fireEvent.click(screen.getByRole('menuitem',{name:'Reorder children'}));await waitFor(()=>expect(input.onRequestAction).toHaveBeenLastCalledWith('order',undefined));
  const rootDraft=captureWorkEditorBaseline(data,{command:'order',parent:null},'actor','request');expect(rootDraft.fields.parent).toBe('');expect(rootDraft.fields.order).toEqual(['Parent']);
  expect(workEditorPayload(rootDraft,rootDraft.fields)).toEqual({parent:null,order:['Parent']});
  expect(data.nodes).toHaveLength(3);expect(api.save).not.toHaveBeenCalled();
 });
 it('does not grant sibling ordering from a child capability or infer root ordering',async()=>{
  const data=tree([node('Parent'),node('Child','Parent',{capabilities:{order_children:allow}})]);render(<WorkHierarchy {...props(data)}/>);
  expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();await openMenu('Actions for Parent');expect(screen.queryByRole('menuitem',{name:'Reorder children'})).toBeNull();
  fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});await openMenu('Actions for Child');expect(screen.getByRole('menuitem',{name:'Reorder children'})).toBeTruthy();
 });
 it('disables stale mutations then removes revoked actions from an already open menu',async()=>{
  const data=tree([node('Parent',null,{capabilities:{edit_details:allow}})]),input=props(data);input.authorityFresh=false;
  const view=render(<WorkHierarchy {...input}/>);await openMenu('Actions for Parent');const edit=screen.getByRole('menuitem',{name:'Edit details'});expect(edit.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(edit);expect(input.onRequestAction).not.toHaveBeenCalled();
  const next=tree([node('Parent',null,{capabilities:{edit_details:deny}})]);view.rerender(<WorkHierarchy {...input} snapshot={next} authorityFresh/>);expect(screen.queryByRole('menuitem',{name:'Edit details'})).toBeNull();
 });
 it('keeps Office evidence/review callbacks and exposes personal commands only through their capabilities',async()=>{
  const office=tree([node('Parent',null,{capabilities:{execute:allow,submit:allow,review:allow}})]),input=props(office),view=render(<WorkHierarchy {...input}/>);
  await openMenu('Actions for Parent');expect(screen.queryByRole('menuitem',{name:'Update progress'})).toBeNull();expect(screen.queryByRole('menuitem',{name:'Submit for review'})).toBeNull();
  fireEvent.click(screen.getByRole('menuitem',{name:'Review'}));await waitFor(()=>expect(input.onRequestAction).toHaveBeenCalledWith('review','Parent'));
  const personal=tree(office.nodes);personal.root={...personal.root,kind:'personal',office:null};rememberWorkCapabilityContext(personal,api.actor);
  view.rerender(<WorkHierarchy {...input} snapshot={personal}/>);await openMenu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Update progress'}));await waitFor(()=>expect(input.onRequestAction).toHaveBeenLastCalledWith('progress','Parent'));
  view.rerender(<WorkHierarchy {...input} snapshot={personal} executionBlocked/>);await openMenu('Actions for Parent');expect(screen.queryByRole('menuitem',{name:'Update progress'})).toBeNull();expect(screen.queryByRole('menuitem',{name:'Submit for review'})).toBeNull();expect(screen.getByRole('menuitem',{name:'Review'})).toBeTruthy();
 });
 it('shows an empty state without inventing structure authority',()=>{render(<WorkHierarchy {...props(tree([]))}/>);expect(screen.getByText('No subitems yet.')).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();});
});

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const request:WorkRequest={id:'one-request',command:'contributors',payload:{people:['actor','worker']},revision:7};
const controller=(data=tree()):WorkTreeController=>({rootId:'root',actorId:'actor',data,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn().mockResolvedValue(undefined),save:api.save});

describe('public shared work controller',()=>{
 it('owns one read/poller for supplied Tree and Owner, including the full-controller staffing dialog',async()=>{
  const data=tree();data.root.capabilities={manage_contributors:allow,appoint_lead:deny};api.load.mockResolvedValue(data);
  function Owner(){const shared=useWorkTree('root');return <><WorkRootOwner rootId="root" controller={shared}/><WorkTree rootId="root" controller={shared}/></>;}
  render(<Owner/>);await screen.findByRole('button',{name:'Choose task lead and contributors'});expect(api.load).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Choose task lead and contributors'}));await screen.findByLabelText('Appointed Lead');expect(api.load).toHaveBeenCalledTimes(1);
  fireEvent(window,new Event('focus'));await waitFor(()=>expect(api.load).toHaveBeenCalledTimes(2));expect(api.load).toHaveBeenCalledTimes(2);
 });
 it('does not display or send through a supplied foreign actor/root controller',()=>{
  const foreign=controller();foreign.actorId='someone-else';
  const view=render(<><WorkRootOwner rootId="root" controller={foreign} fallback={<span>Owner unavailable</span>}/><WorkTree rootId="root" controller={foreign} fallback={<span>Work unavailable</span>}/></>);
  expect(screen.getByText('Owner unavailable')).toBeTruthy();expect(screen.getByText('Work unavailable')).toBeTruthy();expect(screen.queryByText('Current Lead')).toBeNull();
  foreign.actorId='actor';foreign.rootId='other-root';view.rerender(<><WorkRootOwner rootId="root" controller={foreign}/><WorkTree rootId="root" controller={foreign}/></>);
  expect(screen.queryByText('Current Lead')).toBeNull();expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();
  foreign.rootId='root';foreign.data=structuredClone(foreign.data!);view.rerender(<><WorkRootOwner rootId="root" controller={foreign}/><WorkTree rootId="root" controller={foreign}/></>);expect(screen.queryByText('Current Lead')).toBeNull();
 });
 it('uses separate connected/controlled children when the optional prop changes',async()=>{
  api.load.mockResolvedValue(tree());const input=controller(),view=render(<WorkRootOwner rootId="root" controller={input}/>);
  expect(api.load).not.toHaveBeenCalled();view.rerender(<WorkRootOwner rootId="root"/>);await waitFor(()=>expect(api.load).toHaveBeenCalledTimes(1));
  view.rerender(<WorkRootOwner rootId="root" controller={input}/>);fireEvent(window,new Event('focus'));expect(api.load).toHaveBeenCalledTimes(1);
 });
 it('renders pending, guards duplicate sends and retains the exact failed request for caller retry',async()=>{
  api.load.mockResolvedValue(tree());const first=deferred<WorkTreeSnapshot>();api.save.mockReturnValueOnce(first.promise).mockResolvedValue(tree());
  const hook=renderHook(()=>useWorkTree('root'));await waitFor(()=>expect(hook.result.current.authorityFresh).toBe(true));
  let save!:Promise<WorkTreeSnapshot>;act(()=>{save=hook.result.current.save(request);});const failed=save.catch(error=>error);
  expect(hook.result.current.pending).toBe(true);await expect(hook.result.current.save(request)).rejects.toThrow('already pending');expect(api.save).toHaveBeenCalledOnce();
  await act(async()=>first.reject(new Error('Receipt interrupted')));expect((await failed).message).toBe('Receipt interrupted');expect(hook.result.current.pending).toBe(false);
  await act(async()=>{await hook.result.current.save(request);});expect(api.save.mock.calls[1][1]).toBe(request);
 });
 it('retains display on transient refresh failure, revokes captured save access, then clears an authoritative denial',async()=>{
  const data=tree();api.load.mockResolvedValueOnce(data).mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(data).mockRejectedValueOnce(Object.assign(new Error('Not authorized'),{code:'42501'}));
  const hook=renderHook(()=>useWorkTree('root'));await waitFor(()=>expect(hook.result.current.authorityFresh).toBe(true));const oldSave=hook.result.current.save;
  await act(async()=>hook.result.current.reload());expect(hook.result.current.data).toBe(data);expect(hook.result.current.authorityFresh).toBe(false);expect(hook.result.current.refreshPending).toBe(false);
  await expect(oldSave(request)).rejects.toThrow('Verify current work access');expect(api.save).not.toHaveBeenCalled();
  await act(async()=>hook.result.current.reload());expect(hook.result.current.authorityFresh).toBe(true);
  await act(async()=>hook.result.current.reload());expect(hook.result.current.data).toBeUndefined();expect(hook.result.current.authorityFresh).toBe(false);
 });
 it('fails closed across actor/root switches and ignores old request completion while the new request is pending',async()=>{
  const old=tree(),next=tree();next.root.id='other-root';next.nodes=[];const oldReceipt=deferred<WorkTreeSnapshot>(),newReceipt=deferred<WorkTreeSnapshot>(),read=deferred<WorkTreeSnapshot>();
  api.load.mockResolvedValueOnce(old).mockReturnValueOnce(read.promise);api.save.mockReturnValueOnce(oldReceipt.promise).mockReturnValueOnce(newReceipt.promise);
  const hook=renderHook(({root})=>useWorkTree(root),{initialProps:{root:'root'}});await waitFor(()=>expect(hook.result.current.authorityFresh).toBe(true));
  const oldSave=hook.result.current.save;let oldSend!:Promise<WorkTreeSnapshot>;act(()=>{oldSend=oldSave(request);});api.actor='new-actor';hook.rerender({root:'other-root'});
  expect(hook.result.current.actorId).toBe('new-actor');expect(hook.result.current.rootId).toBe('other-root');expect(hook.result.current.data).toBeUndefined();expect(hook.result.current.authorityFresh).toBe(false);expect(hook.result.current.pending).toBe(false);rememberWorkCapabilityContext(next,api.actor);
  await expect(oldSave(request)).rejects.toThrow('Verify current work access');await act(async()=>read.resolve(next));let newSend!:Promise<WorkTreeSnapshot>;act(()=>{newSend=hook.result.current.save(request);});
  await act(async()=>{oldReceipt.resolve(old);await oldSend;});expect(hook.result.current.data).toBe(next);expect(hook.result.current.pending).toBe(true);
  await act(async()=>{newReceipt.resolve(next);await newSend;});expect(hook.result.current.pending).toBe(false);expect(api.save).toHaveBeenCalledTimes(2);
 });
 it('guards the full-controller staffing display without starting another read',()=>{
  const input=controller();input.actorId='other';render(<WorkStaffingDialog controller={input} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  expect(screen.queryByLabelText('Appointed Lead')).toBeNull();expect(screen.getByRole('alert').textContent).toContain('Verify current work access');expect(api.load).not.toHaveBeenCalled();
 });
 it('locks controlled mutation triggers while another shared operation is pending',async()=>{
  const data=tree();data.root.capabilities={manage_contributors:allow,create_child:allow};const input=controller(data);input.pending=true;
  const open=vi.fn();render(<><WorkRootOwner rootId="root" controller={input}/><WorkTree rootId="root" controller={input}/><WorkTree rootId="root" controller={input} readOnly onOpenOfficeNode={open}/></>);
  expect((screen.getByRole('button',{name:'Choose task lead and contributors'}) as HTMLButtonElement).disabled).toBe(true);
  await openMenu('Task work actions');expect(screen.getByRole('menuitem',{name:'Add subitem'}).getAttribute('aria-disabled')).toBe('true');expect(api.load).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});
  const evidence=screen.getAllByRole('button',{name:'Parent',exact:true})[1] as HTMLButtonElement;expect(evidence.disabled).toBe(false);fireEvent.click(evidence);expect(open).toHaveBeenCalledWith(data.nodes[0],data);expect(api.save).not.toHaveBeenCalled();
 });
 it('does not restore authority or protected display from an unverified response clone',async()=>{
  const verified=tree(),unverified=structuredClone(verified);api.load.mockResolvedValueOnce(unverified).mockResolvedValueOnce(verified);
  const hook=renderHook(()=>useWorkTree('root'));await waitFor(()=>expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.data).toBeUndefined();expect(hook.result.current.authorityFresh).toBe(false);expect(hook.result.current.error).toContain('Verify current work access');
  await expect(hook.result.current.save(request)).rejects.toThrow('Verify current work access');expect(api.save).not.toHaveBeenCalled();
  await act(async()=>hook.result.current.reload());expect(hook.result.current.data).toBe(verified);expect(hook.result.current.authorityFresh).toBe(true);
 });
});
