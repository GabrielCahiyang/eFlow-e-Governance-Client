// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductivitySidebar } from '../../src/app/features/app-shell/components/ProductivitySidebar';
import { EflowVibeThemeProvider } from '../../src/app/shared/vibe';
import { buildShellNavigation, getDefaultSection, readNavigationLocation } from '../../src/app/features/navigation';
import { parseWorkspacePanelPreference, useWorkspacePanelPreference } from '../../src/app/features/app-shell/workspacePanelPreferences';
import { useNavigationFavorites } from '../../src/app/shared/navigationPreferences';
import { resolveNotificationDestination } from '../../src/app/features/notifications/navigation';
import { readProjectPlanningView, useProjectPlanningLocation } from '../../src/app/features/projects/hooks/useProjectPlanningLocation';

Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
const projects = [{id:'a',title:'Office project',status:'active'}, {id:'b',title:'Shared project',status:'planning'}, {id:'c',title:'Past project',status:'archived'}];
const items = buildShellNavigation({role:'head',can:()=>true});
function sidebar(activeSection = 'tasks', userId = 'head', workspaceId = 'office', navigationItems = items) {
  return <EflowVibeThemeProvider preference="light"><ProductivitySidebar role="head" activeSection={activeSection} activePage={activeSection === 'reports' ? 'Reports' : 'Task Board'}
    navigationItems={navigationItems} onPageSelect={vi.fn()} userId={userId} workspaceId={workspaceId} workspaceName="LEDIPO" projects={projects} /></EflowVibeThemeProvider>;
}

describe('R2 persistent workspace navigation', () => {
  it('retains expanded Office tools and project sections across Tasks and Reports without removed entries', () => {
    const view = render(sidebar());
    const office = screen.getByRole('button', {name:'Office tools',exact:true});
    expect(office.getAttribute('aria-expanded')).toBe('true');
    expect(within(screen.getByRole('region',{name:'Projects',exact:true})).getByRole('button',{name:'Shared project'})).toBeTruthy();
    view.rerender(sidebar('reports'));
    expect(screen.getByRole('button',{name:'Reports',exact:true}).getAttribute('aria-current')).toBe('page');
    expect(office.getAttribute('aria-expanded')).toBe('true');
    for (const label of ['Home','Search','Planning','Drafts','Waiting for approval','Team Members']) expect(screen.queryByRole('button',{name:label,exact:true})).toBeNull();
    expect(screen.getByRole('button',{name:'LEDIPO Workspace'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'Search workspace'})).toBeTruthy();
  });
  it('collapses/restores without unmounting the global rail and persists the choice', async () => {
    const view = render(sidebar());
    fireEvent.click(screen.getByRole('button',{name:'Collapse workspace sidebar'}));
    expect(screen.queryByRole('navigation',{name:'Workspace destinations'})).toBeNull();
    expect(screen.getByRole('navigation',{name:'Global navigation'})).toBeTruthy();
    view.unmount(); render(sidebar());
    await screen.findByRole('button',{name:'Restore workspace sidebar'});
    fireEvent.click(screen.getByRole('button',{name:'Restore workspace sidebar'}));
    expect(screen.getByRole('button',{name:'Office tools'}).getAttribute('aria-expanded')).toBe('true');
  });
  it('never shows project records or project section choices to an account without project navigation', () => {
    render(sidebar('users','admin','office',buildShellNavigation({role:'admin',can:()=>true})));
    expect(screen.queryByText('Shared project')).toBeNull();
    expect(screen.queryByRole('region',{name:'Projects',exact:true})).toBeNull();
  });
});
describe('R2 scoped preferences and compatibility', () => {
  it('gives saved plans and proposal review a refreshable context without a stale selected project', () => {
    window.history.replaceState({}, '', '/projects?page=Projects&project=a&view=offices');
    const onView=vi.fn();
    const view=renderHook(()=>useProjectPlanningLocation(onView));
    act(()=>view.result.current('drafts'));
    expect(window.location.search).not.toContain('project=');
    expect(readProjectPlanningView()).toBe('drafts');
    expect(onView).toHaveBeenLastCalledWith('drafts');
    act(()=>view.result.current('signoff'));
    expect(readProjectPlanningView()).toBe('signoff');
    expect(onView).toHaveBeenLastCalledWith('signoff');
    view.unmount(); renderHook(()=>useProjectPlanningLocation(onView));
    expect(onView).toHaveBeenLastCalledWith('signoff');
  });
  it('migrates supported disclosures and appends a restored section after existing ones without losing subitems', () => {
    localStorage.setItem('eflow:navigation:v1:user:office:disclosures',JSON.stringify(['planning','people','projects']));
    const view=renderHook(({user,office})=>useWorkspacePanelPreference(user,office),{initialProps:{user:'user',office:'office'}});
    expect(view.result.current.value.closed).toEqual(['projects']);
    act(()=>view.result.current.toggleSection('favorites'));
    act(()=>view.result.current.toggleSection('favorites'));
    expect(view.result.current.value.sections).toEqual(['office-tools','projects','archived','favorites']);
    expect(view.result.current.value.closed).toEqual(['projects']);
    act(()=>view.result.current.setCollapsed(true));
    view.rerender({user:'other',office:'office'}); expect(view.result.current.value.collapsed).toBe(false);
    view.rerender({user:'user',office:'elsewhere'}); expect(view.result.current.value.closed).toEqual([]);
    view.rerender({user:'user',office:'office'}); expect(view.result.current.value.collapsed).toBe(true);
  });
  it('validates version, section identifiers and malformed storage rather than reintroducing retired sections', () => {
    expect(parseWorkspacePanelPreference({version:2,sections:['projects','people','projects'],closed:['planning','projects'],collapsed:'true'})).toEqual({version:2,sections:['projects'],closed:['projects'],collapsed:false});
    expect(parseWorkspacePanelPreference(null).sections).toContain('office-tools');
    expect(parseWorkspacePanelPreference({version:2,sections:[],closed:[]}).sections).toEqual([]);
  });
  it('retains saved favorites during loading, then prunes revoked project IDs', async () => {
    localStorage.setItem('eflow:navigation:v1:user:office',JSON.stringify(['a','revoked']));
    const view=renderHook(({loaded,ids})=>useNavigationFavorites('user','office',ids,loaded),{initialProps:{loaded:false,ids:[] as string[]}});
    expect(JSON.parse(localStorage.getItem('eflow:navigation:v1:user:office')!)).toEqual(['a','revoked']);
    view.rerender({loaded:true,ids:['a']});
    await waitFor(()=>expect([...view.result.current.favorites]).toEqual(['a']));
    expect(JSON.parse(localStorage.getItem('eflow:navigation:v1:user:office')!)).toEqual(['a']);
  });
  it.each(['head','member','accounting_staff','admin'])('maps retired Home/Search and command URLs to the %s landing', role => {
    const initial = (section:string)=>section;
    for (const path of ['/home','/search','/command-center']) {
      window.history.replaceState({},'',path);
      expect(readNavigationLocation(role,initial).section).toBe(path==='/home'&&role!=='admin'?'dashboard':getDefaultSection(role));
    }
    expect(getDefaultSection(role)).toBe({head:'dashboard',member:'personal_work',accounting_staff:'accounting_overview',admin:'users'}[role]);
  });
  it('keeps Accounting operational notification IDs while denying an Admin project handoff', () => {
    const notification = {id:'n',type:'task_assigned',title:'Task assigned',message:'',taskId:'t',projectId:'p'} as Parameters<typeof resolveNotificationDestination>[0];
    expect(resolveNotificationDestination(notification,'accounting_staff')).toMatchObject({section:'projects',intent:{taskId:'t',projectId:'p'}});
    expect(resolveNotificationDestination(notification,'admin')).toBeNull();
    expect(resolveNotificationDestination({...notification,projectId:undefined},'accounting_staff')).toMatchObject({section:'tasks',page:'My Tasks',intent:{taskId:'t'}});
  });
});
