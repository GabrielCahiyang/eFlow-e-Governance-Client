// ─── eFlow Notification Service (Supabase) ───────────────────────
// Real-time notifications from Supabase notifications table.

import { supabase } from '../../lib/supabase';
import { controlPanelFetch } from '../shared/controlPanelClient';

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
  | 'petty_cash_request_expired';

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
  read: boolean;
  createdAt: number;
}

function rowToNotif(row: Record<string, unknown>): Notification {
  return {
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
    read: (row.read as boolean) || false,
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
  };
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  limit = 50,
) {
  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data) callback(data.map(rowToNotif));
    else callback([]);
  };
  load();

  const channelId = `notifs-${userId}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, () => load())
    .subscribe();

  // Realtime can be unavailable briefly during reconnects or when a table was
  // newly added to the publication. Polling keeps reviewer alerts reliable
  // without waiting for the user to reload the app.
  const refreshTimer = window.setInterval(() => { void load(); }, 15_000);

  return () => {
    window.clearInterval(refreshTimer);
    void supabase.removeChannel(channel);
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
  await supabase.from('notifications').insert(row);

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
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count || 0;
}

/** Error-aware recent feed; legacy subscription/mark-read returns stay compatible. */
export async function fetchRecentNotifications(userId: string): Promise<Notification[]> {
  if (!userId) return [];
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToNotif);
}
export async function markRecentNotificationRead(userId: string, id: string): Promise<void> {
  if (!userId || !id) throw new Error('A signed-in recipient and update are required.');
  const { data, error } = await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', userId).select('id');
  if (error) throw new Error(error.message);
  if (!data?.some(row => row.id === id)) throw new Error('This update is no longer available or read access was denied.');
}
