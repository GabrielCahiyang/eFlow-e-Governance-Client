import { useEffect, useRef, useState } from 'react';
import { getUnreadCount, subscribeNotificationChanges, type Notification } from '../../../services/notificationService';
import { isDocumentVisible, subscribeQueryDomain } from '../../../shared/queryCache';
import { isQueryAccessDenied } from '../../../shared/queryAccess';
import type { NotificationInboxFilters } from '../inboxFilters';
import { fetchNotificationPage, type NotificationCursor } from '../services/notificationInboxService';

interface InboxState {
  scope: string; rows: Notification[]; unreadCount: number | null;
  loading: boolean; refreshing: boolean; loadingMore: boolean;
  next: NotificationCursor | null; error: string;
}
const empty = (scope: string, loading: boolean): InboxState => ({
  scope, rows: [], unreadCount: null, loading, refreshing: false, loadingMore: false, next: null, error: '',
});

/** Refresh every loaded page, preserving position and rejecting old account/filter results. */
export function useNotificationInbox(userId: string | undefined, filters: NotificationInboxFilters) {
  const scope = JSON.stringify([userId, filters.category, filters.unreadOnly, filters.period]);
  const [state, setState] = useState(() => empty(scope, Boolean(userId)));
  const controls = useRef({ refresh: () => {}, more: () => {} });

  useEffect(() => {
    let active = true, busy = false, queued = false, pages = 1;
    let current = empty(scope, Boolean(userId));
    const since = filters.period === 'all' ? undefined
      : new Date(Date.now() - Number(filters.period) * 86400000).toISOString();
    const publish = (patch: Partial<InboxState>) => {
      current = { ...current, ...patch };
      if (active) setState(current);
    };
    setState(current);
    if (!userId) return;
    const load = async (more = false) => {
      if (!active) return;
      if (busy) { if (!more) queued = true; return; }
      if (more && !current.next) return;
      busy = true;
      publish({ refreshing: !more && !current.loading, loadingMore: more });
      try {
        let rows: Notification[] = more ? current.rows : [];
        let cursor = more ? current.next : null;
        const countPromise = getUnreadCount(userId);
        // Attach the handler immediately; a page failure must not orphan a count rejection.
        const countResult = countPromise.then(value => ({ value }), error => ({ error }));
        for (let index = 0; index < (more ? 1 : pages); index++) {
          const page = await fetchNotificationPage(userId, filters, cursor, since);
          rows = [...rows, ...page.rows];
          cursor = page.next;
          if (!cursor) break;
        }
        const count = await countResult;
        if ('error' in count) throw count.error;
        if (!active) return;
        if (more) pages++;
        publish({ rows, next: cursor, unreadCount: count.value, error: '' });
      } catch (error) {
        if (!active) return;
        const denied = isQueryAccessDenied(error);
        publish({ ...(denied ? { rows: [], next: null, unreadCount: null } : {}),
          error: denied ? 'Your access has changed. Sign in again to check your notifications.'
            : 'We couldn’t refresh your notifications. Check your connection and try again.' });
      } finally {
        busy = false;
        if (active) {
          publish({ loading: false, refreshing: false, loadingMore: false });
          if (queued) { queued = false; void load(); }
        }
      }
    };
    const refresh = () => { void load(); };
    controls.current = { refresh, more: () => { void load(true); } };
    refresh();
    const unsubscribe = subscribeNotificationChanges(userId, refresh);
    const invalidate = subscribeQueryDomain('notifications', event => { if (event.type === 'invalidated') refresh(); });
    const visible = () => { if (isDocumentVisible()) refresh(); };
    const timer = window.setInterval(visible, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      unsubscribe(); invalidate(); window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [scope, userId, filters.category, filters.unreadOnly, filters.period]);

  return { ...(state.scope === scope ? state : empty(scope, Boolean(userId))),
    retry: () => controls.current.refresh(), loadMore: () => controls.current.more() };
}
