// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectCompletionAvailability } from '../../src/app/features/projects/selectors/projectCompletionAvailability';
import { useProjectCompletionAvailability } from '../../src/app/features/projects/hooks/useProjectCompletionAvailability';
import { projectOverviewWork } from '../../src/app/features/projects/selectors/projectOverview';
import { ProjectParticipants } from '../../src/app/features/projects/components/project-command/ProjectParticipants';
import { ProjectHeader } from '../../src/app/features/projects/components/project-command/ProjectHeader';
import { ProjectUtilities } from '../../src/app/features/projects/components/project-command/ProjectUtilities';
import { ProjectViewTabBar } from '../../src/app/features/projects/components/project-command/ProjectViewTabBar';
import { resolveProjectView, OPTIONAL_VIEWS_CATALOG } from '../../src/app/features/projects/components/project-command/projectViewCatalog';
import { ProjectReadinessPanel } from '../../src/app/features/project-readiness';
import { EflowVibeThemeProvider } from '../../src/app/shared/vibe';
import type { Project } from '../../src/app/features/projects/services/types';
import type { Task, UserProfile } from '../../src/app/types';

const api=vi.hoisted(()=>({completion:vi.fn(),readiness:vi.fn(),review:vi.fn(),activate:vi.fn(),avatar:vi.fn()}));
vi.mock('../../src/app/features/project-access',()=>({fetchAccess:()=>Promise.reject(new Error('R9 unavailable')),previewSelection:()=>Promise.resolve(null),saveSelection:vi.fn(),ProjectAccessPanel:()=>null,RemovalDialog:()=>null,ACCESS_CHANGED_EVENT:'eflow-project-access-changed'}));
vi.mock('../../src/app/features/projects/services/projectLifecycleService',()=>({fetchProjectCompletionReadiness:api.completion}));
vi.mock('../../src/app/features/project-readiness/services/readinessService',()=>({fetchReadiness:api.readiness,reviewProject:api.review,activateReadyProject:api.activate}));
vi.mock('../../src/app/services/userSettingsService',()=>({getProfileAvatarUrl:api.avatar}));
const project:Project={id:'project',orgId:'office',title:'Public service',description:'Improve access to public services',status:'planning',priority:'medium',createdAt:1,updatedAt:1};
const ready={projectId:'project',title:project.title,status:'planning',canComplete:true,blockers:[]};
const blocked={...ready,canComplete:false,blockers:[{kind:'cash',id:'cash',title:'FR-00001',status:'released',detail:'Settle receipts first.'}]};
const reviews={projectId:'project',stage:'Planning',governed:false,canActivate:false,checks:[{key:'structure',label:'Project structure',detail:'Review the plan.',ok:false}]};
function themed(children:React.ReactNode){return <EflowVibeThemeProvider preference="light">{children}</EflowVibeThemeProvider>;}
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();api.completion.mockResolvedValue(ready);api.readiness.mockResolvedValue(reviews);api.review.mockResolvedValue(undefined);api.avatar.mockResolvedValue('https://example.com/signed-avatar');
 vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 1;});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('R4 completion availability',()=>{
 it('fails closed for loading, validation errors, known blockers and denied or closed projects',()=>{
  expect(projectCompletionAvailability('active',true,true,'',ready).enabled).toBe(false);
  expect(projectCompletionAvailability('active',true,false,'Read denied',ready).reason).toContain('Read denied');
  expect(projectCompletionAvailability('active',true,false,'',blocked as typeof ready).reason).toContain('Settle receipts first.');
  expect(projectCompletionAvailability('active',false,false,'',ready).enabled).toBe(false);
  expect(projectCompletionAvailability('completed',true,false,'',ready).enabled).toBe(false);
  expect(projectCompletionAvailability('active',true,false,'',ready).enabled).toBe(true);
 });
 it('clears old checks immediately and discards a late response when the account/project changes',async()=>{
  let finish!:(value:typeof ready)=>void;api.completion.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({...blocked,projectId:'other'});
  const view=renderHook(({id,actor})=>useProjectCompletionAvailability({...project,id},true,actor),{initialProps:{id:'project',actor:'first'}});
  view.rerender({id:'other',actor:'second'});expect(view.result.current.enabled).toBe(false);expect(view.result.current.readiness).toBeUndefined();
  await waitFor(()=>expect(view.result.current.reason).toContain('FR-00001'));
  await act(async()=>finish(ready));expect(view.result.current.readiness?.projectId).toBe('other');
 });
 it('rejects a mismatched project response and retries cleanly',async()=>{
  api.completion.mockResolvedValueOnce({...ready,projectId:'foreign'});
  const view=renderHook(()=>useProjectCompletionAvailability(project,true,'head'));
  await waitFor(()=>expect(view.result.current.reason).toContain('another project'));expect(view.result.current.enabled).toBe(false);
  await act(async()=>view.result.current.refresh());expect(view.result.current.enabled).toBe(true);
 });
 it('keeps completion disabled when the server eligibility value is malformed',async()=>{
  api.completion.mockResolvedValueOnce({...ready,canComplete:'true'});
  const view=renderHook(()=>useProjectCompletionAvailability(project,true,'head'));
  await waitFor(()=>expect(view.result.current.reason).toContain('invalid result'));expect(view.result.current.enabled).toBe(false);
 });
 it('keeps the requirements action usable while completion is blocked',async()=>{
  api.completion.mockResolvedValue(blocked);const complete=vi.fn();
  render(themed(<ProjectUtilities project={project} canManage lifecycle={{complete}} userId="head" contextId="office" authorizedProjectIds={['project']} view="tasks" onOpenOffices={vi.fn()}/>));
  fireEvent.keyDown(screen.getByRole('button',{name:'Project actions'}),{key:'Enter'});
  const action=await screen.findByRole('menuitem',{name:'Mark project complete'});await screen.findByText(/Settle receipts first/);
  expect(action.getAttribute('aria-disabled')).toBe('true');fireEvent.click(action);expect(complete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem',{name:'View completion requirements'}));expect(complete).toHaveBeenCalledOnce();
 });
 it('retains structural review and resolution without a second completion or archive entry',async()=>{
  const onUpdated=vi.fn(),resolve=vi.fn();render(themed(<ProjectReadinessPanel project={project} canManage onUpdated={onUpdated} onResolve={resolve}/>));
  await screen.findByText('Project structure · Needs attention');fireEvent.click(screen.getByRole('button',{name:'Review in Main table'}));expect(resolve).toHaveBeenCalledWith('tasks');
  fireEvent.click(screen.getByRole('button',{name:'Confirm review'}));await waitFor(()=>expect(onUpdated).toHaveBeenCalledOnce());
  expect(api.review).toHaveBeenCalledExactlyOnceWith('project','structure');expect(screen.queryByRole('button',{name:'Close project'})).toBeNull();expect(screen.queryByRole('button',{name:'Archive project'})).toBeNull();
 });
});

describe('R4 retained navigation and identities',()=>{
 it('maps all retired URL identifiers to retained views and removes them from saved tabs and Add view',async()=>{
  const retired={readiness:'overview',workload:'offices',team:'offices',people:'offices',signoff:'offices',evidence:'reviews',decisions:'activity'};
  for(const [id,target] of Object.entries(retired)){expect(resolveProjectView(id)).toBe(target);expect(OPTIONAL_VIEWS_CATALOG.some(view=>view.id===id)).toBe(false);}
  localStorage.setItem('eflow_project_views_project',JSON.stringify([...Object.keys(retired),'overview']));
  render(themed(<ProjectViewTabBar projectId="project" activeTab="readiness" onSelectTab={vi.fn()}/>));
  expect(screen.getByRole('tab',{name:'Overview',exact:true}).getAttribute('aria-selected')).toBe('true');
  await waitFor(()=>expect(localStorage.getItem('eflow_project_views_project')).toBe('["overview"]'));
  fireEvent.click(screen.getByRole('button',{name:'Add view',exact:true}));await screen.findByRole('dialog',{name:'Add project view'});
  for(const label of ['Workload & Team','Readiness & closeout','Approval Status','Evidence Register','Decision History'])expect(screen.queryByRole('button',{name:label,exact:true})).toBeNull();
 });
 it('removes the entire readiness header strip while retaining project identity',()=>{
  const view=render(themed(<ProjectHeader project={project} organizations={[]} participants={<span>Loaded people</span>}/>));
  expect(screen.getByRole('heading',{name:project.title})).toBeTruthy();expect(view.container.querySelector('.eflow-project-identity__context')).toBeNull();expect(screen.queryByText(/Review required checks/)).toBeNull();
 });
 it('uses authenticated avatar URLs, keyboard name targets, initials fallback and an overflow list',async()=>{
  const profiles=Array.from({length:5},(_,i)=>({id:`person-${i}`,full_name:`Person ${i}`,avatar_path:i===0?'private/path.png':null}) as UserProfile);
  render(themed(<ProjectParticipants offices={{offices:[],members:[],loading:false,error:'',refresh:vi.fn()}} profiles={profiles} contributorIds={profiles.map(p=>p.id)} scope="head:office:project"/>));
  await waitFor(()=>expect(screen.getByRole('img',{name:'Person 0'}).querySelector('img')).toBeTruthy());expect(api.avatar).toHaveBeenCalledExactlyOnceWith('private/path.png');
  const avatar=screen.getByRole('img',{name:'Person 0'});expect(avatar.tabIndex).toBe(0);fireEvent.error(avatar.querySelector('img')!);expect(avatar.textContent).toBe('P0');
  const list=screen.getByRole('button',{name:'Show all people'});expect(list.textContent).toContain('+1');fireEvent.click(list);await screen.findByText('Person 4');
 });
});

describe('R4 Overview calendar work',()=>{
 it('separates overdue, due-today/upcoming and unscheduled work without counting cancelled/archived rows',()=>{
  const task=(id:string,dueDate?:string,status='todo',archivedAt?:number)=>({id,dueDate,status,archivedAt}) as Task;
  const work=projectOverviewWork([task('old','2026-10-07'),task('today','2026-10-08'),task('next','2026-10-10'),task('relative','Month 2'),task('cancelled','2026-10-01','cancelled'),task('archived','2026-10-01','todo',1),task('done','2026-10-01','completed')],new Date(2026,9,8,12).getTime());
  expect(work.overdue.map(t=>t.id)).toEqual(['old']);expect(work.upcoming.map(t=>t.id)).toEqual(['today','next']);expect(work.unscheduled).toBe(1);expect(work.counts.find(item=>item.label==='Completed')?.value).toBe(1);
  expect(projectOverviewWork([{...task('legacy'),deadline:'2026-10-07'}],new Date(2026,9,8,12).getTime()).overdue.map(t=>t.id)).toEqual(['legacy']);
 });
});