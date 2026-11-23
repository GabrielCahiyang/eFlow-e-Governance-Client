import {
  AlertTriangle,
  Banknote,
  Bell,
  CalendarClock,
  ClipboardCheck,
  FolderKanban,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  formatManilaDate,
  formatManilaDateTime,
  MANILA_TIMEZONE,
} from "../../shared/calendarDisplay";
import type { Notification, NotificationType } from "../../services/notificationService";
import {
  CATEGORY_TYPES,
  URGENT_NOTIFICATION_TYPES,
  type NotificationCategory,
  type NotificationPeriod,
} from "./inboxFilters";

export type NotificationTone = "neutral" | "warning" | "danger" | "info" | "positive";

export interface NotificationVisual {
  icon: LucideIcon;
  categoryLabel: string;
  tone: NotificationTone;
  urgent: boolean;
}

const VISUAL_BY_TYPE: Partial<Record<NotificationType, Omit<NotificationVisual, "urgent">>> = {
  reminder: { icon: CalendarClock, categoryLabel: "Deadline", tone: "warning" },
  overdue: { icon: AlertTriangle, categoryLabel: "Overdue", tone: "danger" },
  burnout_warning: { icon: AlertTriangle, categoryLabel: "Workload", tone: "warning" },
  assignment: { icon: UserPlus, categoryLabel: "Assignment", tone: "info" },
  reassignment: { icon: UserPlus, categoryLabel: "Reassignment", tone: "info" },
  status_change: { icon: RefreshCw, categoryLabel: "Status update", tone: "neutral" },
  undo: { icon: RefreshCw, categoryLabel: "Reverted", tone: "warning" },
  comment: { icon: MessageSquare, categoryLabel: "Message", tone: "info" },
  collaboration_message: { icon: MessageSquare, categoryLabel: "Message", tone: "info" },
  approval_needed: { icon: ClipboardCheck, categoryLabel: "Review needed", tone: "warning" },
  completed: { icon: ClipboardCheck, categoryLabel: "Approved", tone: "positive" },
  project_approval_request: { icon: ShieldCheck, categoryLabel: "Project approval", tone: "warning" },
  project_funding_request: { icon: ShieldCheck, categoryLabel: "Project funding", tone: "warning" },
  project_funding_certification: { icon: ShieldCheck, categoryLabel: "Funding certification", tone: "warning" },
  project_funding_decided: { icon: Wallet, categoryLabel: "Project funding", tone: "info" },
  budget_approval: { icon: Wallet, categoryLabel: "Budget approval", tone: "warning" },
  budget_decision: { icon: Wallet, categoryLabel: "Budget", tone: "info" },
  petty_cash_request: { icon: Wallet, categoryLabel: "Funding review", tone: "warning" },
  petty_cash_leader_review: { icon: Wallet, categoryLabel: "Funding review", tone: "warning" },
  petty_cash_department_approval: { icon: Wallet, categoryLabel: "Funding review", tone: "warning" },
  petty_cash_decision: { icon: Wallet, categoryLabel: "Funding", tone: "info" },
  petty_cash_released: { icon: Banknote, categoryLabel: "Cash released", tone: "positive" },
  petty_cash_release_ready: { icon: Banknote, categoryLabel: "Cash release", tone: "warning" },
  petty_cash_liquidation: { icon: Wallet, categoryLabel: "Liquidation", tone: "info" },
  petty_cash_liquidation_leader_review: { icon: Wallet, categoryLabel: "Liquidation review", tone: "warning" },
  petty_cash_liquidation_department_review: { icon: Wallet, categoryLabel: "Liquidation review", tone: "warning" },
  petty_cash_liquidation_accounting_review: { icon: Wallet, categoryLabel: "Settlement", tone: "warning" },
  petty_cash_liquidation_decision: { icon: Wallet, categoryLabel: "Liquidation", tone: "info" },
  petty_cash_changes: { icon: Wallet, categoryLabel: "Funding", tone: "warning" },
  petty_cash_liquidation_changes: { icon: Wallet, categoryLabel: "Liquidation", tone: "warning" },
  petty_cash_liquidation_overdue: { icon: AlertTriangle, categoryLabel: "Overdue", tone: "danger" },
  petty_cash_settlement_blocked: { icon: AlertTriangle, categoryLabel: "Blocked", tone: "danger" },
  petty_cash_request_expired: { icon: AlertTriangle, categoryLabel: "Expired", tone: "danger" },
  petty_cash_return_received: { icon: Banknote, categoryLabel: "Cash return", tone: "warning" },
  petty_cash_return_approved: { icon: Banknote, categoryLabel: "Cash return", tone: "positive" },
  collaboration_request: { icon: FolderKanban, categoryLabel: "Collaboration", tone: "info" },
  collaboration_change: { icon: FolderKanban, categoryLabel: "Collaboration", tone: "neutral" },
  collaboration_revision: { icon: FolderKanban, categoryLabel: "Collaboration", tone: "warning" },
  collaboration_approved: { icon: ClipboardCheck, categoryLabel: "Collaboration", tone: "positive" },
  collaboration_declined: { icon: FolderKanban, categoryLabel: "Collaboration", tone: "danger" },
  collaboration_ready: { icon: FolderKanban, categoryLabel: "Collaboration", tone: "positive" },
  project_archive_reminder: { icon: FolderKanban, categoryLabel: "Project", tone: "warning" },
  project_archive_blocked: { icon: AlertTriangle, categoryLabel: "Project", tone: "danger" },
  project_seal_confirmed: { icon: ClipboardCheck, categoryLabel: "Project", tone: "positive" },
  project_retention_blocked: { icon: AlertTriangle, categoryLabel: "Retention", tone: "danger" },
  project_retention_notice: { icon: FolderKanban, categoryLabel: "Retention", tone: "warning" },
  project_retention_ready: { icon: FolderKanban, categoryLabel: "Retention", tone: "warning" },
  project_office_invitation: { icon: UserPlus, categoryLabel: "Invitation", tone: "info" },
  office_invitation: { icon: UserPlus, categoryLabel: "Invitation", tone: "info" },
  office_invitation_accepted: { icon: UserPlus, categoryLabel: "Invitation", tone: "positive" },
  system: { icon: Bell, categoryLabel: "System", tone: "neutral" },
};

const URGENT_SET = new Set<NotificationType>(URGENT_NOTIFICATION_TYPES);

export function isUrgentNotification(type: NotificationType): boolean {
  return URGENT_SET.has(type);
}

export function getNotificationVisual(type: NotificationType): NotificationVisual {
  const base = VISUAL_BY_TYPE[type] ?? {
    icon: Bell,
    categoryLabel: "Notification",
    tone: "neutral" as const,
  };
  return { ...base, urgent: URGENT_SET.has(type) };
}

export const ICON_TONE_CLASSES: Record<NotificationTone, string> = {
  neutral:
    "border-[var(--eflow-border)] bg-[var(--eflow-subtle)] text-[var(--eflow-text-secondary)]",
  info: "border-[color-mix(in_srgb,var(--eflow-info-text)_24%,var(--eflow-border))] bg-[var(--eflow-info-bg)] text-[var(--eflow-info-text)]",
  positive:
    "border-[color-mix(in_srgb,var(--eflow-positive-text)_24%,var(--eflow-border))] bg-[var(--eflow-positive-bg)] text-[var(--eflow-positive-text)]",
  warning:
    "border-[color-mix(in_srgb,var(--eflow-warning-text)_24%,var(--eflow-border))] bg-[var(--eflow-warning-bg)] text-[var(--eflow-warning-text)]",
  danger:
    "border-[color-mix(in_srgb,var(--eflow-negative-text)_24%,var(--eflow-border))] bg-[var(--eflow-negative-bg)] text-[var(--eflow-negative-text)]",
};

export function formatNotificationRelativeTime(timestamp: number, nowMs = Date.now()): string {
  const diffMs = Math.max(0, nowMs - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatManilaDate(timestamp, "");
}

export function formatNotificationExactManila(timestamp: number): string {
  return formatManilaDateTime(timestamp, "");
}

const manilaDayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns `YYYY-MM-DD` in Philippine Standard Time (`Asia/Manila`). */
export function getManilaDayKey(timestamp: number): string {
  return manilaDayKeyFmt.format(new Date(timestamp));
}

/**
 * Returns the UTC ISO timestamp corresponding to 00:00:00+08:00 (Asia/Manila midnight)
 * `daysAgo` calendar days prior to `nowMs`.
 */
export function getManilaStartOfDayIso(daysAgo = 0, nowMs = Date.now()): string {
  const todayKey = getManilaDayKey(nowMs);
  const todayStartMs = Date.parse(`${todayKey}T00:00:00+08:00`);
  return new Date(todayStartMs - daysAgo * 86_400_000).toISOString();
}

export function getPeriodSinceMs(period: NotificationPeriod, nowMs = Date.now()): number | null {
  if (period === "all") return null;
  if (period === "today") return Date.parse(getManilaStartOfDayIso(0, nowMs));
  return nowMs - Number(period) * 86_400_000;
}

export type NotificationDateGroupId = "today" | "yesterday" | "week" | "older";

export interface NotificationDateGroup {
  id: NotificationDateGroupId;
  label: string;
  items: Notification[];
}

const GROUP_LABELS: Record<NotificationDateGroupId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Earlier this week",
  older: "Older",
};

const GROUP_ORDER: NotificationDateGroupId[] = ["today", "yesterday", "week", "older"];

/** Groups notifications into Philippine-calendar day buckets (`Asia/Manila`). */
export function groupNotificationsByManilaDate(
  items: Notification[],
  nowMs = Date.now(),
): NotificationDateGroup[] {
  const todayStart = Date.parse(getManilaStartOfDayIso(0, nowMs));
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 6 * 86_400_000;

  const buckets: Record<NotificationDateGroupId, Notification[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const item of items) {
    if (item.createdAt >= todayStart) buckets.today.push(item);
    else if (item.createdAt >= yesterdayStart) buckets.yesterday.push(item);
    else if (item.createdAt >= weekStart) buckets.week.push(item);
    else buckets.older.push(item);
  }

  return GROUP_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    label: GROUP_LABELS[id],
    items: buckets[id],
  }));
}

/** Sanitizes user search text before embedding inside a PostgREST `.or()` `ilike` filter. */
export function sanitizePostgrestSearch(raw: string): string {
  return raw
    .trim()
    .slice(0, 120)
    .replace(/[%_*(),\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesNotificationCategory(
  item: Notification,
  category: NotificationCategory,
): boolean {
  if (category === "all") return true;
  if (category === "urgent") return isUrgentNotification(item.type);
  if (category === "reviews") {
    return (
      CATEGORY_TYPES.reviews.includes(item.type) ||
      [
        "petty_cash_request",
        "petty_cash_leader_review",
        "petty_cash_department_approval",
        "petty_cash_changes",
        "petty_cash_liquidation_leader_review",
        "petty_cash_liquidation_department_review",
        "petty_cash_liquidation_accounting_review",
        "petty_cash_liquidation_changes",
        "petty_cash_return_received",
        "petty_cash_return_approved",
      ].includes(item.type) ||
      (item.type === "status_change" &&
        ["changes_requested", "completed"].includes(item.statusTo || "")) ||
      [
        "m7_work_proposal",
        "m7_personal_work_proposal",
        "project_approval",
        "project_completion_review",
      ].includes(item.entityType || "")
    );
  }
  if (category === "finance") {
    return (
      item.type.startsWith("petty_cash_") ||
      String(item.type).startsWith("budget_") ||
      String(item.type).startsWith("project_funding_")
    );
  }
  return CATEGORY_TYPES[category].includes(item.type);
}

export function matchesNotificationSearch(item: Notification, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const visual = getNotificationVisual(item.type);
  const haystack = [
    item.title,
    item.message,
    item.taskTitle,
    item.actorName,
    item.reason,
    visual.categoryLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

export function filterNotificationsLocally(
  items: Notification[],
  options: {
    unreadOnly?: boolean;
    category?: NotificationCategory;
    period?: NotificationPeriod;
    query?: string;
    nowMs?: number;
  },
): Notification[] {
  const {
    unreadOnly = false,
    category = "all",
    period = "all",
    query = "",
    nowMs = Date.now(),
  } = options;
  const sinceMs = getPeriodSinceMs(period, nowMs);

  return items.filter((item) => {
    if (unreadOnly && item.read) return false;
    if (!matchesNotificationCategory(item, category)) return false;
    if (sinceMs !== null && item.createdAt < sinceMs) return false;
    if (!matchesNotificationSearch(item, query)) return false;
    return true;
  });
}
