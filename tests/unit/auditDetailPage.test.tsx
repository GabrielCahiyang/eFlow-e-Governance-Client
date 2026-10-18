// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({fetch:vi.fn(),invalidate:()=>{},actor:'admin-one',allowed:true}));
vi.mock('../../src/lib/supabase',()=>({supabase:{}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({userProfile:{id:api.actor,role:'admin',org_id:'office'},permissionsLoading:false,can:()=>api.allowed})}));
vi.mock('../../src/app/hooks/useSupabaseData',()=>({useProfiles:()=>({profiles:[]}),useOrgs:()=>({orgs:[{id:'office',name:'LEDIPO'}]})}));
vi.mock('../../src/app/features/audit/services/administrativeAuditWindow',()=>({fetchAdministrativeAuditWindow:api.fetch,subscribeAdministrativeAuditInvalidation:(callback:()=>void)=>{api.invalidate=callback;return()=>{};}}));
import {AdminAuditLog} from '../../src/app/features/audit/components/AdminAuditLog';
import type {AuditEvent} from '../../src/app/services/auditService';
const event=(patch:Partial<AuditEvent>={}):AuditEvent=>({id:'event-one',actorName:'Maria Santos',entityType:'profile',entityId:'profile-one',action:'profile.updated',orgId:'office',createdAt:Date.parse('2026-10-17T08:00:00Z'),reason:'Recorded reason',beforeData:{notes:'Long before value '.repeat(100),settings:{secret:'private-before'}},afterData:{notes:'Long after value '.repeat(100),settings:{secret:'private-after'}},metadata:{config:{api_key:'private-metadata',ordinary:'Visible context'},pds:{address:'private-address'}},...patch});
beforeEach(()=>{api.fetch.mockReset();api.actor='admin-one';api.allowed=true;api.fetch.mockResolvedValue({events:[event()],total:1});});
afterEach(cleanup);
const inspect=async(id='event-one')=>{const button=await screen.findByRole('button',{name:`Inspect audit event ${id}`,exact:true});fireEvent.click(button);return button;};
const selectTab=(name:string|RegExp)=>fireEvent.keyDown(screen.getByRole('tab',{name}),{key:'Enter'});
describe('in-page Account Audit details',()=>{
 it('preserves filters, mounted table sorting and return focus without a modal',async()=>{
  api.fetch.mockResolvedValue({events:[event(),event({id:'event-two',actorName:'Ana Cruz'})],total:2});render(<AdminAuditLog/>);
  const search=await screen.findByPlaceholderText('Search person, action or record…');fireEvent.change(search,{target:{value:'profile'}});
  fireEvent.click(screen.getByRole('button',{name:'Actor',exact:true}));
  const trigger=await inspect();expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getByRole('heading',{level:1,name:'Profile updated'})).toBe(document.activeElement);
  expect(document.body.style.overflow).not.toBe('hidden');
  fireEvent.click(screen.getByRole('button',{name:'Back to Account Audit',exact:true}));
  await waitFor(()=>expect(document.activeElement).toBe(trigger));expect(search).toHaveValue('profile');
  expect(screen.getByRole('columnheader',{name:/Actor/})).toHaveAttribute('aria-sort','ascending');
  expect(within(screen.getAllByRole('row')[1]).getByText('Ana Cruz')).toBeTruthy();
 });
 it('keeps long changes readable and uses existing nested redaction for metadata and copy values',async()=>{
  const write=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:write}});
  const view=render(<AdminAuditLog/>);await inspect();selectTab(/Changed fields/);
  expect(screen.getByText('Long before value '.repeat(100).trim())).toBeTruthy();expect(screen.getByText('Long after value '.repeat(100).trim())).toBeTruthy();
  selectTab('Technical details');expect(screen.getByText(/Visible context/)).toBeTruthy();
  expect(view.container.textContent).not.toMatch(/private-before|private-after|private-metadata|private-address/);
  fireEvent.click(screen.getByRole('button',{name:'Copy event reference'}));await waitFor(()=>expect(write).toHaveBeenCalledWith('event-one'));
 });
 it('shows honest empty states and navigable breadcrumbs',async()=>{
  api.fetch.mockResolvedValue({events:[event({beforeData:undefined,afterData:undefined,metadata:undefined,reason:undefined})],total:1});render(<AdminAuditLog/>);await inspect();
  expect(screen.getByText('No note was recorded for this event.')).toBeTruthy();selectTab(/Changed fields/);
  expect(screen.getByText('No field-level changes were recorded.')).toBeTruthy();selectTab('Technical details');
  expect(screen.getByText('No additional metadata was recorded.')).toBeTruthy();
  fireEvent.click(within(screen.getByRole('navigation',{name:'Breadcrumb'})).getByRole('button',{name:'Account Audit',exact:true}));
  expect(await screen.findByRole('table')).toBeTruthy();
 });
 it('renders structured arrays and missing references without exposing nested secrets',async()=>{
  api.fetch.mockResolvedValue({events:[event({actorName:'Unknown actor reference',orgId:undefined,entityId:undefined,beforeData:{participants:[{name:'Original person',token:'private-array-secret'}]},afterData:{participants:[{name:'Current person',token:'private-array-secret'}]}})],total:1});
  const view=render(<AdminAuditLog/>);await inspect();const page=within(view.container.querySelector<HTMLElement>('.record-detail-page')!);expect(page.getByText('Unknown actor reference')).toBeTruthy();expect(page.getByText('Not recorded')).toBeTruthy();
  selectTab('Changed fields');expect(screen.getByText(/Original person.*••••/s)).toBeTruthy();expect(screen.getByText(/Current person.*••••/s)).toBeTruthy();expect(view.container.textContent).not.toContain('private-array-secret');
 });
 it('hides old details during verification and fails closed when a refreshed window removes the event',async()=>{
  let resolve!:(value:{events:AuditEvent[];total:number})=>void;render(<AdminAuditLog/>);await inspect();
  api.fetch.mockReturnValueOnce(new Promise(yes=>{resolve=yes;}));act(()=>api.invalidate());
  expect(screen.queryByText('Recorded reason')).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('Checking current access');
  await act(async()=>resolve({events:[],total:0}));expect(screen.getByRole('alert')).toHaveTextContent('Event unavailable');
  expect(screen.queryByText('Recorded reason')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Back to Account Audit',exact:true}));
  expect(document.activeElement).toBe(screen.getByPlaceholderText('Search person, action or record…'));
 });
 it('replaces an open event with the current permitted read and handles read failure with Back',async()=>{
  render(<AdminAuditLog/>);await inspect();api.fetch.mockResolvedValueOnce({events:[event({reason:'Current verified reason'})],total:1});
  fireEvent.click(screen.getByRole('button',{name:'Refresh audit',exact:true}));await screen.findByText('Current verified reason');expect(screen.queryByText('Recorded reason')).toBeNull();
  api.fetch.mockRejectedValueOnce(new Error('Permission-scoped read failed'));act(()=>api.invalidate());
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Permission-scoped read failed'));expect(screen.queryByText('Current verified reason')).toBeNull();
  expect(screen.getByRole('button',{name:'Back to Account Audit',exact:true})).toBeTruthy();
 });
 it('discards selected data immediately when the actor changes or page permission is removed',async()=>{
  const view=render(<AdminAuditLog/>);await inspect();api.actor='admin-two';api.fetch.mockReturnValue(new Promise(()=>{}));view.rerender(<AdminAuditLog/>);
  expect(screen.queryByText('Recorded reason')).toBeNull();expect(screen.queryByRole('heading',{name:'Profile updated'})).toBeNull();
  api.allowed=false;view.rerender(<AdminAuditLog/>);expect(screen.getByRole('alert')).toHaveTextContent('Audit access unavailable');
 });
});
