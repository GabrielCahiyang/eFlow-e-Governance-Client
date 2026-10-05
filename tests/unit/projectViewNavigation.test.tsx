// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectViewTabBar } from '../../src/app/features/projects/components/project-command/ProjectViewTabBar';
import type { ProjectCommandTab } from '../../src/app/features/projects/components/project-command/types';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Views({ initial = 'tasks' }: { initial?: ProjectCommandTab }) {
  const [activeTab, onSelectTab] = useState(initial);
  return <ProjectViewTabBar projectId="project-a" activeTab={activeTab} onSelectTab={onSelectTab} />;
}

describe('project view navigation', () => {
  it('exposes and persists a Board view entered through a shortcut or direct URL', async () => {
    render(<Views initial="board" />);
    expect(screen.getByRole('tab', { name: 'Board', exact: true }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Main table' }).getAttribute('aria-selected')).toBe('false');
    await waitFor(() => expect(JSON.parse(localStorage.getItem('eflow_project_views_project-a')!)).toEqual(['board']));
    fireEvent.click(screen.getByRole('tab', { name: 'Main table' }));
    expect(screen.getByRole('tab', { name: 'Main table' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders Add view outside a clipping ancestor and respects conditional views', async () => {
    const { container } = render(<div style={{ overflow: 'hidden', height: 40 }}><Views /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Add view', exact: true }));
    const menu = await screen.findByRole('dialog', { name: 'Add project view' });
    expect(container.contains(menu)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Proposal Context', exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Budget Overview', exact: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Board', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('tab', { name: 'Board', exact: true }).getAttribute('aria-selected')).toBe('true');
  });

  it('closes the view picker with Escape', async () => {
    render(<Views />);
    fireEvent.click(screen.getByRole('button', { name: 'Add view', exact: true }));
    fireEvent.keyDown(await screen.findByRole('dialog', { name: 'Add project view' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Add view', exact: true }).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps an active overflow view selected and exposes the displaced view in More', async () => {
    localStorage.setItem('eflow_project_views_project-a', JSON.stringify(['board', 'offices', 'reports', 'activity', 'reviews', 'dashboard']));
    render(<Views initial="dashboard" />);
    expect(screen.getByRole('tab', { name: 'Project Dashboard', exact: true }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'More (2)' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Activity', exact: true }));
    expect(screen.getByRole('tab', { name: 'Activity', exact: true }).getAttribute('aria-selected')).toBe('true');
  });

  it('returns to Main table when the only optional view is closed with the keyboard', async () => {
    render(<Views initial="board" />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close Board', exact: true }), { key: 'Enter' });
    expect(screen.queryByRole('tab', { name: 'Board', exact: true })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Main table' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(localStorage.getItem('eflow_project_views_project-a')).toBe('[]'));
  });

  it('keeps saved views scoped to their project when the project changes', async () => {
    localStorage.setItem('eflow_project_views_project-a', '["board"]');
    localStorage.setItem('eflow_project_views_project-b', '["offices"]');
    const onSelectTab = vi.fn();
    const { rerender } = render(<ProjectViewTabBar projectId="project-a" activeTab="tasks" onSelectTab={onSelectTab} />);
    expect(screen.getByRole('tab', { name: 'Board', exact: true })).toBeTruthy();
    rerender(<ProjectViewTabBar projectId="project-b" activeTab="tasks" onSelectTab={onSelectTab} />);
    expect(screen.queryByRole('tab', { name: 'Board', exact: true })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Offices', exact: true })).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem('eflow_project_views_project-a')).toBe('["board"]'));
  });
});
