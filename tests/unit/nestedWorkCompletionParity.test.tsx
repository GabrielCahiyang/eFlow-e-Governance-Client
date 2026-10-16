// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({actor:'new-lead',load:vi.fn(),save:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:mocks.actor}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:mocks.load,saveWorkTree:mocks.save,fetchPersonalWorkRoots:vi.fn(),fetchOfficeWorkRoots:vi.fn(),fetchWorkEvents:vi.fn(),WorkTreeUnavailable:class WorkTreeUnavailable extends Error{}}));
import {WorkTree,leafCompletion,type WorkNode,type WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';

const node=(patch:Partial<WorkNode>={}):WorkNode=>({id:'child',task_id:'root',parent_subtask_id:null,lead_id:'old-lead',title:'Pending child',assigned_to_ids:['old-lead','contributor'],depth:1,sibling_order:0,due_date:null,is_standalone:true,status:'for_review',percent_complete:100,can_manage:false,can_appoint:false,can_order:false,can_work:false,can_review:true,current_reviewer:'new-lead',capabilities:{review:patch.can_review===false?{allowed:false,reason_code:'branch_denied'}:{allowed:true,reason_code:null},manage_contributors:patch.can_manage?{allowed:true,reason_code:null}:{allowed:false,reason_code:'branch_denied'}},...patch});
const snapshot=(n:WorkNode):WorkTreeSnapshot=>{
 const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',lead:'task-lead',open:true,due:null,people:['task-lead']},revision:7,can_manage:false,can_transfer:false,nodes:[n],people:[{id:'old-lead',name:'Recorded Lead',eligible:true},{id:'new-lead',name:'Replacement Lead',eligible:true}],leaf_total:1,leaf_completed:0};
 rememberWorkCapabilityContext(data,mocks.actor);return data;
};
beforeEach(()=>{vi.resetAllMocks();mocks.actor='new-lead';mocks.load.mockResolvedValue(snapshot(node()));});afterEach(cleanup);
if(!globalThis.ResizeObserver)globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
async function openActions(){fireEvent.keyDown(await screen.findByRole('button',{name:'Actions for Pending child'}),{key:'Enter'});await screen.findByRole('menu');}

describe('NW4.2 completion and server review flags',()=>{
 it('counts deep canonical leaves once without mutating manual progress or parent lifecycle',()=>{
  const nodes=Array.from({length:8},(_,i)=>node({id:'depth-'+(i+1),parent_subtask_id:i?'depth-'+i:null,depth:i+1,status:i===7?'completed':'todo',percent_complete:i===7?100:0}));
  nodes.push(node({id:'other-leaf',parent_subtask_id:null,status:'for_review',percent_complete:100}));
  const root={percentComplete:37,status:'in_progress'};const before=structuredClone({nodes,root});
  expect(leafCompletion(nodes)).toEqual({total:2,completed:1});
  expect(leafCompletion([...nodes].reverse())).toEqual({total:2,completed:1});
  expect({nodes,root}).toEqual(before);
  expect(leafCompletion([])).toEqual({total:0,completed:0});
 });
 it('shows and opens review selected by the server even when displayed Lead differs',async()=>{
  const onReview=vi.fn();render(<WorkTree rootId="root" onReviewOfficeNode={onReview}/>);
  await openActions();fireEvent.click(screen.getByRole('menuitem',{name:'Review',exact:true}));
  await waitFor(()=>expect(onReview).toHaveBeenCalledWith(expect.objectContaining({id:'child',lead_id:'old-lead',current_reviewer:'new-lead',can_review:true}),expect.objectContaining({revision:7})));
  expect(screen.getByText(/Task progress is managed separately/)).toBeTruthy();expect(mocks.save).not.toHaveBeenCalled();
 });
 it('removes review on refreshed server denial even when the user is the appointed manager',async()=>{
  render(<WorkTree rootId="root" onReviewOfficeNode={vi.fn()}/>);
  await openActions();expect(screen.getByRole('menuitem',{name:'Review',exact:true})).toBeTruthy();
  mocks.load.mockResolvedValue(snapshot(node({lead_id:'new-lead',can_manage:true,can_review:false,current_reviewer:'another-lead'})));
  await act(async()=>{fireEvent(window,new Event('focus'));});
  await waitFor(()=>expect(screen.queryByRole('menuitem',{name:'Review',exact:true})).toBeNull());
  expect(screen.getByRole('menuitem',{name:'Choose people'})).toBeTruthy();
 });
 it('keeps historical work readable without review controls on a read-only surface',async()=>{
  render(<WorkTree rootId="root" readOnly onReviewOfficeNode={vi.fn()}/>);
  await screen.findByRole('button',{name:'Pending child',exact:true});await openActions();expect(screen.queryByRole('menuitem',{name:'Review',exact:true})).toBeNull();expect(screen.getByRole('menuitem',{name:'Open work / evidence'})).toBeTruthy();
 });
});
