// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildShellNavigation, useRoleNavigationState } from '../../src/app/features/navigation';
import { readContextDestination } from '../../src/app/features/app-shell/useContextDestinations';
import { writeWorkspaceLocation } from '../../src/app/features/workspaces/workspaceLocation';

afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
const initial = (section: string) => ({ reviews: 'For Review', budget: 'Office Budget', projects: 'Projects', dashboard: 'Workspace Overview' })[section];

describe('P1 existing navigation owner parity', () => {
  it('retains the fiscal query on the legacy Office Budget alias', () => {
    window.history.replaceState({}, '', '/department-budget?page=Office+Budget&view=vouchers&fy=2024');
    renderHook(() => useRoleNavigationState('head', initial));
    expect(window.location.pathname).toBe('/office-budget');
    expect(new URLSearchParams(window.location.search).get('view')).toBe('vouchers');
    expect(new URLSearchParams(window.location.search).get('fy')).toBe('2024');
  });
  it('preserves old My Work bucket filters when normalizing the destination', () => {
    window.history.replaceState({}, '', '/my-work?page=Due+today');
    renderHook(() => useRoleNavigationState('member', initial));
    expect(new URLSearchParams(window.location.search).get('page')).toBe('Assigned work');
    expect(new URLSearchParams(window.location.search).get('date')).toBe('Today');
  });
  it('keeps an explicitly verified workspace authoritative over stored display parameters', () => {
    window.history.replaceState({}, '', '/my-work?page=History&q=old&date=Today&fy=2025');
    writeWorkspaceLocation('verified-office', true, 'push', { pathname: '/office-budget', page: 'Office Budget', parameters: { workspace: 'unverified-office', view: 'annual', fy: '2024', q: 'foreign', task: 'private' } });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('workspace')).toBe('verified-office'); expect(params.get('view')).toBe('annual'); expect(params.get('fy')).toBe('2024');
    expect(params.has('q')).toBe(false); expect(params.has('date')).toBe(false); expect(params.has('task')).toBe(false);
  });
  it('preserves a review workflow at startup, on history and on accepted same-route events', async () => {
    window.history.replaceState({}, '', '/reviews?page=For+Review&view=subtasks');
    const { result } = renderHook(() => useRoleNavigationState('head', initial));
    expect(new URLSearchParams(window.location.search).get('view')).toBe('subtasks');
    await act(async () => { await result.current.selectPageAsync('reviews', 'For Review', { parameters: { view: 'workplans' } }); });
    expect(new URLSearchParams(window.location.search).get('view')).toBe('workplans');
  });

  it.each([
    ['head', 'inbox', 'reviews', 'For Review', { view: 'governance', fy: '2025', project: 'foreign', token: 'secret' }, { view: 'governance' }],
    ['head', 'workspaces', 'budget', 'Office Budget', { view: 'journal', fy: '2025', q: 'foreign' }, { view: 'journal', fy: '2025' }],
    ['accounting_staff', 'accounting', 'accounting_budgets', 'Office Budget Ledgers', { view: 'vouchers', fy: '2024', date: 'Today' }, { view: 'vouchers', fy: '2024' }],
    ['accounting_staff', 'accounting', 'accounting_journal', 'General Journal', { view: 'vouchers', fy: '2024' }, { fy: '2024' }],
    ['head', 'workspaces', 'projects', 'Projects', { project: 'p', view: 'offices', fy: '2025' }, { project: 'p', view: 'offices' }],
    ['member', 'my-work', 'personal_work', 'History', { date: 'Today', recent: '1', q: 'kept', view: 'tasks', fy: '2025' }, { date: 'Today', recent: '1', q: 'kept' }],
  ] as const)('restores only %s %s destination display state', (role, group, section, page, parameters, expected) => {
    const items = buildShellNavigation({ role, can: () => true, hasLeadingWork: true });
    localStorage.setItem(`eflow:context:v1:actor:${group}`, JSON.stringify({ version: 1, section, page, parameters }));
    expect(readContextDestination('actor', group, role, items)?.parameters).toEqual(expected);
    expect(readContextDestination('other-actor', group, role, items)).toBeUndefined();
    expect(readContextDestination('actor', group, role, items.filter(item => item.id !== section))).toBeUndefined();
  });

  it('rejects invalid workflow and fiscal values without persisting record identities', () => {
    const items = buildShellNavigation({ role: 'head', can: () => true });
    localStorage.setItem('eflow:context:v1:actor:workspaces', JSON.stringify({ version: 1, section: 'budget', page: 'Office Budget', parameters: { fy: '2201', view: 'members', account: 'pii', task: 'record', token: 'secret' } }));
    expect(readContextDestination('actor', 'workspaces', 'head', items)?.parameters).toEqual({});
  });
});
