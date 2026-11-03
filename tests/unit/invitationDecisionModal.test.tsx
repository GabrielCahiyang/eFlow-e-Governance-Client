// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({list:vi.fn(),decide:vi.fn(),send:vi.fn(),toast:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'head'},userProfile:{id:'head',role:'head',org_id:'office'}})}));
vi.mock('../../src/app/hooks/useSupabaseData',()=>({useOrgs:()=>({orgs:[]})}));
vi.mock('../../src/app/shared/officeAuthority',()=>({isAppointedOfficeHead:()=>true}));
vi.mock('../../src/app/components/ui/Modal',()=>({Modal:({title,children,footer}:any)=><div role="dialog" aria-label={title}>{children}{footer}</div>}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('../../src/app/features/project-access',()=>({fetchAccess:vi.fn().mockResolvedValue({}),RemovalDialog:()=>null}));
vi.mock('../../src/app/features/professional-profile',()=>({retryPds:vi.fn()}));
vi.mock('../../src/app/features/project-invitations/components/ProjectInvitationForm',()=>({ProjectInvitationForm:()=>null}));
vi.mock('../../src/app/features/project-invitations/services/projectInvitationService',()=>({listProjectInvitations:mocks.list,decideProjectInvitation:mocks.decide,dispatchProjectInvitation:mocks.send,uploadRequestPds:vi.fn(),completeProjectOnboarding:vi.fn(),designateSponsor:vi.fn()}));
import {ProjectInvitations} from '../../src/app/features/project-invitations/components/ProjectInvitations';
const item={id:'request',project_id:'project',office_id:'office',email:'guest@example.test',summary:'',skills:[],engagement:'consultant',until_close:true,state:'pending',delivery_status:'not_attempted',onboarding:'pending',pds_documents:[],can_approve:true};
beforeEach(()=>{vi.clearAllMocks();mocks.list.mockResolvedValue({office_id:'office',requests:[item]});mocks.decide.mockResolvedValue(undefined);});
afterEach(cleanup);
it.each([['Approve request','Approve this membership request?','Yes, approve','approved','success'],['Reject request','Reject this membership request?','Yes, reject','rejected','warning']])('confirms %s, supports Cancel and never sends email implicitly',async(action,title,yes,status,tone)=>{
 render(<ProjectInvitations project="project" office="office"/>);
 fireEvent.click(await screen.findByRole('button',{name:action}));expect(mocks.decide).not.toHaveBeenCalled();
 fireEvent.click(within(screen.getByRole('dialog',{name:title})).getByRole('button',{name:'Cancel'}));expect(mocks.decide).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:action}));fireEvent.click(screen.getByRole('button',{name:yes}));
 await waitFor(()=>expect(mocks.decide).toHaveBeenCalledWith(item,status));await waitFor(()=>expect(mocks.toast).toHaveBeenCalledWith(expect.any(String),tone));expect(mocks.send).not.toHaveBeenCalled();
});
it('keeps decisions hidden without the server capability',async()=>{
 mocks.list.mockResolvedValue({office_id:'office',requests:[{...item,can_approve:false}]});render(<ProjectInvitations project="project" office="office"/>);
 await screen.findByText('guest@example.test');expect(screen.queryByRole('button',{name:'Approve request'})).toBeNull();expect(screen.queryByRole('button',{name:'Reject request'})).toBeNull();
});
