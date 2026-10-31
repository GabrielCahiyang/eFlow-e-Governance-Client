import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient } from '@supabase/realtime-js';

// Use the installed SDK's real topic registry and callback lifecycle checks.
// Only transport subscription/teardown is intercepted; no socket is opened.
const api = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: api }));
import { subscribeProjectChecks } from '../../src/app/features/project-readiness/services/readinessSubscription';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('readiness subscription ownership', () => {
  it('reproduces the fixed-topic SDK failure and permits simultaneous independent consumers', () => {
    const client = new RealtimeClient('wss://example.invalid/socket', { params: { apikey: 'synthetic-test-key' } });
    const old = client.channel('readiness-project');
    old.state = 'joined';
    expect(() => client.channel('readiness-project').on('postgres_changes', { event: '*', schema: 'public' }, () => {})).toThrow(/after.*subscribe/);

    const callbacks: Array<() => void> = [];
    api.channel.mockImplementation((name: string) => {
      const channel = client.channel(name);
      const realOn = channel.on.bind(channel);
      vi.spyOn(channel, 'on').mockImplementation(((type: any, filter: any, callback: () => void) => {
        callbacks.push(callback);
        return realOn(type, filter, callback);
      }) as typeof channel.on);
      vi.spyOn(channel, 'subscribe').mockImplementation(() => { channel.state = 'joining'; return channel; });
      return channel;
    });
    // Deliberately keep removed channels registered to reproduce slow teardown.
    api.removeChannel.mockResolvedValue('ok');
    const first = vi.fn(), second = vi.fn(), replacement = vi.fn();
    const stopFirst = subscribeProjectChecks('project', first);
    const stopSecond = subscribeProjectChecks('project', second);
    stopFirst();
    const stopReplacement = subscribeProjectChecks('project', replacement);
    expect(new Set(api.channel.mock.calls.map(([name]) => name)).size).toBe(3);
    callbacks.forEach(callback => callback());
    vi.advanceTimersByTime(150);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(replacement).toHaveBeenCalledOnce();
    const channel = api.channel.mock.results[2].value;
    expect(channel.bindings.postgres_changes.map((binding: any) => binding.filter.table)).toEqual(expect.arrayContaining([
      'projects', 'tasks', 'project_readiness_reviews', 'project_offices', 'project_office_members',
      'subtasks', 'petty_cash_requests', 'petty_cash_liquidations', 'work_budget_allocations',
    ]));
    expect(channel.bindings.postgres_changes.find((binding: any) => binding.filter.table === 'tasks').filter.filter).toBe('linked_project_id=eq.project');
    vi.advanceTimersByTime(15_000);
    expect(second).toHaveBeenCalledTimes(2);
    expect(replacement).toHaveBeenCalledTimes(2);
    channel.subscribe.mock.calls[0][0]('SUBSCRIBED');
    vi.advanceTimersByTime(150);
    expect(replacement).toHaveBeenCalledTimes(3);
    stopSecond(); stopReplacement();
    expect(api.removeChannel).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(60_000);
    expect(replacement).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});
