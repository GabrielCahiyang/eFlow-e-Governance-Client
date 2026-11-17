import type { NotificationType } from '../../services/notificationService';

export const NOTIFICATION_CATEGORIES = [
  { value: 'all', label: 'All activity' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'work', label: 'Work changes' },
  { value: 'messages', label: 'Messages and mentions' },
  { value: 'finance', label: 'Funding and expenses' },
  { value: 'projects', label: 'Projects and collaboration' },
] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number]['value'];
export type NotificationPeriod = 'all' | '7' | '30';

export const CATEGORY_TYPES: Record<Exclude<NotificationCategory, 'all'>, readonly NotificationType[]> = {
  reviews: ['approval_needed', 'completed'],
  assignments: ['assignment', 'reassignment'],
  work: ['status_change', 'overdue', 'reminder', 'undo', 'burnout_warning'],
  messages: ['comment', 'collaboration_message'],
  finance: ['petty_cash_leader_review', 'petty_cash_department_approval', 'petty_cash_changes',
    'petty_cash_decision', 'petty_cash_liquidation', 'petty_cash_liquidation_changes',
    'petty_cash_liquidation_overdue', 'petty_cash_settlement_blocked', 'petty_cash_request_expired'],
  projects: ['collaboration_request', 'collaboration_change', 'collaboration_revision',
    'collaboration_approved', 'collaboration_declined', 'collaboration_ready',
    'project_archive_reminder', 'project_archive_blocked', 'project_seal_confirmed'],
};

export interface NotificationInboxFilters {
  category: NotificationCategory;
  unreadOnly: boolean;
  period: NotificationPeriod;
}

export const DEFAULT_NOTIFICATION_FILTERS: NotificationInboxFilters = {
  category: 'all', unreadOnly: false, period: 'all',
};
