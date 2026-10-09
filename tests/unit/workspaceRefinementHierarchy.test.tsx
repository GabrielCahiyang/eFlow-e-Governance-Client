// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {installNavigationConfirmation,requestNavigation} from '../../src/app/shared/navigationGuard';
const mocks=vi.hoisted(()=>({actor:'lead',load:vi.fn(),save:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:mocks.actor}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:mocks.load,saveWorkTree:mocks.save,fetchPersonalWorkRoots:vi.fn(),fetchOfficeWorkRoots:vi.fn(),fetchWorkEvents:vi.fn(),WorkTreeUnavailable:class WorkTreeUnavailable extends Error{}}));
import {WorkTree,WorkRootOwner,descendantIds,reparentChoices,leafCompletion,supportsNestedWork} from '../../src/app/features/nested-work';
import {WorkTreeUnavailable} from '../../src/app/features/nested-work/services/workTreeService';
import {getSubtaskPrerequisite} from '../../src/app/features/subtasks/selectors/sequencing';
import type {WorkNode,WorkTreeSnapshot} from '../../src/app/features/nested-work';
const node=(patch:Partial<WorkNode>={}):WorkNode=>({id:'branch',task_id:'root',parent_subtask_id:null,lead_id:'lead',title:'Branch',assigned_to_ids:['lead'],depth:1,sibling_order:0,due_date:'2026-12-01',is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_appoint:false,can_order:false,can_work:true,can_review:false,...patch});
const tree=(patch:Partial<WorkTreeSnapshot>={}):WorkTreeSnapshot=>({root:{id:'root',project:'project',office:'office',kind:'office',lead:'lead',open:true,due:'2026-12-31',people:['lead']},revision:7,can_manage:true,can_transfer:false,nodes:[node()],people:[{id:'lead',name:'Current Lead'},{id:'bob',name:'Bob selected for project'}],leaf_total:1,leaf_completed:0,...patch});
beforeEach(()=>{vi.resetAllMocks();mocks.actor='lead';mocks.load.mockResolvedValue(tree());});afterEach(cleanup);
describe('R7 checked nested-work UI',()=>{
 it('retains one request and creation identity after a lost response, prevents double saves, and guards drafts',async()=>{
  let reject:(reason:Error)=>void=()=>{};mocks.save.mockImplementationOnce(()=>new Promise((_r,no)=>{reject=no;})).mockImplementation(async(_root,request)=>tree({nodes:[node(),node({id:request.payload.id,title:request.payload.title,parent_subtask_id:'branch',depth:2})]}));
  const uninstall=installNavigationConfirmation(vi.fn().mockResolvedValue(false));render(<WorkTree rootId="root"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Add child to Branch'}));fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Deep work'}});fireEvent.change(screen.getByLabelText('Appointed lead'),{target:{value:'bob'}});
  expect(await requestNavigation(vi.fn())).toBe(false);const save=screen.getByRole('button',{name:'Save work changes'});fireEvent.click(save);fireEvent.click(save);expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async()=>reject(new Error('Receipt interrupted')));await screen.findByText(/Receipt interrupted/);expect((screen.getByLabelText('Subitem title') as HTMLInputElement).disabled).toBe(true);
  const request=mocks.save.mock.calls[0][1];expect(request.payload).toMatchObject({title:'Deep work',parent:'branch',lead:'bob',people:['bob']});expect(request.revision).toBe(7);
  fireEvent.click(screen.getByRole('button',{name:'Retry saved request'}));await screen.findByText('Deep work');expect(mocks.save.mock.calls[1][1]).toBe(request);uninstall();
 });
 it('retains expired assignment names while allowing replacement and excluding them from new choices',async()=>{
  mocks.load.mockResolvedValue(tree({can_transfer:true,root:{...tree().root,people:['lead','expired']},people:[...tree().people,{id:'expired',name:'Expired contributor',eligible:false}]}));
  render(<WorkRootOwner rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));
  expect(screen.queryByRole('option',{name:'Expired contributor'})).toBeNull();expect(screen.queryByRole('checkbox',{name:'Expired contributor · Contributor'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Expired contributor'}));expect(screen.queryByRole('button',{name:'Remove contributor Expired contributor'})).toBeNull();
 });
 it('allows a root lead to change contributors without gaining root-transfer authority',async()=>{
  mocks.save.mockResolvedValue(tree());render(<WorkRootOwner rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));
  expect(screen.queryByLabelText('Appointed lead')).toBeNull();fireEvent.click(screen.getByRole('checkbox',{name:'Bob selected for project · Contributor'}));fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalled());expect(mocks.save.mock.calls[0][1]).toMatchObject({command:'contributors',payload:{people:['lead','bob']}});
 });
 it('keeps original draft revision during a capability refresh and disables a revoked editor',async()=>{
  mocks.save.mockResolvedValue(tree());const {rerender}=render(<WorkTree rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Add root subitem'}));fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Retained draft'}});
  mocks.load.mockResolvedValue(tree({revision:8,can_manage:false}));fireEvent(window,new Event('focus'));await screen.findByText('Your current branch authority changed. Reload the tree before saving.');
  expect((screen.getByLabelText('Subitem title') as HTMLInputElement).value).toBe('Retained draft');expect((screen.getByRole('button',{name:'Save work changes'}) as HTMLButtonElement).disabled).toBe(true);expect(mocks.save).not.toHaveBeenCalled();
  mocks.actor='other';mocks.load.mockRejectedValue(new Error('Current access denied'));rerender(<WorkTree rootId="root"/>);await screen.findByText('Current access denied');expect(screen.queryByDisplayValue('Retained draft')).toBeNull();
 });
 it('clears stale roots and ignores late reads across scope changes',async()=>{
  let resolve:(data:WorkTreeSnapshot)=>void=()=>{};mocks.load.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;})).mockResolvedValue(tree({root:{...tree().root,id:'other'},nodes:[],leaf_total:0}));
  const {rerender}=render(<WorkTree rootId="root"/>);rerender(<WorkTree rootId="other"/>);await screen.findByText('Descendant leaves: 0/0 approved · Manual task progress is separate.');
  await act(async()=>resolve(tree()));expect(screen.queryByText('Branch')).toBeNull();
 });
 it('uses the legacy adapter only for an explicitly missing RPC, and fails closed on denial',async()=>{
  mocks.load.mockRejectedValue(new WorkTreeUnavailable('Missing'));const {rerender}=render(<WorkTree rootId="root" fallback={<p>Legacy checklist</p>}/>);await screen.findByText('Legacy checklist');
  mocks.load.mockRejectedValue(new Error('Access denied'));rerender(<WorkTree rootId="different" fallback={<p>Legacy checklist</p>}/>);await screen.findByText('Access denied');expect(screen.queryByText('Legacy checklist')).toBeNull();
 });
 it('shows historical work for a Viewer without exposing mutation actions or inventing an email invitation',async()=>{
  mocks.load.mockResolvedValue(tree({can_manage:false,can_transfer:false,nodes:[node({can_manage:false,can_appoint:false,can_work:false,can_order:false})]}));render(<WorkTree rootId="root"/>);await screen.findByText('Branch');expect(screen.queryAllByRole('button')).toHaveLength(0);
 });
});
describe('R7 hierarchy adapters',()=>{
 it('preserves flat planning for unresolved Offices and governed work',()=>{
  expect(supportsNestedWork({linkedProjectId:'project'})).toBe(true);expect(supportsNestedWork({})).toBe(false);
  expect(supportsNestedWork({linkedProjectId:'project',proposedOfficeIdentityId:'named'})).toBe(false);
  expect(supportsNestedWork({linkedProjectId:'project',sourceCollaborationDraftId:'governed'})).toBe(false);
 });
 it('bounds subtree traversal, excludes cycles and rejects destinations that would exceed depth 8',()=>{
  const parent=node(),child=node({id:'child',parent_subtask_id:'branch',depth:2}),deep=node({id:'deep',parent_subtask_id:null,depth:8}),safe=node({id:'safe',depth:2});const nodes=[parent,child,deep,safe];
  expect([...descendantIds(nodes,'branch')]).toEqual(['child']);expect(reparentChoices(nodes,parent).map(n=>n.id)).toEqual(['safe']);
  expect([...descendantIds([parent,child,node({id:'branch',parent_subtask_id:'child'})],'branch')]).toEqual(['child']);
 });
 it('counts only leaves and preserves parent work as a separate review',()=>{
  expect(leafCompletion([node({status:'completed'}),node({id:'child',parent_subtask_id:'branch',status:'completed'}),node({id:'sibling',status:'todo'})])).toEqual({total:2,completed:1});
 });
 it('blocks only earlier ordered siblings under the same root and parent',()=>{
  const current={id:'c',taskId:'root',title:'Current',position:20,siblingOrder:1,parentSubtaskId:'parent',isCompleted:false};
  const foreign={...current,id:'f',position:1,siblingOrder:0,parentSubtaskId:'other'};const prior={...current,id:'p',position:19,siblingOrder:0};
  expect(getSubtaskPrerequisite(current,[foreign,current])).toBeNull();expect(getSubtaskPrerequisite(current,[foreign,prior,current])).toBe(prior);
 });
});
