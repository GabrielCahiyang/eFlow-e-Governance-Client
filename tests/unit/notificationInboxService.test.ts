// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  calls: [] as unknown[][], rows: [] as Record<string, unknown>[], count: 0,
  error: null as null | { message: string; code?: string }, status: 200,
  listener: undefined as undefined | (() => void),
}));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  from: (table: string) => {
    let head = false;
    const chain: any = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'in', 'gte', 'or', 'update', 'insert']) {
      chain[method] = (...args: any[]) => {
        db.calls.push([table, method, ...args]);
        if (method === 'select') head = Boolean(args[1]?.head);
        return chain;
      };
    }
    chain.then = (resolve: any, reject: any) => Promise.resolve({ data: head ? null : db.rows, count: db.count, error: db.error, status: db.status }).then(resolve, reject);
    return chain;
  },
  channel: () => { const channel = { on: (_event: string, _filter: unknown, listener: () => void) => { db.listener = listener; return channel; }, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));
import { fetchNotificationPage } from '../../src/app/features/notifications/services/notificationInboxService';
import { DEFAULT_NOTIFICATION_FILTERS as filters } from '../../src/app/features/notifications/inboxFilters';
import { getUnreadCount, markAllNotificationsRead, subscribeToNotifications } from '../../src/app/services/notificationService';
import { resetAuthCaches } from '../../src/app/shared/authCacheReset';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number) => ({ id: id(n), user_id: id(90), type: 'assignment', title: 'Your task assignment', read: false, created_at: '2026-11-17T01:02:03.123456+00:00' });
beforeEach(() => { resetAuthCaches(); db.calls = []; db.rows = []; db.count = 0; db.error = null; db.status = 200; vi.useRealTimers(); });
afterEach(() => { vi.useRealTimers(); });
describe('notification pages and delivery', () => {
  it('filters by recipient and uses a 25-row page with one lookahead', async () => {
    db.rows = Array.from({ length: 26 }, (_, n) => row(50 - n));
    const page = await fetchNotificationPage(id(90), filters);
    expect(page.rows).toHaveLength(25);
    expect(page.next).toEqual({ id: id(26), createdAt: row(26).created_at });
    expect(db.calls).toContainEqual(['notifications', 'eq', 'user_id', id(90)]);
    expect(db.calls).toContainEqual(['notifications', 'limit', 26]);
    expect(db.calls).toContainEqual(['notifications', 'order', 'id', { ascending: false }]);
  });
  it('keeps PostgreSQL microseconds and UUID ties in the older-page cursor', async () => {
    await fetchNotificationPage(id(90), { ...filters, unreadOnly: true, category: 'reviews' }, { id: id(25), createdAt: row(25).created_at as string });
    expect(db.calls).toContainEqual(['notifications', 'eq', 'read', false]);
    expect(db.calls.filter(call => call[1] === 'or')).toHaveLength(2);
    expect(db.calls).toContainEqual(['notifications', 'or', `created_at.lt.2026-11-17T01:02:03.123456+00:00,and(created_at.eq.2026-11-17T01:02:03.123456+00:00,id.lt.${id(25)})`]);
  });
  it('applies activity and time filters on the server, including all funding types', async () => {
    await fetchNotificationPage(id(90), { ...filters, category: 'assignments' }, null, '2026-11-10T00:00:00.000Z');
    expect(db.calls).toContainEqual(['notifications', 'in', 'type', ['assignment', 'reassignment']]);
    expect(db.calls).toContainEqual(['notifications', 'gte', 'created_at', '2026-11-10T00:00:00.000Z']);
    await fetchNotificationPage(id(90), { ...filters, category: 'finance' });
    expect(db.calls).toContainEqual(['notifications', 'or', 'type.like.petty_cash_*,type.like.budget_*']);
  });
  it('does not request another page when there is no lookahead', async () => {
    db.rows = [row(1)]; expect((await fetchNotificationPage(id(90), filters)).next).toBeNull();
    db.calls = []; expect(await fetchNotificationPage('', filters)).toEqual({ rows: [], next: null }); expect(db.calls).toEqual([]);
  });
  it('rejects malformed cursors before composing a raw filter', async () => {
    await expect(fetchNotificationPage(id(90), filters, { id: '1),read.eq.true', createdAt: '2026-11-17' })).rejects.toThrow('Reload notifications');
    await expect(fetchNotificationPage(id(90), filters, { id: id(1), createdAt: '2026-11-17T00:00:00Z),read.eq.true' })).rejects.toThrow('Reload notifications');
  });
  it('counts unread records independently of the loaded page and rejects count failures', async () => {
    db.count = 127; expect(await getUnreadCount(id(90))).toBe(127);
    expect(db.calls).toContainEqual(['notifications', 'select', '*', { count: 'exact', head: true }]);
    db.error = { message: 'Permission denied', code: '42501' }; db.status = 403;
    await expect(getUnreadCount(id(90))).rejects.toMatchObject({ code: '42501', status: 403 });
    await expect(fetchNotificationPage(id(90), filters)).rejects.toMatchObject({ code: '42501', status: 403 });
  });
  it('does not claim a failed mark-all update succeeded', async () => {
    db.error = { message: 'Network unavailable' };
    await expect(markAllNotificationsRead(id(90))).rejects.toThrow('couldn’t mark');
    await expect(markAllNotificationsRead('')).rejects.toThrow('Sign in');
  });
  it('keeps the last successful bell list on a failed refresh and recovers on focus', async () => {
    vi.useFakeTimers(); db.rows = [row(1)]; db.count = 127;
    const changed = vi.fn(), status = vi.fn();
    const stop = subscribeToNotifications(id(90), changed, 50, status);
    await vi.advanceTimersByTimeAsync(1);
    expect(changed).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ id: id(1) })]));
    expect(status).toHaveBeenLastCalledWith({ unreadCount: 127, error: '', loading: false });
    db.error = { message: 'Failed to fetch' };
    window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(status.mock.lastCall?.[0].error).toContain('refresh');
    db.error = null; db.rows = [row(2)];
    window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(1);
    expect(changed.mock.lastCall?.[0][0].id).toBe(id(2));
    stop(); const calls = changed.mock.calls.length;
    window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(15001);
    expect(changed).toHaveBeenCalledTimes(calls);
  });
});
