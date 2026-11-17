import { supabase } from '../../../../lib/supabase';
import { rowToNotif, type Notification } from '../../../services/notificationService';
import { CATEGORY_TYPES, type NotificationInboxFilters } from '../inboxFilters';

export interface NotificationCursor { createdAt: string; id: string }
export interface NotificationPage { rows: Notification[]; next: NotificationCursor | null }
export const NOTIFICATION_PAGE_SIZE = 25;

/** Recipient RLS remains authoritative. Filters run before the keyset page. */
export async function fetchNotificationPage(
  userId: string,
  filters: NotificationInboxFilters,
  cursor: NotificationCursor | null = null,
  since?: string,
): Promise<NotificationPage> {
  if (!userId) return { rows: [], next: null };
  let query = supabase.from('notifications').select('*').eq('user_id', userId);
  if (filters.unreadOnly) query = query.eq('read', false);
  if (filters.category !== 'all') {
    // Decisions use status_change too; include them without including unrelated work changes.
    if (filters.category === 'reviews') {
      query = query.or('type.in.(approval_needed,completed,petty_cash_leader_review,petty_cash_department_approval,petty_cash_changes,petty_cash_liquidation_changes),and(type.eq.status_change,status_to.in.(changes_requested,completed)),entity_type.in.(m7_work_proposal,m7_personal_work_proposal)');
    } else if (filters.category === 'finance') query = query.or('type.like.petty_cash_*,type.like.budget_*');
    else query = query.in('type', [...CATEGORY_TYPES[filters.category]]);
  }
  if (since) query = query.gte('created_at', since);
  if (cursor) {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(cursor.id)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(cursor.createdAt)
      || !Number.isFinite(Date.parse(cursor.createdAt))) throw new Error('Reload notifications to continue.');
    const timestamp = cursor.createdAt;
    // Equal timestamps are ordered by UUID so no notification is skipped.
    query = query.or(`created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${cursor.id})`);
  }
  const { data, error, status } = await query.order('created_at', { ascending: false })
    .order('id', { ascending: false }).limit(NOTIFICATION_PAGE_SIZE + 1);
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
  const page = (data || []).slice(0, NOTIFICATION_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    rows: page.map(rowToNotif),
    next: (data?.length || 0) > NOTIFICATION_PAGE_SIZE && last
      ? { createdAt: last.created_at as string, id: last.id as string } : null,
  };
}
