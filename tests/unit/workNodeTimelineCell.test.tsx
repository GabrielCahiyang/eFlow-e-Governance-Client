// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {WorkCapabilityContext,WorkNode,WorkTreeController,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';

const mocks=vi.hoisted(()=>({fetch:vi.fn(),review:vi.fn(),actor:'actor'}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:mocks.fetch}));
vi.mock('../../src/app/features/nested-work/hooks/useWorkImpactConfirmation',()=>({useWorkImpactConfirmation:()=>({review:mocks.review,dialog:null})}));
import {WorkNodeTimelineCell} from '../../src/app/features/nested-work/components/WorkNodeTimelineCell';

const context:WorkCapabilityContext={actorId:'actor',rootId:'root',projectId:'project',officeId:'office',kind:'office',revision:7};
const node=(patch:Partial<WorkNode>={}):WorkNode=>({id:'item',task_id:'root',parent_subtask_id:null,lead_id:'lead',title:'Plan report',assigned_to_ids:[],sibling_order:0,depth:1,due_date:'2026-11-20',start_date:'2026-11-16',started_at:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_appoint:false,can_order:false,can_work:true,can_review:false,capabilities:{edit_details:{allowed:true,reason_code:null}},detail_edit:{version:1,task_id:'root',node_id:'item',updated_at:null,started:false,details:true,due:true,planning:true},...patch});
const tree=(item=node(),parent?:WorkNode):WorkTreeSnapshot=>({root:{id:'root',project:'project',office:'office',kind:'office',lead:'lead',people:[],open:true,due:'2026-11-30',scheduleBounds:{projectStart:'2026-11-01',projectDue:'2026-11-30',taskStart:'2026-11-10',taskDue:'2026-11-30'},scheduling:{version:1,today:'2026-11-16'}},revision:7,nodes:[...(parent?[parent]:[]),item],people:[],can_manage:true,can_transfer:false,leaf_total:1,leaf_completed:0});
let current:WorkTreeSnapshot;
const controller=():WorkTreeController=>({rootId:'root',actorId:'actor',data:current,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(async()=>{}),save:vi.fn(async()=>current)});
function renderCell(item=node(),data=tree(item)){
 current=data;rememberWorkCapabilityContext(data,mocks.actor);
 mocks.fetch.mockImplementation(async()=>{rememberWorkCapabilityContext(current,mocks.actor);return current;});
 return render(<WorkNodeTimelineCell node={item} snapshot={data} context={context} controller={controller()}/>);
}
async function open(){fireEvent.click(screen.getByRole('button',{name:'Edit dates for Plan report'}));await screen.findByRole('dialog',{name:'Subtask timeline for Plan report'});}

beforeEach(()=>{vi.clearAllMocks();mocks.actor='actor';mocks.review.mockResolvedValue('impact-fingerprint');});
afterEach(cleanup);

describe('WorkNodeTimelineCell started-edit policy',()=>{
 it('locks the planned start for started history and requires a reason for an authorized due-date change',async()=>{
  const item=node({started_at:'2026-11-16T02:00:00Z',detail_edit:{version:1,task_id:'root',node_id:'item',updated_at:null,started:true,details:true,due:true,planning:false}});
  renderCell(item);await open();
  const start=screen.getByLabelText('Start date') as HTMLInputElement;
  const due=screen.getByLabelText('Due date') as HTMLInputElement;
  expect(start.disabled).toBe(true);expect(due.disabled).toBe(false);
  expect(screen.queryByLabelText('Due-date change reason')).toBeNull();
  fireEvent.change(due,{target:{value:'2026-11-22'}});
  expect(screen.getByLabelText('Due-date change reason')).toBeTruthy();
  fireEvent.change(due,{target:{value:item.due_date}});
  expect(screen.queryByLabelText('Due-date change reason')).toBeNull();
  fireEvent.change(due,{target:{value:'2026-11-22'}});
  expect(screen.getByRole('button',{name:'Save dates'}).hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText('Due-date change reason'),{target:{value:'Approved schedule extension'}});
  expect(screen.getByRole('button',{name:'Save dates'}).hasAttribute('disabled')).toBe(false);
 });

 it('fails closed when the detail-edit policy is missing',()=>{
  renderCell(node({detail_edit:null}));
  expect((screen.getByRole('button',{name:'Edit dates for Plan report'}) as HTMLButtonElement).disabled).toBe(true);
 });

 it('preserves Personal historical timeline access without requiring the Office policy',async()=>{
  const item=node({started_at:'2026-11-16T02:00:00Z',detail_edit:null});
  const data=tree(item);data.root.kind='personal';data.root.office=null;
  const personalContext={...context,officeId:null,kind:'personal' as const};
  current=data;rememberWorkCapabilityContext(data,mocks.actor);mocks.fetch.mockImplementation(async()=>{rememberWorkCapabilityContext(current,mocks.actor);return current;});
  const ctrl=controller();render(<WorkNodeTimelineCell node={item} snapshot={data} context={personalContext} controller={ctrl}/>);await open();
  expect((screen.getByLabelText('Start date') as HTMLInputElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Due date'),{target:{value:'2026-11-22'}});
  fireEvent.change(screen.getByLabelText('Due-date change reason'),{target:{value:'Personal schedule extension'}});
  fireEvent.click(screen.getByRole('button',{name:'Save dates'}));
  await waitFor(()=>expect(ctrl.save).toHaveBeenCalledWith(expect.objectContaining({payload:expect.objectContaining({note:'Personal schedule extension'})})));
 });

 it('rechecks fresh authority and policy immediately before saving after impact confirmation',async()=>{
  const item=node({started_at:'2026-11-16T02:00:00Z',detail_edit:{version:1,task_id:'root',node_id:'item',updated_at:null,started:true,details:true,due:true,planning:false}});
  const data=tree(item);const ctrl=controller();current=data;
  rememberWorkCapabilityContext(data,mocks.actor);mocks.fetch.mockImplementation(async()=>{rememberWorkCapabilityContext(current,mocks.actor);return current;});
  render(<WorkNodeTimelineCell node={item} snapshot={data} context={context} controller={ctrl}/>);await open();
  fireEvent.change(screen.getByLabelText('Due date'),{target:{value:'2026-11-22'}});
  fireEvent.change(screen.getByLabelText('Due-date change reason'),{target:{value:'Approved schedule extension'}});
  fireEvent.click(screen.getByRole('button',{name:'Save dates'}));
  await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(ctrl.save).toHaveBeenCalledWith(expect.objectContaining({impactFingerprint:'impact-fingerprint',payload:expect.objectContaining({due:'2026-11-22',note:'Approved schedule extension'})}));
 });

 it('denies a due-date change if the fresh policy revokes permission',async()=>{
  const item=node({started_at:'2026-11-16T02:00:00Z',detail_edit:{version:1,task_id:'root',node_id:'item',updated_at:null,started:true,details:true,due:true,planning:false}});
  const fresh=tree(node({...item,detail_edit:{...item.detail_edit!,due:false}}));
  const data=tree(item);const ctrl=controller();current=fresh;rememberWorkCapabilityContext(data,mocks.actor);
  mocks.fetch.mockImplementation(async()=>{rememberWorkCapabilityContext(fresh,mocks.actor);return fresh;});
  render(<WorkNodeTimelineCell node={item} snapshot={data} context={context} controller={ctrl}/>);await open();
  fireEvent.change(screen.getByLabelText('Due date'),{target:{value:'2026-11-22'}});
  fireEvent.change(screen.getByLabelText('Due-date change reason'),{target:{value:'Approved schedule extension'}});
  fireEvent.click(screen.getByRole('button',{name:'Save dates'}));
  await screen.findByText(/permission to change this due date/);expect(ctrl.save).not.toHaveBeenCalled();
 });

 it('uses the appointed Task Lead reschedule message for an out-of-bounds child date',async()=>{
  const parent:WorkNode={...node(),id:'parent',title:'Parent work',parent_subtask_id:null,start_date:'2026-11-10',due_date:'2026-11-20'};
  const child=node({parent_subtask_id:'parent'});const data=tree(child,parent);renderCell(child,data);await open();
  fireEvent.change(screen.getByLabelText('Due date'),{target:{value:'2026-11-21'}});
  expect(await screen.findByText('Subtask dates must stay within the parent schedule.')).toBeTruthy();
 });
});
