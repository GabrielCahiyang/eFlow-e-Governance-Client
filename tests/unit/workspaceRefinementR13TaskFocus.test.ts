// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ read: vi.fn().mockResolvedValue({ data: [{ id: 'permitted', title: 'Work', created_at: '2026-10-08' }], error: null, count: 1 }), channel: vi.fn(), remove:vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  from: () => { const query = { select: () => query, is: () => query, order: () => query, range: api.read }; return query; },
  channel: api.channel,
  removeChannel:api.remove,
} }));
import { subscribeToTasks } from '../../src/app/features/tasks/services/taskRealtimeService';
it('revalidates open task feeds on focus and stops reading without subscribers', async () => {
  const channel={on:vi.fn().mockReturnThis(),subscribe:vi.fn().mockReturnThis()};api.channel.mockReturnValue(channel);
  const changes = vi.fn(); const stop = subscribeToTasks(changes);
  try {
    await vi.waitFor(() => expect(changes).toHaveBeenCalledWith([expect.objectContaining({ id: 'permitted' })]));
    api.read.mockResolvedValue({ data: [], error: null, count: 0 });
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith([]));
    expect(api.channel).toHaveBeenCalledOnce();expect(channel.subscribe).toHaveBeenCalledOnce();
  } finally { stop(); }
  expect(api.remove).toHaveBeenCalledWith(channel);
  const count = api.read.mock.calls.length;
  window.dispatchEvent(new Event('focus'));
  await Promise.resolve();
  expect(api.read).toHaveBeenCalledTimes(count);
});
