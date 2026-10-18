// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Organization, UserProfile } from '../../src/app/types';
import type { Project } from '../../src/app/features/projects/services/types';
import type { ProjectOfficeState } from '../../src/app/features/project-offices/types';
const fixture = vi.hoisted(() => ({ profile: {} as UserProfile, state: {} as ProjectOfficeState }));
vi.mock('../../src/app/contexts/AuthContext', () => ({useAuth:()=>({user:{id:'head'},userProfile:fixture.profile})}));
vi.mock('../../src/app/features/project-offices/hooks/useProjectOffices', () => ({useProjectOfficeContext:()=>fixture.state}));
vi.mock('../../src/app/features/project-offices/components/OfficeMembersEditor', () => ({OfficeMembersEditor:(props:{office:{id:string};members:unknown[];disabledReason:string})=><div data-testid="canonical-editor" data-disabled={props.disabledReason}>{props.office.id} · {props.members.length} selected</div>}));
vi.mock('../../src/app/features/projects/components/ProjectsPortfolioTable', () => ({ProjectsPortfolioTable:({projects,onOpen}:{projects:Project[];onOpen:(id:string)=>void})=><div>{projects.map(project=><button key={project.id} onClick={()=>onOpen(project.id)}>{project.title}</button>)}</div>}));
import { ProjectIndex } from '../../src/app/features/projects/components/ProjectIndex';
import { ProjectPeoplePage } from '../../src/app/features/project-offices/components/ProjectPeoplePage';
import { useProjectLocation } from '../../src/app/features/projects/hooks/useProjectLocation';
import { destinationNavigationParameters } from '../../src/app/features/navigation/queryContext';
import { writeNavigationLocation } from '../../src/app/features/navigation';
import { pushNavigationHistory } from '../../src/app/shared/navigationHistory';
const organizations=[{id:'office',name:'LEDIPO',is_active:true,head_user_id:'head'},{id:'partner',name:'Partner Office',is_active:true,head_user_id:'partner-head'}] as Organization[];
const projects:Project[]=[{id:'a',title:'Alpha',orgId:'office',status:'active',description:'',priority:'medium',createdAt:1,updatedAt:1},{id:'b',title:'Beta',orgId:'partner',status:'planning',description:'',priority:'medium',createdAt:2,updatedAt:2},{id:'c',title:'Archive',orgId:'office',status:'archived',description:'',priority:'medium',createdAt:3,updatedAt:3}];
beforeEach(()=>{
  fixture.profile={id:'head',role:'head',is_active:true,org_id:'office'} as UserProfile;
  fixture.state={projectId:'a',offices:[{id:'own',project_id:'a',office_id:'office',relationship_type:'lead',invitation_status:'joined',contact_email:'',contact_user_id:'head',joined_at:null}],members:[{project_office_id:'own',user_id:'head'}],loading:false,error:'',refresh:vi.fn().mockResolvedValue(undefined)};
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  window.history.replaceState({},'','/projects');
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('project portfolio and route restoration',()=>{
  it('browses the supplied authorized projects with status, search, Office and sort filters',()=>{
    const open=vi.fn();render(<ProjectIndex projects={projects} tasks={[]} organizations={organizations} profiles={[]} onOpen={open} onOpenProposal={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:'Archive'})).toBeNull();
    const order=()=>screen.getAllByRole('button').map(button=>button.textContent).filter(title=>['Alpha','Beta','Archive'].includes(title||''));
    expect(order()).toEqual(['Beta','Alpha']);
    fireEvent.change(screen.getByLabelText('Sort projects'),{target:{value:'name'}});expect(order()).toEqual(['Alpha','Beta']);
    fireEvent.change(screen.getByLabelText('Lead office'),{target:{value:'partner'}});expect(order()).toEqual(['Beta']);
    fireEvent.click(screen.getByRole('button',{name:'Beta'}));expect(open).toHaveBeenCalledWith('b');
    fireEvent.change(screen.getByLabelText('Search projects'),{target:{value:'no match'}});expect(screen.getByText('No projects match these filters')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));fireEvent.change(screen.getByLabelText('Status'),{target:{value:'archived'}});expect(order()).toEqual(['Archive']);
    expect(screen.queryByRole('button',{name:'Create project'})).toBeNull();
  });
  it('offers creation in a truly empty authorized portfolio',()=>{
    const create=vi.fn();render(<ProjectIndex projects={[]} tasks={[]} organizations={[]} profiles={[]} onOpen={vi.fn()} onOpenProposal={vi.fn()} onCreate={create}/>);
    expect(screen.getByText('No projects yet')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Create project'}));expect(create).toHaveBeenCalledOnce();
  });
  it('restores index, exact project and unavailable contexts without selecting a first project',()=>{
    const onIndex=vi.fn(),onOpen=vi.fn(),onUnavailable=vi.fn();
    renderHook(()=>useProjectLocation({projects,loading:false,onIndex,onOpen,onUnavailable}));expect(onIndex).toHaveBeenCalledOnce();expect(onOpen).not.toHaveBeenCalled();
    act(()=>pushNavigationHistory('/projects?project=b&view=board'));expect(onOpen).toHaveBeenCalledWith('b',false);
    act(()=>pushNavigationHistory('/projects?project=missing'));expect(onUnavailable).toHaveBeenCalledWith('missing');
  });
  it('does not rewrite another workspace or erase a proposal focus while waiting for its source',()=>{
    const onIndex=vi.fn(),onOpen=vi.fn(),onUnavailable=vi.fn();window.history.replaceState({},'','/projects?workspace=other&project=missing');
    renderHook(()=>useProjectLocation({projects,loading:false,onIndex,onOpen,onUnavailable,workspaceId:'office'}));expect(onUnavailable).not.toHaveBeenCalled();
    act(()=>pushNavigationHistory('/projects?workspace=office&proposal=draft'));expect(onIndex).not.toHaveBeenCalled();expect(onOpen).not.toHaveBeenCalled();
  });
  it('clears stale project context on explicit index navigation and preserves the workspace',()=>{
    window.history.replaceState({},'','/projects?workspace=office&project=a&view=board&people=add');
    act(()=>writeNavigationLocation('projects','Projects','push',{parameters:{}}));
    const params=new URLSearchParams(window.location.search);expect(params.get('workspace')).toBe('office');expect(params.has('project')).toBe(false);expect(params.has('people')).toBe(false);
    expect(destinationNavigationParameters('projects',{proposal:'draft',proposalView:'governance',plans:'saved',people:'add'})).toEqual({proposal:'draft',proposalView:'governance'});
    expect(destinationNavigationParameters('projects',{project:'a',proposal:'draft',view:'board',people:'add'})).toEqual({project:'a',view:'board',people:'add'});
  });
});
describe('direct canonical Office staffing entry',()=>{
  const page=(overrides:Partial<Parameters<typeof ProjectPeoplePage>[0]>={})=>render(<ProjectPeoplePage projectTitle="Alpha" projectStatus="planning" governed={false} profiles={[]} organizations={organizations} tasks={[]} onClose={vi.fn()} onOpenTask={vi.fn()} {...overrides}/>);
  it('uses the existing canonical editor and selected roster for its appointed Head',()=>{page();expect(screen.getByTestId('canonical-editor').textContent).toContain('own · 1 selected');});
  it('allows the participating Head to select only their own joined Office',()=>{
    fixture.state.offices.unshift({...fixture.state.offices[0],id:'lead',office_id:'partner'});
    fixture.state.offices[1].relationship_type='collaborating';page();expect(screen.getByTestId('canonical-editor').textContent).toContain('own');
  });
  it.each(['member','admin','accounting_staff'] as const)('does not show a staffing editor to %s',role=>{fixture.profile.role=role;page();expect(screen.queryByTestId('canonical-editor')).toBeNull();});
  it.each(['pending','revoked','awaiting_head'] as const)('does not show the editor for %s participation',status=>{fixture.state.offices[0].invitation_status=status;page();expect(screen.queryByTestId('canonical-editor')).toBeNull();});
  it('does not show the editor to an observer, inactive or replaced Head',()=>{
    fixture.state.offices[0].relationship_type='observer';const view=page();expect(screen.queryByTestId('canonical-editor')).toBeNull();view.unmount();
    fixture.state.offices[0].relationship_type='lead';fixture.profile.is_active=false;const inactive=page();expect(screen.queryByTestId('canonical-editor')).toBeNull();inactive.unmount();
    fixture.profile.is_active=true;fixture.profile.id='former-head';page();expect(screen.queryByTestId('canonical-editor')).toBeNull();
  });
  it.each(['completed','archived'])('keeps %s project staffing read-only',projectStatus=>{page({projectStatus});expect(screen.queryByTestId('canonical-editor')).toBeNull();});
  it('retains an opened selection read-only after authority loss and drops it across Office contexts',()=>{
    const view=page();expect(screen.getByTestId('canonical-editor').getAttribute('data-disabled')).toBe('');
    fixture.profile.role='member';view.rerender(<ProjectPeoplePage projectTitle="Alpha" projectStatus="planning" governed={false} profiles={[]} organizations={organizations} tasks={[]} onClose={vi.fn()} onOpenTask={vi.fn()}/>);
    expect(screen.getByTestId('canonical-editor').getAttribute('data-disabled')).toContain('Only the appointed Head');
    fixture.profile.org_id='partner';view.rerender(<ProjectPeoplePage projectTitle="Alpha" projectStatus="planning" governed={false} profiles={[]} organizations={organizations} tasks={[]} onClose={vi.fn()} onOpenTask={vi.fn()}/>);
    expect(screen.queryByTestId('canonical-editor')).toBeNull();
  });
  it('keeps governed participation in its existing approval workflow',()=>{page({governed:true});expect(screen.queryByTestId('canonical-editor')).toBeNull();expect(screen.getByText(/approved work plan/)).toBeTruthy();});
  it('distinguishes loading and denied reads from an empty roster and supports retry',()=>{
    fixture.state.loading=true;const loading=page();expect(screen.getByRole('status',{name:'Loading project people'})).toBeTruthy();expect(screen.queryByTestId('canonical-editor')).toBeNull();loading.unmount();
    fixture.state.loading=false;fixture.state.error='Synthetic denied read';page();fireEvent.click(screen.getByRole('button',{name:'Retry project people'}));expect(fixture.state.refresh).toHaveBeenCalledOnce();expect(screen.queryByTestId('canonical-editor')).toBeNull();
  });
});
