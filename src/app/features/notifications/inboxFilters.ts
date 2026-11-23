import type { NotificationType } from '../../services/notificationService';

export const NOTIFICATION_CATEGORIES = [
  { value: 'all', label: 'All activity' },
  { value: 'urgent', label: 'Action required / Urgent' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'work', label: 'Work changes' },
  { value: 'messages', label: 'Messages and mentions' },
  { value: 'finance', label: 'Funding and expenses' },
  { value: 'projects', label: 'Projects and collaboration' },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]['value'];
export type NotificationPeriod = 'all' | 'today' | '7' | '30';

export const URGENT_NOTIFICATION_TYPES: readonly NotificationType[] = [
  'overdue',
  'approval_needed',
  'burnout_warning',
  'project_approval_request',
  'project_funding_request',
  'project_funding_certification',
  'budget_approval',
  'petty_cash_request',
  'petty_cash_leader_review',
  'petty_cash_department_approval',
  'petty_cash_release_ready',
  'petty_cash_liquidation_leader_review',
  'petty_cash_liquidation_department_review',
  'petty_cash_liquidation_accounting_review',
  'petty_cash_liquidation_overdue',
  'petty_cash_settlement_blocked',
  'petty_cash_request_expired',
  'petty_cash_return_received',
  'petty_cash_return_approved',
  'project_archive_blocked',
  'project_retention_blocked',
  'project_retention_ready',
  'collaboration_request',
];

export const CATEGORY_TYPES: Record<
  Exclude<NotificationCategory, 'all'>,
  readonly NotificationType[]
> = {
  urgent: URGENT_NOTIFICATION_TYPES,
  reviews: [
    'approval_needed',
    'completed',
    'project_approval_request',
    'project_funding_request',
    'project_funding_certification',
    'budget_approval',
  ],
  assignments: ['assignment', 'reassignment'],
  work: ['status_change', 'overdue', 'reminder', 'undo', 'burnout_warning'],
  messages: ['comment', 'collaboration_message'],
  finance: [
    'project_funding_request',
    'project_funding_certification',
    'project_funding_decided',
    'budget_approval',
    'budget_decision',
    'petty_cash_request',
    'petty_cash_leader_review',
    'petty_cash_department_approval',
    'petty_cash_changes',
    'petty_cash_decision',
    'petty_cash_released',
    'petty_cash_release_ready',
    'petty_cash_liquidation',
    'petty_cash_liquidation_leader_review',
    'petty_cash_liquidation_department_review',
    'petty_cash_liquidation_accounting_review',
    'petty_cash_liquidation_decision',
    'petty_cash_liquidation_changes',
    'petty_cash_liquidation_overdue',
    'petty_cash_settlement_blocked',
    'petty_cash_request_expired',
    'petty_cash_return_received',
    'petty_cash_return_approved',
  ],
  projects: [
    'project_approval_request',
    'project_funding_request',
    'project_funding_certification',
    'project_funding_decided',
    'collaboration_request',
    'collaboration_change',
    'collaboration_revision',
    'collaboration_approved',
    'collaboration_declined',
    'collaboration_ready',
    'project_archive_reminder',
    'project_archive_blocked',
    'project_seal_confirmed',
    'project_retention_blocked',
    'project_retention_notice',
    'project_retention_ready',
    'project_office_invitation',
    'office_invitation',
    'office_invitation_accepted',
  ],
};

export interface NotificationInboxFilters {
  category: NotificationCategory;
  unreadOnly: boolean;
  period: NotificationPeriod;
  query?: string;
}

export const DEFAULT_NOTIFICATION_FILTERS: NotificationInboxFilters = {
  category: 'all',
  unreadOnly: false,
  period: 'all',
};
