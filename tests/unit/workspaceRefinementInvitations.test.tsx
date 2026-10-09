// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({submit:vi.fn(),pds:vi.fn(),list:vi.fn(),dispatch:vi.fn(),decide:vi.fn(),rpc:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'owner'}})}));
vi.mock('../../src/app/features/invitations',()=>({InvitationPersonFields:({email,onEmail,onFile,disabled,children}:any)=><fieldset disabled={disabled}><label>Email address<input type="email" value={email} onChange={e=>onEmail(e.target.value)}/></label><label>PDS<input type="file" onChange={e=>onFile(e.target.files?.[0])}/></label>{children}</fieldset>}));
vi.mock('../../src/app/features/project-invitations/services/projectInvitationService',async importOriginal=>({...await importOriginal<any>(),submitProjectInvitation:api.submit,uploadRequestPds:api.pds,listProjectInvitations:api.list,dispatchProjectInvitation:api.dispatch,decideProjectInvitation:api.decide}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc}}));
import {ProjectInvitationForm} from '../../src/app/features/project-invitations/components/ProjectInvitationForm';
import {ProjectInvitations} from '../../src/app/features/project-invitations';
import {accessEnd} from '../../src/app/features/project-invitations/services/projectInvitationService';
beforeEach(()=>{vi.resetAllMocks();api.list.mockResolvedValue({kind:'office',office_id:'office',timezone:'Asia/Singapore',requests:[]});});afterEach(cleanup);
it('converts local end date to exclusive UTC boundary, including DST',()=>{expect(accessEnd('2026-10-08','Asia/Singapore')).toBe('2026-10-08T16:00:00.000Z');expect(accessEnd('2026-03-08','America/New_York')).toBe('2026-03-09T04:00:00.000Z');expect(accessEnd('','UTC')).toBeNull();});
it('submits a request without dispatch and retries PDS independently',async()=>{
 api.submit.mockImplementation(async(_project,_office,row)=>({id:row.id,state:'pending'}));api.pds.mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValue({});
 render(<ProjectInvitationForm project="project" office="office" root="root" timezone="Asia/Singapore" onDone={vi.fn()} onClose={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'guest@example.test'}});fireEvent.change(screen.getByLabelText('PDS'),{target:{files:[new File(['%PDF-1.4'],'PDS.pdf',{type:'application/pdf'})]}});fireEvent.click(screen.getByRole('button',{name:'Submit requests for Head approval'}));
 await screen.findByRole('button',{name:'Retry PDS only for guest@example.test'});expect(api.dispatch).not.toHaveBeenCalled();expect(api.submit).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole('button',{name:'Retry PDS only for guest@example.test'}));await screen.findByText(/Attached · processing/);expect(api.submit).toHaveBeenCalledTimes(1);expect(api.pds).toHaveBeenCalledTimes(2);
});
it('mixed request retry excludes the successfully submitted person',async()=>{
 api.submit.mockImplementationOnce(async(_p,_o,row)=>({id:row.id,state:'pending'})).mockRejectedValueOnce(new Error('Request unavailable')).mockImplementation(async(_p,_o,row)=>({id:row.id,state:'pending'}));
 render(<ProjectInvitationForm project="project" office="office" timezone="Asia/Singapore" onDone={vi.fn()} onClose={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'first@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Add another person'}));fireEvent.change(screen.getAllByLabelText('Email address')[1],{target:{value:'second@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Submit requests for Head approval'}));await screen.findByText(/Request unavailable/);const failed=api.submit.mock.calls[1][2].id;fireEvent.click(screen.getByRole('button',{name:'Submit requests for Head approval'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(3));expect(api.submit.mock.calls[2][2].id).toBe(failed);expect(api.submit.mock.calls[2][2].email).toBe('second@example.test');expect(api.dispatch).not.toHaveBeenCalled();
});
it('retains attempted terms and request identity after a lost response',async()=>{
 api.submit.mockRejectedValueOnce(new Error('Receipt lost')).mockImplementation(async(_p,_o,row)=>({id:row.id}));render(<ProjectInvitationForm project="project" office="office" timezone="Asia/Singapore" onDone={vi.fn()} onClose={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'guest@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Submit requests for Head approval'}));await screen.findByText(/Receipt lost/);expect((screen.getByLabelText('Email address') as HTMLInputElement).closest('fieldset')?.disabled).toBe(true);const id=api.submit.mock.calls[0][2].id;fireEvent.click(screen.getByRole('button',{name:'Submit requests for Head approval'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(2));expect(api.submit.mock.calls[1][2].id).toBe(id);
});
it('does not show dispatch before approval and never labels provider acceptance as delivery',async()=>{
 api.list.mockResolvedValue({kind:'office',office_id:'office',requests:[{id:'request',email:'guest@example.test',state:'pending',engagement:'Consultant',until_close:true,skills:[],summary:'',revision:1,delivery_status:'not_attempted',onboarding:'pending',pds_documents:[],can_approve:true,can_dispatch:false,can_revoke:false}]});render(<ProjectInvitations project="project"/>);await screen.findByRole('button',{name:'Approve request'});expect(screen.queryByRole('button',{name:'Create invitation and send email'})).toBeNull();expect(api.dispatch).not.toHaveBeenCalled();
});
it('a portal invitation submit cannot also submit the enclosing work editor',async()=>{
 api.submit.mockImplementation(async(_p,_o,row)=>({id:row.id,state:'pending'}));const parent=vi.fn();
 render(<div onSubmit={parent}><ProjectInvitationForm project="project" office="office" timezone="Asia/Singapore" onDone={vi.fn()} onClose={vi.fn()}/></div>);fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'guest@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Submit requests for Head approval'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());expect(parent).not.toHaveBeenCalled();
});
