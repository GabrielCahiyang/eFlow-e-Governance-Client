// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RealtimeClient } from '@supabase/realtime-js';
import type { Project } from '../../src/app/features/projects/services/types';

const api = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn(), read: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: api }));
vi.mock('../../src/app/features/project-readiness/services/readinessService', () => ({
  fetchReadiness: api.read, reviewProject: vi.fn(), activateReadyProject: vi.fn(),
}));
vi.mock('../../src/app/components/ui/useConfirmation', () => ({ useConfirmation: () => ({ dialog: null, confirm: vi.fn() }) }));
vi.mock('../../src/app/shared/navigationGuard', () => ({ useNavigationBlocker: vi.fn() }));
vi.mock('../../src/app/components/ui/button', () => ({ Button: ({ children, variant: _variant, size: _size, pending: _pending, ...props }: any) => <button {...props}>{children}</button> }));
import { ProjectReadinessPanel } from '../../src/app/features/project-readiness/components/ProjectReadinessPanel';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it('keeps concurrent setup/completion panels safe through StrictMode, metadata updates and remounts', async () => {
  const client = new RealtimeClient('wss://example.invalid/socket', { params: { apikey: 'synthetic-test-key' } });
  const callbacks: Array<() => void> = [];
  api.channel.mockImplementation((name: string) => {
    const channel = client.channel(name), realOn = channel.on.bind(channel);
    vi.spyOn(channel, 'on').mockImplementation(((type: any, filter: any, callback: () => void) => {
      callbacks.push(callback);
      return realOn(type, filter, callback);
    }) as typeof channel.on);
    vi.spyOn(channel, 'subscribe').mockImplementation(() => { channel.state = 'joining'; return channel; });
    return channel;
  });
  api.removeChannel.mockResolvedValue('ok'); // Keep old topics until async teardown finishes.
  api.read.mockResolvedValue({ projectId: 'project', checks: [], ready: false, canActivate: false, governed: false, stage: 'Planning' });
  const project: Project = { id: 'project', title: 'Test project', description: '', status: 'planning', priority: 'medium', createdAt: 1, updatedAt: 1 };
  const oldUpdated = vi.fn(), latestUpdated = vi.fn();
  const panels = (updatedAt: number, onUpdated: () => void) => <StrictMode>
    <ProjectReadinessPanel project={{ ...project, updatedAt }} canManage setup onUpdated={onUpdated} />
    <ProjectReadinessPanel project={{ ...project, updatedAt }} canManage onUpdated={onUpdated} />
  </StrictMode>;
  const view = render(panels(1, oldUpdated));
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(4));
  const channels = api.channel.mock.calls.length;
  expect(new Set(api.channel.mock.calls.map(([topic]) => topic)).size).toBe(channels);
  view.rerender(panels(2, latestUpdated));
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(6));
  expect(api.channel).toHaveBeenCalledTimes(channels);
  await act(async () => { callbacks.forEach(callback => callback()); await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(oldUpdated).not.toHaveBeenCalled();
  expect(latestUpdated).toHaveBeenCalledTimes(2);
  view.unmount();
  const reads = api.read.mock.calls.length;
  await act(async () => callbacks.forEach(callback => callback()));
  expect(api.read).toHaveBeenCalledTimes(reads);
  expect(api.removeChannel).toHaveBeenCalledTimes(channels);
  const remount = render(panels(3, latestUpdated));
  await waitFor(() => expect(api.read.mock.calls.length).toBeGreaterThan(reads));
  expect(new Set(api.channel.mock.calls.map(([topic]) => topic)).size).toBe(api.channel.mock.calls.length);
  remount.unmount();
});
