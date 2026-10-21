// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({role:'head',empty:[] as any[],projects:[{id:'p',title:'Standalone project',orgId:'office',priority:'medium',status:'planning',createdAt:1,updatedAt:1}],orgs:[{id:'office',name:'LEDIPO',is_active:true,head_user_id:'head'}]}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:fixture.role},userProfile:{id:fixture.role,role:fixture.role,org_id:'office',is_active:true},can:()=>fixture.role==='head'})}));
vi.mock('../../src/app/hooks/useSupabaseData',()=>({useProjectsData:()=>({projects:fixture.projects,loading:false}),useOrgs:()=>({orgs:fixture.orgs}),useProfiles:()=>({profiles:fixture.empty})}));
vi.mock('../../src/app/hooks/useFirebaseData',()=>({useTasks:()=>({tasks:fixture.empty,loading:false})}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('../../src/app/features/workspaces',()=>({useWorkspaceScope:()=>null}));
vi.mock('../../src/app/features/members',()=>({useDeptDirectoryEmployees:()=>({deptEmployees:fixture.empty})}));
vi.mock('../../src/app/features/notifications',()=>({useNotificationNavigationIntent:()=>{}}));
vi.mock('../../src/app/features/work-templates',()=>({ProjectTemplatesModal:()=>null}));
vi.mock('../../src/app/features/proposal-import',()=>({CreateWorkPlanDialog:()=>null}));
vi.mock('../../src/app/features/project-table',()=>({CreateProjectDialog:()=>null}));
vi.mock('../../src/app/features/task-inspector',()=>({TaskDetailDrawer:()=>null}));
vi.mock('../../src/app/features/interdepartment-collaboration',()=>({useCollaborationDrafts:()=>({drafts:fixture.empty,loading:false,membershipOrgIds:fixture.empty,refresh:vi.fn()}),isActiveCollaborationDraft:()=>true,subscribeToCollaborationDraftChanges:()=>()=>{},CollaborationDraftList:()=>null,CollaborationDraftWorkspace:()=>null}));
vi.mock('../../src/app/features/projects/components/ProjectDetail',()=>({ProjectDetail:({project,onBack}:any)=><section aria-label="Standalone detail"><h1>{project.title}</h1><button onClick={onBack}>Return to index</button></section>}));
import {ProjectsWorkspace} from '../../src/app/features/projects/components/ProjectsWorkspace';
beforeEach(()=>{fixture.role='head';window.history.replaceState({},'','/projects?page=Projects');});
afterEach(cleanup);
describe('Projects without a navigation host',()=>{
 it('keeps the common toolbar and index without selecting a first project or rendering another rail',()=>{
  render(<ProjectsWorkspace scope={{includeAllAccessibleWork:false,scopedOrgIds:['office'],enforceOrgScope:true}} eyebrow="Head"/>);
  expect(screen.getByRole('region',{name:'All projects'})).toBeTruthy();expect(screen.getByRole('button',{name:'+ New'})).toBeTruthy();expect(screen.queryByRole('complementary')).toBeNull();expect(screen.queryByRole('region',{name:'Standalone detail'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Standalone project',exact:true}));expect(screen.getByRole('region',{name:'Standalone detail'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Return to index'}));expect(screen.getByRole('region',{name:'All projects'})).toBeTruthy();
 });
 it('does not grant creation to a Member in standalone mode',()=>{
  fixture.role='member';render(<ProjectsWorkspace scope={{includeAllAccessibleWork:false,scopedOrgIds:['office']}} eyebrow="Member"/>);expect(screen.queryByRole('button',{name:'+ New'})).toBeNull();expect(screen.queryByRole('button',{name:'Create project'})).toBeNull();expect(screen.getByRole('region',{name:'All projects'})).toBeTruthy();
 });
});
