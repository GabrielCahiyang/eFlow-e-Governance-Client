// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({preview:vi.fn(),remove:vi.fn(),load:vi.fn(),grant:vi.fn(),revoke:vi.fn(),selection:vi.fn(),save:vi.fn(),read:vi.fn(),confirm:vi.fn(),legacy:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'head'}})}));
vi.mock('../../src/app/features/project-access/services/accessService',()=>({previewRemoval:api.preview,removePerson:api.remove,fetchAccess:api.load,grantAccess:api.grant,revokeViewer:api.revoke,shareUrl:(id:string)=>`https://example.test/project-share?grant=${id}`,ACCESS_CHANGED_EVENT:'eflow-project-access-changed'}));
vi.mock('../../src/app/features/project-access',()=>({previewSelection:api.selection,saveSelection:api.save}));
vi.mock('../../src/app/features/project-offices/services/staffingAuthority',()=>({readStaffingAuthority:api.read}));
vi.mock('../../src/app/features/project-offices/services/projectOfficeService',()=>({selectProjectOfficeMembersChecked:api.legacy}));
vi.mock('../../src/app/components/ui/useConfirmation',()=>({useConfirmation:()=>({confirm:api.confirm,dialog:null})}));
import {RemovalDialog} from '../../src/app/features/project-access/components/RemovalDialog';
import {ProjectAccessPanel} from '../../src/app/features/project-access/components/ProjectAccessPanel';
import {OfficeMembersEditor} from '../../src/app/features/project-offices/components/OfficeMembersEditor';
const impact={project:'p',user:'m',office:'o',fingerprint:'current',tasks:[{id:'outside',title:'Outside loaded page',status:'in_progress'}],nodes:[{id:'nested',title:'Deep descendant',root:'outside',lead:'m',people:['m'],status:'for_review'}]};
const permissions={can_share:true,open:true,kind:'office',timezone:'Asia/Singapore',grants:[],can_remove_offices:['o'],can_remove_personal:false};
beforeEach(()=>{vi.clearAllMocks();api.preview.mockResolvedValue(impact);api.remove.mockResolvedValue({removed:'m'});api.load.mockResolvedValue(permissions);api.grant.mockResolvedValue({id:'offer',redeem_expires_at:'2026-12-31T00:00:00Z'});api.selection.mockResolvedValue({fingerprint:'scope',removed:[impact]});api.read.mockResolvedValue(['m']);api.confirm.mockResolvedValue(true);api.save.mockResolvedValue([]);});afterEach(cleanup);
it('shows the full server impact and cancellation performs zero writes',async()=>{
 const close=vi.fn();render(<RemovalDialog project="p" user="m" office="o" name="Maria" onClose={close} onRemoved={vi.fn()}/>);await screen.findByText(/Outside loaded page/);expect(screen.getByText(/Deep descendant/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Cancel removal'}));expect(close).toHaveBeenCalledOnce();expect(api.remove).not.toHaveBeenCalled();
});
it('retries an uncertain removal with the same fingerprint and request, then avoids replay after refresh failure',async()=>{
 api.remove.mockRejectedValueOnce(new Error('Lost response'));const refreshed=vi.fn().mockRejectedValue(new Error('Refresh failed'));render(<RemovalDialog project="p" user="m" office="o" name="Maria" onClose={vi.fn()} onRemoved={refreshed}/>);await screen.findByText(/Outside loaded page/);fireEvent.click(screen.getByRole('button',{name:'Confirm removal and unassign work'}));await screen.findByText('Lost response');fireEvent.click(screen.getByRole('button',{name:'Confirm removal and unassign work'}));await screen.findByText(/Removal saved. Refresh failed/);expect(api.remove.mock.calls[0]).toEqual(api.remove.mock.calls[1]);expect(screen.queryByRole('button',{name:'Confirm removal and unassign work'})).toBeNull();expect(refreshed).toHaveBeenCalledOnce();
});
it('refreshes a stale impact explicitly before a fresh confirmed request',async()=>{
 api.remove.mockRejectedValueOnce(new Error('Assignments changed'));render(<RemovalDialog project="p" user="m" office="o" name="Maria" onClose={vi.fn()} onRemoved={vi.fn()}/>);await screen.findByText(/Outside loaded page/);fireEvent.click(screen.getByRole('button',{name:'Confirm removal and unassign work'}));await screen.findByText('Assignments changed');api.preview.mockResolvedValue({...impact,fingerprint:'new'});fireEvent.click(screen.getByRole('button',{name:'Refresh impact preview'}));await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(2));fireEvent.click(screen.getByRole('button',{name:'Confirm removal and unassign work'}));await screen.findByText(/Removal saved. Affected/);expect(api.remove.mock.calls[1][0].fingerprint).toBe('new');expect(api.remove.mock.calls[1][1]).not.toBe(api.remove.mock.calls[0][1]);
});
it('hides issuance for viewers and discards late capability responses when the project changes',async()=>{
 let finish!:(value:unknown)=>void;api.load.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({...permissions,can_share:false});const view=render(<ProjectAccessPanel project="first"/>);view.rerender(<ProjectAccessPanel project="next"/>);await screen.findByText(/Sharing is managed by/);await act(async()=>finish(permissions));expect(screen.queryByRole('button',{name:'Create share offer'})).toBeNull();expect(api.grant).not.toHaveBeenCalled();
});
it('cannot confirm an old person impact after switching removal context',async()=>{
 let finish!:(value:unknown)=>void;api.preview.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({...impact,user:'next',fingerprint:'next'});
 const view=render(<RemovalDialog project="p" user="old" office="o" name="Old person" onClose={vi.fn()} onRemoved={vi.fn()}/>);
 view.rerender(<RemovalDialog project="p" user="next" office="o" name="Next person" onClose={vi.fn()} onRemoved={vi.fn()}/>);await screen.findByText(/Outside loaded page/);await act(async()=>finish({...impact,user:'old',fingerprint:'old'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirm removal and unassign work'}));await screen.findByText(/Removal saved. Affected/);expect(api.remove.mock.calls[0][0].user).toBe('next');expect(api.remove.mock.calls[0][0].fingerprint).toBe('next');
});
it('creates a recipient-bound offer using a seven-day redemption TTL and the exclusive local-date boundary',async()=>{
 render(<ProjectAccessPanel project="p"/>);const email=await screen.findByLabelText('Existing verified recipient email');fireEvent.change(email,{target:{value:'m@example.test'}});fireEvent.change(screen.getByLabelText('Access ends after this date · Asia/Singapore'),{target:{value:'2026-12-31'}});fireEvent.click(screen.getByRole('button',{name:'Create share offer'}));await screen.findByText(/Share offer created for/);expect(api.grant.mock.calls[0].slice(1)).toEqual(['p','m@example.test','viewer','Permanent','2026-12-31T16:00:00.000Z',true,7]);expect(screen.getByLabelText('Recipient project link').getAttribute('value')).toContain('grant=offer');
});
it('replaces the unfinished-work refusal with a complete Office selection review and an atomic save',async()=>{
 render(<OfficeMembersEditor office={{id:'po',project_id:'p',office_id:'o'}} profiles={[{id:'m',full_name:'Maria',email:'m@example.test',org_id:'o',role:'member',is_active:true} as never]} members={[{project_office_id:'po',user_id:'m'}]} tasks={[{id:'outside',title:'Active work',linkedProjectId:'p',orgId:'o',status:'in_progress',teamMemberIds:['m']} as never]} actorId="head" disabledReason="" onCancel={vi.fn()} onSaved={vi.fn().mockResolvedValue(undefined)}/>);
 await waitFor(()=>expect(api.selection).toHaveBeenCalled());fireEvent.click(screen.getByRole('checkbox',{name:/Maria/}));const button=screen.getByRole('button',{name:'Save project team'});await waitFor(()=>expect(button.matches(':disabled')).toBe(false));fireEvent.click(button);await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());expect(api.save.mock.calls[0].slice(0,3)).toEqual(['po',[],'scope']);expect(api.confirm.mock.calls[0][0].description).toContain('unassigns');expect(api.legacy).not.toHaveBeenCalled();
});
