// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildShellNavigation, getRoleNavigationCandidates, isRoleNavigationItemVisible, canOpenNavigationSection, searchNavigation, getAuthorizedSupportPages, resolveSupportPage, useRoleNavigationState } from '../../src/app/features/navigation';
import { installNavigationConfirmation, requestNavigation, useNavigationBlocker } from '../../src/app/shared/navigationGuard';
import { useNavigationFavorites, clearNavigationPreferences } from '../../src/app/shared/navigationPreferences';
const initial = (section: string) => ({dashboard:'Dashboard', projects:'Projects', tasks:'My Tasks', settings:'Profile'}[section]);
afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

describe('Phase 9 discovery compatibility', () => {
  it.each(['admin', 'head', 'member', 'accounting_staff'])('maps every authorized %s destination to its existing target', role => {
    const can = () => true;
    const expected = getRoleNavigationCandidates(role).filter(item => isRoleNavigationItemVisible(item, true, role) && canOpenNavigationSection(role, item.id, can, Boolean(item.requiresLeadership)));
    const items = buildShellNavigation({ role, can, hasLeadingWork: true });
    expect(items.map(item => item.id)).toEqual(expected.map(item => item.id));
    expect(items.every(item => item.pages.length > 0)).toBe(true);
    if (role === 'admin') { expect(items.map(item => item.group)).toEqual(['inbox','admin-center']); expect(items.some(item => item.id === 'projects')).toBe(false); }
    if (role === 'head') expect(items.find(item => item.id === 'tasks')).toMatchObject({group:'workspaces', pages:[{label:'Task Board'}]});
    if (role === 'accounting_staff') { expect(items.filter(item => item.group === 'accounting')).toHaveLength(5); expect(items.find(item => item.id === 'tasks')?.pages).toEqual([{label:'My Tasks'}]); }
  });
  it('keeps contextual leadership conditional and does not infer Head authority', () => {
    const can = () => false;
    expect(buildShellNavigation({role:'head',can,hasLeadingWork:false}).some(item => item.id === 'leading')).toBe(false);
    const leader = buildShellNavigation({role:'member',can,hasLeadingWork:true});
    expect(leader.map(item => item.id)).toEqual(['personal_work','inbox','leading','reviews']);
    expect(leader.some(item => ['team','identity'].includes(item.id))).toBe(false);
  });
  it.each(['unknown', 'superadmin', 'employee', 'task_lead'])('does not invent an account navigation for %s', role => {
    expect(buildShellNavigation({role,can:() => true})).toEqual([]);
  });
  it('matches support page discovery to explicit grants while keeping access management Admin-only', () => {
    const can = (permission: string) => permission === 'navigation.audit' || permission === 'navigation.user_management';
    expect(getAuthorizedSupportPages('member',can).map(page => page.label)).toEqual(['All Users','Account Audit']);
    expect(buildShellNavigation({role:'member',can}).find(item => item.id === 'audit')?.pages).toEqual([{label:'Account Audit'}]);
    expect(resolveSupportPage('org_tree','Org Structure')).toBe('Office Structure');
    expect(resolveSupportPage('users','Backup & Export')).toBe('Backup & Export');
  });
  it('searches authorized loaded content and never exposes projects to Admin or a denied account', () => {
    const projects = [{id:'shared',title:'Partner Office project'}];
    const member = buildShellNavigation({role:'member',can:p => p === 'navigation.projects'});
    expect(searchNavigation('partner',member,projects)).toEqual([expect.objectContaining({section:'projects',projectId:'shared'})]);
    expect(searchNavigation('partner',buildShellNavigation({role:'admin',can:() => true}),projects)).toEqual([]);
    expect(searchNavigation('partner',buildShellNavigation({role:'member',can:() => false}),projects)).toEqual([]);
    expect(searchNavigation('',member,projects)).toEqual([]);
  });
});

describe('registered dirty navigation', () => {
  it('prompts only for dirty forms and preserves state on Keep editing', async () => {
    const discard = vi.fn(), action = vi.fn(), confirm = vi.fn().mockResolvedValue(false);
    const uninstall = installNavigationConfirmation(confirm);
    const view = renderHook(({dirty}) => useNavigationBlocker({label:'Editor',dirty,onDiscard:discard}), {initialProps:{dirty:false}});
    expect(await requestNavigation(action)).toBe(true); expect(confirm).not.toHaveBeenCalled(); action.mockClear();
    view.rerender({dirty:true}); expect(await requestNavigation(action)).toBe(false);
    expect(action).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled(); expect(confirm).toHaveBeenCalledWith(['Editor']); uninstall();
  });
  it('discards and navigates once while repeated clicks cannot start another decision', async () => {
    let resolve!: (value: boolean) => void;
    const uninstall = installNavigationConfirmation(() => new Promise<boolean>(done => {resolve=done;}));
    const discard = vi.fn(), action = vi.fn();
    renderHook(() => useNavigationBlocker({label:'Editor',dirty:true,onDiscard:discard}));
    const decision = requestNavigation(action); expect(await requestNavigation(action)).toBe(false);
    resolve(true); expect(await decision).toBe(true); expect(discard).toHaveBeenCalledOnce(); expect(action).toHaveBeenCalledOnce(); uninstall();
  });
  it('blocks a pending save and guards unload without opening a discard prompt', async () => {
    const confirm=vi.fn(), action=vi.fn(); const uninstall=installNavigationConfirmation(confirm);
    renderHook(() => useNavigationBlocker({label:'Editor',dirty:true,pending:true,onDiscard:vi.fn()}));
    const unload = new Event('beforeunload',{cancelable:true}); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    expect(await requestNavigation(action)).toBe(false); expect(confirm).not.toHaveBeenCalled(); uninstall();
  });
  it('keeps the editor URL on canceled back, then replays accepted back without dropping forward history', async () => {
    window.history.replaceState({}, '', '/tasks?page=My+Tasks');
    const view = renderHook(() => useRoleNavigationState('member',initial));
    act(() => view.result.current.selectPage('settings','Security'));
    let dirty = true; let accept = false;
    const uninstall = installNavigationConfirmation(async () => accept);
    const blocker = renderHook(() => useNavigationBlocker({label:'Security',dirty,onDiscard:() => {dirty=false;}}));
    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe('/settings'));
    await new Promise(resolve => setTimeout(resolve,30));
    expect(view.result.current.activeSection).toBe('settings');
    accept=true; act(() => window.history.back());
    await waitFor(() => expect(view.result.current.activeSection).toBe('tasks'));
    blocker.unmount(); act(() => window.history.forward());
    await waitFor(() => expect(view.result.current.activeSection).toBe('settings')); uninstall();
  });
});

describe('local navigation preferences', () => {
  it('scopes favorites by account/context and prunes revoked IDs without caching project records', async () => {
    localStorage.setItem('eflow:navigation:v1:user:office',JSON.stringify(['shared','revoked']));
    const view=renderHook(({user,ids}) => useNavigationFavorites(user,'office',ids),{initialProps:{user:'user',ids:['shared']}});
    await waitFor(() => expect([...view.result.current.favorites]).toEqual(['shared']));
    expect(JSON.parse(localStorage.getItem('eflow:navigation:v1:user:office')!)).toEqual(['shared']);
    view.rerender({user:'other',ids:['shared']}); await waitFor(() => expect(view.result.current.favorites.size).toBe(0));
    clearNavigationPreferences('user'); expect(localStorage.getItem('eflow:navigation:v1:user:office')).toBeNull();
  });
});
