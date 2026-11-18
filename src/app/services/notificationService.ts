// ─── eFlow Notification Service (Supabase) ───────────────────────
// Real-time notifications from Supabase notifications table.

import { supabase } from '../../lib/supabase';
import { controlPanelFetch } from '../shared/controlPanelClient';
import {
  normalizeFinancialNotification,
  normalizeWorkUpdateNotification,
} from '../shared/notificationWorkCopy';
import {
  buildQueryScopeKey,
  invalidateQueryDomain,
  isDocumentVisible,
  loadWithQueryCache,
  readCachedQuery,
  subscribeQueryDomain,
} from '../shared/queryCache';
import { isQueryAccessDenied } from '../shared/queryAccess';

export type NotificationType =
  | 'assignment'
  | 'overdue'
  | 'burnout_warning'
  | 'approval_needed'
  | 'completed'
  | 'reassignment'
  | 'status_change'
  | 'undo'
  | 'comment'
  | 'reminder'
  | 'collaboration_request'
  | 'collaboration_message'
  | 'collaboration_change'
  | 'collaboration_revision'
  | 'collaboration_approved'
  | 'collaboration_declined'
  | 'collaboration_ready'
  | 'petty_cash_leader_review'
  | 'petty_cash_department_approval'
  | 'petty_cash_changes'
  | 'petty_cash_decision'
  | 'petty_cash_liquidation'
  | 'petty_cash_liquidation_changes'
  | 'petty_cash_liquidation_overdue'
  | 'petty_cash_settlement_blocked'
  | 'petty_cash_request_expired'
  | 'project_archive_reminder'
  | 'project_archive_blocked'
  | 'project_seal_confirmed';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
  taskTitle?: string;
  actorId?: string;
  actorName?: string;
  statusFrom?: string;
  statusTo?: string;
  reason?: string;
  projectId?: string;
  proposalId?: string;
  orgId?: string;
  entityType?: string;
  workNodeId?: string;
  financialRecordId?: string;
  financialRecordType?: string;
  conversationId?: string;
  conversationMessageId?: string;
  read: boolean;
  createdAt: number;
}

export function rowToNotif(row: Record<string, unknown>): Notification {
  return normalizeFinancialNotification(
    normalizeWorkUpdateNotification({
      id: row.id as string,
      type: (row.type as NotificationType) || 'assignment',
      title: (row.title as string) || '',
      message: (row.message as string) || '',
      taskId: (row.task_id as string) || undefined,
      taskTitle: (row.task_title as string) || undefined,
      actorId: (row.actor_id as string) || undefined,
      actorName: (row.actor_name as string) || undefined,
      statusFrom: (row.status_from as string) || undefined,
      statusTo: (row.status_to as string) || undefined,
      reason: (row.reason as string) || undefined,
      projectId: (row.project_id as string) || undefined,
      proposalId: (row.proposal_id as string) || undefined,
      orgId: (row.org_id as string) || undefined,
      entityType: (row.entity_type as string) || undefined,
      workNodeId: (row.work_node_id as string) || undefined,
      financialRecordId: (row.financial_record_id as string) || undefined,
      financialRecordType: (row.financial_record_type as string) || undefined,
      conversationId: (row.conversation_id as string) || undefined,
      conversationMessageId: (row.conversation_message_id as string) || undefined,
      read: (row.read as boolean) || false,
      createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
    }),
  );
}

export function subscribeNotificationChanges(userId: string, onChanged: () => void) {
  const channel = supabase.channel(`notifs-${userId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
    }, onChanged)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  limit = 50,
  onState?: (state: { unreadCount: number | null; error: string; loading: boolean }) => void,
) {
  let active = true, busy = false, queued = false;
  let unreadCount: number | null = null;
  const scope = buildQueryScopeKey({ userId, filter: String(limit) });
  const cached = readCachedQuery<Notification[]>('notifications', scope);
  if (cached.hit && cached.data) {
    callback(cached.data);
  }
  const load = async (forceRefresh = false) => {
    if (!active) return;
    if (busy) { queued = true; return; }
    busy = true;
    try {
      const [list, count] = await Promise.all([loadWithQueryCache({
        domain: 'notifications',
        scope,
        ttlMs: 30_000,
        forceRefresh,
        fetcher: async () => {
          const { data, error, status } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
          if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
          return data ? data.map(rowToNotif) : [];
        },
      }), getUnreadCount(userId)]);
      if (!active) return;
      unreadCount = count;
      callback(list);
      onState?.({ unreadCount, error: '', loading: false });
    } catch (error) {
      if (!active) return;
      if (isQueryAccessDenied(error)) { callback([]); unreadCount = null; }
      onState?.({ unreadCount, error: 'We couldn’t refresh your notifications. Open Inbox to try again.', loading: false });
    } finally {
      busy = false;
      if (active && queued) { queued = false; void load(true); }
    }
  };
  void load(false);

  const unsubscribe = subscribeNotificationChanges(userId, () => {
    invalidateQueryDomain('personal-feed');
    void load(true);
  });

  // Realtime can be unavailable briefly during reconnects or when a table was
  // newly added to the publication. Polling keeps reviewer alerts reliable
  // without waiting for the user to reload the app.
  const refreshTimer = window.setInterval(() => {
    if (isDocumentVisible()) void load(true);
  }, 15_000);
  const refresh = () => { void load(true); };
  const visible = () => { if (isDocumentVisible()) refresh(); };
  const stopInvalidation = subscribeQueryDomain('notifications', event => {
    if (event.type === 'invalidated') refresh();
  });
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', visible);

  return () => {
    active = false;
    window.clearInterval(refreshTimer);
    unsubscribe();
    stopInvalidation();
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
    document.removeEventListener('visibilitychange', visible);
  };
}

export async function createNotification(
  userId: string,
  notification: Omit<Notification, 'id' | 'read' | 'createdAt'>,
): Promise<void> {
  if (!userId) return;

  const isUuid = (val?: string) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const row: Record<string, unknown> = {
    user_id: userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    task_id: isUuid(notification.taskId) ? notification.taskId : null,
    task_title: notification.taskTitle || '',
    actor_id: isUuid(notification.actorId) ? notification.actorId : null,
    actor_name: notification.actorName || '',
    status_from: notification.statusFrom || '',
    status_to: notification.statusTo || '',
    reason: notification.reason || '',
    read: false,
  };
  if (notification.projectId) row.project_id = isUuid(notification.projectId) ? notification.projectId : null;
  if (notification.proposalId) row.proposal_id = notification.proposalId;
  if (notification.orgId) row.org_id = isUuid(notification.orgId) ? notification.orgId : null;
  if (notification.entityType) row.entity_type = notification.entityType;
  if (notification.workNodeId && isUuid(notification.workNodeId)) row.work_node_id = notification.workNodeId;
  const { error } = await supabase.from('notifications').insert(row);
  // This legacy helper is secondary to an already-saved workflow action. Keep
  // its void contract without sending an email that implies a failed row exists.
  if (error) { console.error('In-app notification could not be saved.', { code: error.code }); return; }
  invalidateQueryDomain('notifications');
  invalidateQueryDomain('personal-feed');

  // Fire-and-forget email — never let this throw into the caller. The
  // in-app notification above has already succeeded regardless of
  controlPanelFetch("notifications/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      title: notification.title,
      body: notification.message,
      taskId: notification.taskId || null,
    }),
  }, { retryOnEndpointChange: true }).catch((err) =>
    console.error("Email notification request failed:", err),
  );
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId).eq('user_id', userId);
  invalidateQueryDomain('notifications');
  invalidateQueryDomain('personal-feed');
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!userId) throw new Error('Sign in to mark your notifications as read.');
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw new Error('We couldn’t mark your notifications as read. Try again.');
  invalidateQueryDomain('notifications');
  invalidateQueryDomain('personal-feed');
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error, status } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
  return count || 0;
}

/** Error-aware recent feed; legacy subscription/mark-read returns stay compatible. */
export async function fetchRecentNotifications(userId: string): Promise<Notification[]> {
  if (!userId) return [];
  const { data, error, status } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
  return (data || []).map(rowToNotif);
}
export async function markRecentNotificationRead(userId: string, id: string): Promise<void> {
  if (!userId || !id) throw new Error('A signed-in recipient and update are required.');
  const { data, error } = await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', userId).select('id');
  if (error) throw new Error(error.message);
  if (!data?.some(row => row.id === id)) throw new Error('This update is no longer available or read access was denied.');
  invalidateQueryDomain('notifications');
  invalidateQueryDomain('personal-feed');
}
