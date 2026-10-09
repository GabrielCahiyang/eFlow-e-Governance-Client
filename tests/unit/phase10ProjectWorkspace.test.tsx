// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectSettingsDialog } from '../../src/app/features/projects/components/project-command/ProjectSettingsDialog';
import { ProjectHeader } from '../../src/app/features/projects/components/project-command/ProjectHeader';
import { ProjectParticipants } from '../../src/app/features/projects/components/project-command/ProjectParticipants';
import { resolveProjectView, PERMANENT_TABS, OPTIONAL_VIEWS_CATALOG } from '../../src/app/features/projects/components/project-command/projectViewCatalog';
import { installNavigationConfirmation, requestNavigation } from '../../src/app/shared/navigationGuard';
import { useNavigationFavorites } from '../../src/app/shared/navigationPreferences';
import type { Project } from '../../src/app/features/projects/services/types';
const api = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('../../src/app/features/projects/services/projectMutationService', () => ({ updateProject: api.update }));
const project: Project = { id:'project-a',title:'Office project',description:'Existing details',status:'planning',priority:'medium',createdAt:1,updatedAt:1 };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.update.mockResolvedValue(undefined); });
afterEach(cleanup);
describe('Phase 10 project workspace', () => {
  it('keeps six core views and resolves every legacy view alias without dropping tools', () => {
    expect(PERMANENT_TABS.map(view=>view.id)).toEqual(['tasks','board','gantt','calendar','dashboard','offices']);
    for(const [alias,canonical] of Object.entries({plan:'timeline',delivery:'timeline',work:'tasks',people:'offices',team:'offices'})) expect(resolveProjectView(alias)).toBe(canonical);
    for(const view of [...PERMANENT_TABS,...OPTIONAL_VIEWS_CATALOG]) expect(resolveProjectView(view.id)).toBe(view.id);
    for(const value of ['not-a-view', 'constructor', '__proto__', 'toString']) expect(resolveProjectView(value)).toBeNull();
  });
  it('keeps missing identity readable and closed title editing disabled', () => {
    render(<ProjectHeader project={{...project,status:'archived'}} organizations={[]} profiles={[]} editable onTitleChange={api.update} />);
    expect(screen.getByText('Office not set')).toBeTruthy();
    expect((screen.getByRole('button',{name:'Edit project name'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText('Project lifecycle: Archived')).toBeTruthy();
  });
  it('retries only the participant operation instead of claiming an empty participant list', () => {
    const refresh=vi.fn(); render(<ProjectParticipants offices={{offices:[],members:[],loading:false,error:'Office request failed',refresh}} profiles={[]} contributorIds={[]} />);
    expect(screen.getByRole('alert').textContent).toContain('Office request failed'); fireEvent.click(screen.getByRole('button',{name:'Retry'})); expect(refresh).toHaveBeenCalledOnce();
  });
  it('retains failed settings, retries once and marks only the saved draft clean', async () => {
    api.update.mockRejectedValueOnce({message:'Synthetic server denial'});
    render(<ProjectSettingsDialog project={project} canManage onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Description'),{target:{value:'Retained revision'}});
    fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
    await screen.findByText(/Synthetic server denial/); expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Retained revision');
    fireEvent.click(screen.getByRole('button',{name:'Save changes'})); await screen.findByText('Project settings saved.');
    expect(api.update).toHaveBeenCalledTimes(2); expect(api.update).toHaveBeenLastCalledWith('project-a',expect.objectContaining({description:'Retained revision'}));
    const navigation=vi.fn(); expect(await requestNavigation(navigation)).toBe(true); expect(navigation).toHaveBeenCalledOnce();
  });
  it('keeps settings on canceled navigation, and discards without a save', async () => {
    const close=vi.fn(), navigate=vi.fn(); let accept=false; const uninstall=installNavigationConfirmation(async()=>accept);
    render(<ProjectSettingsDialog project={project} canManage onClose={close} />);
    fireEvent.change(screen.getByLabelText('Description'),{target:{value:'Unsaved'}});
    await act(async()=>{expect(await requestNavigation(navigate)).toBe(false);});
    expect(close).not.toHaveBeenCalled(); accept=true;
    await act(async()=>{expect(await requestNavigation(navigate)).toBe(true);});
    expect(close).toHaveBeenCalledOnce(); expect(navigate).toHaveBeenCalledOnce(); expect(api.update).not.toHaveBeenCalled(); uninstall();
  });
  it('denies metadata saves for read-only and closed contexts', () => {
    const view=render(<ProjectSettingsDialog project={project} canManage={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('button',{name:'Save changes'})).toBeNull();
    view.rerender(<ProjectSettingsDialog project={{...project,status:'completed'}} canManage onClose={vi.fn()} />);
    expect(screen.queryByRole('button',{name:'Save changes'})).toBeNull(); expect(screen.getByText('Closed project')).toBeTruthy();
  });
  it('validates dates and blocks switching or duplicate saves while a request is pending', async () => {
    let finish!: () => void;
    api.update.mockImplementationOnce(() => new Promise<void>(resolve => { finish=resolve; }));
    render(<ProjectSettingsDialog project={project} canManage onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Start date'),{target:{value:'2026-10-10'}});
    fireEvent.change(screen.getByLabelText('Target date'),{target:{value:'2026-10-01'}});
    fireEvent.click(screen.getByRole('button',{name:'Save changes'})); expect(api.update).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Target date').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText('Target date'),{target:{value:'2026-10-12'}});
    fireEvent.click(screen.getByRole('button',{name:'Save changes'})); fireEvent.submit(screen.getByRole('button',{name:'Save changes'}).closest('form')!);
    expect(api.update).toHaveBeenCalledOnce(); expect(await requestNavigation(vi.fn())).toBe(false);
    await act(async()=>finish()); await screen.findByText('Project settings saved.');
  });
  it('synchronizes header and context favorites without caching project records', async () => {
    const first=renderHook(()=>useNavigationFavorites('user','office',['project-a','project-b']));
    const second=renderHook(()=>useNavigationFavorites('user','office',['project-a','project-b']));
    await waitFor(()=>expect(first.result.current.favorites.size).toBe(0));
    act(()=>first.result.current.toggle('project-b'));
    await waitFor(()=>expect(second.result.current.favorites.has('project-b')).toBe(true));
    act(()=>second.result.current.toggle('project-a'));
    await waitFor(()=>expect([...first.result.current.favorites]).toEqual(['project-b','project-a']));
  });
});
