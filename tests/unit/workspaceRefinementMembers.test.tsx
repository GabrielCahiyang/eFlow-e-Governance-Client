// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const calls=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),actor:'head',members:[] as unknown[],refresh:vi.fn()}));
vi.mock('../../src/app/features/project-access',()=>({fetchAccess:()=>Promise.reject(new Error('R9 unavailable')),previewSelection:()=>Promise.resolve(null),saveSelection:vi.fn(),ProjectAccessPanel:()=>null,RemovalDialog:()=>null,ACCESS_CHANGED_EVENT:'eflow-project-access-changed'}));
vi.mock('../../src/app/features/project-invitations',()=>({ProjectInvitations:()=>null}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:calls.actor}})}));
vi.mock('../../src/app/features/project-members/services/memberService',()=>({fetchMembers:calls.load,saveMemberTerms:calls.save}));
vi.mock('../../src/app/features/project-offices',()=>({useProjectOfficeContext:()=>({members:calls.members,refresh:calls.refresh}),OfficeMembersEditor:({members}:{members:{user_id:string}[]})=><p>Canonical selection: {members.map(m=>m.user_id).join(',')}</p>}));
import {ProjectMembers} from '../../src/app/features/project-members';
import {MemberTermsEditor} from '../../src/app/features/project-members/components/MemberTermsEditor';
import type {SelectedMember} from '../../src/app/features/project-members';
const member:SelectedMember={user_id:'selected',project_office_id:'participation',office:'office',office_name:'Planning Office',name:'Selected person',engagement:'Permanent',access_end:null,until_close:false,access_ended_at:null,access:'member',state:'joined',eligible:true,can_read:true,responsibilities:[{root:'root',title:'Root / Nested work',role:'Subitem Lead',node:'child'}]};
const data={kind:'office',members:[member,{...member,user_id:'viewer',name:'Read only person',access:'viewer',eligible:false,responsibilities:[]}],offices:[{id:'participation',project_id:'project',office_id:'office',name:'Planning Office',can_select:true,eligible_count:0,relationship_type:'lead',invitation_status:'joined'}]};
beforeEach(()=>{vi.resetAllMocks();calls.actor='head';calls.members=[];calls.load.mockResolvedValue(data);});afterEach(cleanup);
it('lists selected project membership, effective Viewer access and nested responsibility drill-through',async()=>{
 const open=vi.fn();render(<ProjectMembers projectId="project" projectStatus="active" profiles={[]} tasks={[]} onOpenTask={open}/>);await screen.findByText('Selected person');expect(screen.getByText('Read only person')).toBeTruthy();expect(screen.getByText('No assigned responsibility')).toBeTruthy();expect(screen.getByText('View authorized project information; no execution or delegation')).toBeTruthy();
 fireEvent.click(screen.getAllByRole('button',{name:'Root / Nested work · Subitem Lead'})[0]);expect(open).toHaveBeenCalledWith('root');fireEvent.click(screen.getByRole('button',{name:'Add existing members · Planning Office'}));expect(screen.getByText('Canonical selection: selected,viewer')).toBeTruthy();
});
it('gives empty Office guidance and keeps closed project membership read-only',async()=>{
 render(<ProjectMembers projectId="project" projectStatus="archived" profiles={[]} tasks={[]} onOpenTask={vi.fn()}/>);await screen.findByText('Selected person');expect(screen.getByText(/No onboarded eligible staff/)).toBeTruthy();expect(screen.queryByRole('button',{name:/Add existing|Edit access terms/})).toBeNull();
});
it('requires temporary terms and retries one identity after a missing write receipt',async()=>{
 calls.save.mockRejectedValueOnce(new Error('Receipt lost')).mockResolvedValue(member);render(<MemberTermsEditor project="project" member={member} onClose={vi.fn()} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Engagement'),{target:{value:'OJT'}});expect((screen.getByRole('button',{name:'Save access terms'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('checkbox',{name:'Until project completion or archive'}));fireEvent.click(screen.getByRole('button',{name:'Save access terms'}));await screen.findByText(/Receipt lost/);expect((screen.getByLabelText('Engagement') as HTMLSelectElement).disabled).toBe(true);
 const request=calls.save.mock.calls[0][5];fireEvent.click(screen.getByRole('button',{name:'Save access terms'}));await screen.findByText('Access terms saved.');expect(calls.save.mock.calls[1][5]).toBe(request);expect(screen.queryByRole('button',{name:'Save access terms'})).toBeNull();
});
it('clears old membership when project or account identity changes',async()=>{
 const view=render(<ProjectMembers projectId="project" projectStatus="active" profiles={[]} tasks={[]} onOpenTask={vi.fn()}/>);await screen.findByText('Selected person');calls.actor='other';calls.load.mockRejectedValue(new Error('Current project access denied'));view.rerender(<ProjectMembers projectId="other" projectStatus="active" profiles={[]} tasks={[]} onOpenTask={vi.fn()}/>);await screen.findByText('Current project access denied');expect(screen.queryByText('Selected person')).toBeNull();
});