// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ read: vi.fn(), rpc: vi.fn(), handlers: [] as { table: string; callback: (payload: any) => void }[], remove: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ order: api.read }) }) }),
  rpc: api.rpc,
  channel: () => {
    const channel = { on: (_: string, filter: any, callback: any) => { api.handlers.push({ table: filter.table, callback }); return channel; }, subscribe: () => channel };
    return channel;
  },
  removeChannel: api.remove,
} }));
import { subscribeToProgressUpdates, submitProgressUpdate } from '../../src/app/services/taskDiscussionService';

let stop: (() => void) | undefined;
const flush = async () => { await vi.advanceTimersByTimeAsync(35); };
const blocker = { id: 'update', task_id: 'task', blocker: 'Waiting for equipment', created_at: '2026-11-15T00:00:00Z' };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); api.handlers = [];
  api.read.mockResolvedValue({ data: [blocker], error: null });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); });

it('refreshes confirmed blocker reporting and clearing from published Task rows', async () => {
  const callback = vi.fn(); stop = subscribeToProgressUpdates('task', callback); await flush();
  expect(api.handlers.map(handler => handler.table)).toContain('tasks');
  expect(api.handlers.map(handler => handler.table)).not.toContain('task_progress_updates');
  expect(callback.mock.lastCall?.[0][0].blocker).toBe(blocker.blocker);
  api.read.mockResolvedValue({ data: [{ ...blocker, blocker: null }], error: null });
  api.handlers.find(handler => handler.table === 'tasks')!.callback({ new: { id: 'task' } });
  await flush();
  expect(callback.mock.lastCall?.[0][0].blocker).toBeUndefined();
  const count = api.read.mock.calls.length;
  api.handlers.find(handler => handler.table === 'tasks')!.callback({ new: { id: 'another-task' } });
  await flush(); expect(api.read).toHaveBeenCalledTimes(count);
});

it('preserves the last confirmed state on read failure, even without an error handler', async () => {
  const callback = vi.fn(); stop = subscribeToProgressUpdates('task', callback); await flush();
  api.read.mockResolvedValue({ data: null, error: { message: 'Connection unavailable' } });
  window.dispatchEvent(new Event('focus')); await flush();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback.mock.lastCall?.[0][0].blocker).toBe(blocker.blocker);
});

it('reports read failures and retries on bounded foreground polling, visibility and local events', async () => {
  const callback = vi.fn(), error = vi.fn();
  api.read.mockResolvedValue({ error: { message: 'Read denied' } });
  stop = subscribeToProgressUpdates('task', callback, error); await flush();
  expect(error).toHaveBeenCalledWith('Read denied'); expect(callback).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await vi.advanceTimersByTimeAsync(30000); expect(api.read).toHaveBeenCalledTimes(1);
  api.read.mockResolvedValue({ data: [blocker] });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange')); await flush(); expect(callback).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(15000); expect(callback).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new CustomEvent('eflow:work-updated', { detail: { taskId: 'task' } }));
  await flush(); expect(callback).toHaveBeenCalledTimes(3);
  stop(); stop = undefined; const count = api.read.mock.calls.length;
  await vi.advanceTimersByTimeAsync(30000); window.dispatchEvent(new Event('focus')); await flush();
  expect(api.read).toHaveBeenCalledTimes(count); expect(api.remove).toHaveBeenCalledTimes(1);
});

it('coalesces invalidations during a read and ignores results after unsubscribe', async () => {
  let resolve!: (value: any) => void;
  api.read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const callback = vi.fn(); stop = subscribeToProgressUpdates('task', callback);
  window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus'));
  expect(api.read).toHaveBeenCalledTimes(1);
  resolve({ data: [blocker] }); await flush(); expect(api.read).toHaveBeenCalledTimes(2);
  api.read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  window.dispatchEvent(new Event('focus')); stop(); stop = undefined;
  resolve({ data: [] }); await flush(); expect(callback).toHaveBeenCalledTimes(2);
});

it('publishes a local invalidation only after the progress RPC confirms its write', async () => {
  const event = vi.fn(); window.addEventListener('eflow:work-updated', event);
  const input = { taskId: 'task', author: { id: 'lead', name: 'Lead' }, blockerCategory: 'None' };
  try {
    api.rpc.mockResolvedValueOnce({ error: { message: 'Not authorized' } });
    await expect(submitProgressUpdate(input)).rejects.toThrow('Not authorized'); expect(event).not.toHaveBeenCalled();
    api.rpc.mockResolvedValueOnce({ error: null }); await submitProgressUpdate(input);
    expect(event).toHaveBeenCalledTimes(1); expect(event.mock.calls[0][0].detail).toEqual({ taskId: 'task' });
  } finally { window.removeEventListener('eflow:work-updated', event); }
});
