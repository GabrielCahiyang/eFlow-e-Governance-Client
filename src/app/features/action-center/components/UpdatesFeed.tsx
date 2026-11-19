import { useEffect, useRef, useState } from 'react';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  ExternalLink,
  FolderKanban,
  MessageSquare,
  RefreshCw,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  markAllNotificationsRead,
  markRecentNotificationRead,
  type Notification,
  type NotificationType,
} from '../../../services/notificationService';
import { useNotificationInbox, NOTIFICATION_CATEGORIES, DEFAULT_NOTIFICATION_FILTERS, getNotificationDetail, resolveNotificationDestination, type NotificationInboxFilters } from '../../notifications';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { readPersonalSettings } from '../../settings/personalSettingsStore';

interface TypeVisual {
  icon: typeof Bell;
  categoryLabel: string;
  tone: 'neutral' | 'warning' | 'danger' | 'info' | 'positive';
}

const VISUAL_BY_TYPE: Partial<Record<NotificationType, TypeVisual>> = {
  reminder: { icon: CalendarClock, categoryLabel: 'Deadline', tone: 'warning' },
  overdue: { icon: AlertTriangle, categoryLabel: 'Overdue', tone: 'danger' },
  burnout_warning: { icon: AlertTriangle, categoryLabel: 'Workload', tone: 'warning' },
  assignment: { icon: UserPlus, categoryLabel: 'Assignment', tone: 'info' },
  reassignment: { icon: UserPlus, categoryLabel: 'Reassignment', tone: 'info' },
  status_change: { icon: RefreshCw, categoryLabel: 'Status update', tone: 'neutral' },
  undo: { icon: RefreshCw, categoryLabel: 'Reverted', tone: 'warning' },
  comment: { icon: MessageSquare, categoryLabel: 'Message', tone: 'info' },
  collaboration_message: { icon: MessageSquare, categoryLabel: 'Message', tone: 'info' },
  approval_needed: { icon: ClipboardCheck, categoryLabel: 'Review needed', tone: 'warning' },
  completed: { icon: ClipboardCheck, categoryLabel: 'Approved', tone: 'positive' },
  petty_cash_leader_review: { icon: Wallet, categoryLabel: 'Funding review', tone: 'warning' },
  petty_cash_department_approval: { icon: Wallet, categoryLabel: 'Funding review', tone: 'warning' },
  petty_cash_decision: { icon: Wallet, categoryLabel: 'Funding', tone: 'info' },
  petty_cash_liquidation: { icon: Wallet, categoryLabel: 'Liquidation', tone: 'info' },
  petty_cash_changes: { icon: Wallet, categoryLabel: 'Funding', tone: 'warning' },
  petty_cash_liquidation_changes: { icon: Wallet, categoryLabel: 'Liquidation', tone: 'warning' },
  petty_cash_liquidation_overdue: { icon: AlertTriangle, categoryLabel: 'Overdue', tone: 'danger' },
  petty_cash_settlement_blocked: { icon: AlertTriangle, categoryLabel: 'Blocked', tone: 'danger' },
  petty_cash_request_expired: { icon: AlertTriangle, categoryLabel: 'Expired', tone: 'danger' },
  collaboration_request: { icon: FolderKanban, categoryLabel: 'Collaboration', tone: 'info' },
  collaboration_change: { icon: FolderKanban, categoryLabel: 'Collaboration', tone: 'neutral' },
  collaboration_revision: { icon: FolderKanban, categoryLabel: 'Collaboration', tone: 'warning' },
  collaboration_approved: { icon: ClipboardCheck, categoryLabel: 'Collaboration', tone: 'positive' },
  collaboration_declined: { icon: FolderKanban, categoryLabel: 'Collaboration', tone: 'danger' },
  collaboration_ready: { icon: FolderKanban, categoryLabel: 'Collaboration', tone: 'positive' },
  project_archive_reminder: { icon: FolderKanban, categoryLabel: 'Project', tone: 'warning' },
  project_archive_blocked: { icon: AlertTriangle, categoryLabel: 'Project', tone: 'danger' },
  project_seal_confirmed: { icon: ClipboardCheck, categoryLabel: 'Project', tone: 'positive' },
};

const ICON_TONE_CLASSES: Record<TypeVisual['tone'], string> = {
  neutral: 'border-[var(--eflow-border)] bg-[var(--eflow-subtle)] text-[var(--eflow-text-secondary)]',
  info: 'border-[color-mix(in_srgb,var(--eflow-info-text)_24%,var(--eflow-border))] bg-[var(--eflow-info-bg)] text-[var(--eflow-info-text)]',
  positive: 'border-[color-mix(in_srgb,var(--eflow-positive-text)_24%,var(--eflow-border))] bg-[var(--eflow-positive-bg)] text-[var(--eflow-positive-text)]',
  warning: 'border-[color-mix(in_srgb,var(--eflow-warning-text)_24%,var(--eflow-border))] bg-[var(--eflow-warning-bg)] text-[var(--eflow-warning-text)]',
  danger: 'border-[color-mix(in_srgb,var(--eflow-negative-text)_24%,var(--eflow-border))] bg-[var(--eflow-negative-bg)] text-[var(--eflow-negative-text)]',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function formatTimeAgo(timestamp: number): string {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatManilaDate(timestamp, '');
}

function UpdatesFeedSkeleton() {
  const pulse = 'animate-pulse rounded bg-muted';
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading notifications…</span>
      <ul className="rounded-xl border border-[var(--eflow-border)] divide-y divide-[var(--eflow-border)] bg-[var(--eflow-surface)]" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <li key={i} className="flex items-start gap-3 p-4">
            <span className={`size-9 shrink-0 rounded-lg ${pulse}`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2 items-center">
                <span className={`h-4 w-48 ${pulse}`} />
                <span className={`h-3 w-12 ml-auto ${pulse}`} />
              </div>
              <span className={`block h-3.5 w-4/5 ${pulse}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UpdatesFeed({ onOpen }: { onOpen: (notification: Notification) => void }) {
  const { user, userProfile } = useAuth();
  const [filters, setFilters] = useState<NotificationInboxFilters>(() => {
    const saved = readPersonalSettings(user?.id);
    return {
      category: saved.defaultNotificationCategory,
      unreadOnly: saved.defaultNotificationTab === 'unread',
      period: DEFAULT_NOTIFICATION_FILTERS.period,
    };
  });
  const feed = useNotificationInbox(user?.id, filters);
  const filter = filters.unreadOnly ? 'unread' : 'all';
  const [readIds, setReadIds] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const pendingRef = useRef(false);
  const scopeRef = useRef(user?.id);
  scopeRef.current = user?.id;

  useEffect(() => {
    const saved = readPersonalSettings(user?.id);
    setReadIds([]);
    setMarkingAll(false);
    pendingRef.current = false;
    setPending(null);
    setError('');
    setFilters({
      category: saved.defaultNotificationCategory,
      unreadOnly: saved.defaultNotificationTab === 'unread',
      period: DEFAULT_NOTIFICATION_FILTERS.period,
    });
    setPage(1);
  }, [user?.id]);

  useEffect(() => {
    setPage(1);
  }, [filters.category, filters.period, filters.unreadOnly, pageSize]);

  const isRead = (item: Notification) => item.read || readIds.includes(item.id);
  const unreadCount = feed.rows.filter(item => !isRead(item)).length;
  const rows = feed.rows.filter(item => !filters.unreadOnly || !isRead(item));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const markRead = async (id: string) => {
    const recipient = user?.id;
    if (!recipient || pendingRef.current) return;
    pendingRef.current = true;
    setPending(id);
    setError('');
    try {
      await markRecentNotificationRead(recipient, id);
      if (scopeRef.current === recipient) { setReadIds(current => [...current, id]); feed.retry(); }
    } catch {
      if (scopeRef.current === recipient) {
        setError('We couldn’t mark this notification as read. Try again.');
      }
    } finally {
      if (scopeRef.current === recipient) { pendingRef.current = false; setPending(null); }
    }
  };

  const handleMarkAllRead = async () => {
    const recipient = user?.id;
    if (!recipient || markingAll || (feed.unreadCount ?? unreadCount) === 0) return;
    const shownUnreadIds = feed.rows.filter(item => !isRead(item)).map(item => item.id);
    setMarkingAll(true);
    setError('');
    try {
      await markAllNotificationsRead(recipient);
      if (scopeRef.current === recipient) {
        setReadIds(current => [...new Set([...current, ...shownUnreadIds])]);
        feed.retry();
      }
    } catch {
      if (scopeRef.current === recipient) {
        setError('We couldn’t mark your notifications as read. Try again.');
      }
    } finally {
      if (scopeRef.current === recipient) setMarkingAll(false);
    }
  };

  const openItem = (item: Notification) => {
    if (!isRead(item)) void markRead(item.id);
    onOpen(item);
  };

  const handleNextPage = () => {
    if (safePage < totalPages) {
      setPage(safePage + 1);
      return;
    }
    if (feed.next && !feed.loadingMore) {
      feed.loadMore();
      setPage(safePage + 1);
    }
  };

  return (
    <section className="space-y-4" aria-label="Notifications">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--eflow-border)] pb-2.5">
        <div className="flex items-center gap-1" role="tablist" aria-label="Notification filter">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilters(current => ({ ...current, unreadOnly: false }))}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors -mb-[11px] ${
              filter === 'all'
                ? 'border-[var(--eflow-primary)] text-[var(--eflow-primary)] font-semibold'
                : 'border-transparent text-[var(--eflow-text-secondary)] hover:text-[var(--eflow-text)]'
            }`}
          >
            <span>All</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'unread'}
            onClick={() => setFilters(current => ({ ...current, unreadOnly: true }))}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors -mb-[11px] ${
              filter === 'unread'
                ? 'border-[var(--eflow-primary)] text-[var(--eflow-primary)] font-semibold'
                : 'border-transparent text-[var(--eflow-text-secondary)] hover:text-[var(--eflow-text)]'
            }`}
          >
            <span>Unread</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Notification filters">
          <select
            aria-label="Activity type"
            className="h-9 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[12.5px] text-[var(--eflow-text)]"
            value={filters.category}
            onChange={event => setFilters(current => ({ ...current, category: event.target.value as NotificationInboxFilters['category'] }))}
          >
            {NOTIFICATION_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          <select
            aria-label="Time period"
            className="h-9 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[12.5px] text-[var(--eflow-text)]"
            value={filters.period}
            onChange={event => setFilters(current => ({ ...current, period: event.target.value as NotificationInboxFilters['period'] }))}
          >
            <option value="all">All time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          {(filters.category !== 'all' || filters.period !== 'all' || filters.unreadOnly) && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_NOTIFICATION_FILTERS)}>Clear filters</Button>
          )}
          <Button variant="ghost" size="sm" disabled={feed.loading || feed.refreshing} onClick={feed.retry}>
            {feed.refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markingAll || pending !== null || feed.loading || (feed.unreadCount ?? unreadCount) === 0}
            onClick={() => void handleMarkAllRead()}
          >
            <CheckCheck size={14} aria-hidden="true" />
            <span>{markingAll ? 'Marking read…' : 'Mark all read'}</span>
          </Button>
        </div>
      </div>

      <p className="text-[12px] text-[var(--eflow-text-muted)]" role="status">
        {feed.unreadCount === null ? 'Checking unread notifications…' : `${feed.unreadCount} unread across your inbox`}
      </p>

      {error && (
        <FeedbackState tone="error" title="Couldn’t mark notifications as read">
          {error} Try again.
        </FeedbackState>
      )}
      {feed.error && (
        <FeedbackState
          tone={feed.rows.length ? 'warning' : 'error'}
          title={feed.rows.length ? 'Notifications could not refresh' : 'Notifications could not be loaded'}
          onRetry={feed.retry}
        >
          {feed.error}
        </FeedbackState>
      )}

      {feed.loading ? (
        <UpdatesFeedSkeleton />
      ) : !rows.length ? (
        !feed.error && (
          <EmptyState
            fill
            illustration={filter === 'unread' ? 'complete' : 'inbox'}
            title={filter === 'unread' ? 'No unread notifications' : filters.category !== 'all' || filters.period !== 'all' ? 'No matching notifications' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'No unread notifications match these filters.'
                : filters.category !== 'all' || filters.period !== 'all'
                  ? 'Try another activity type or time period.'
                  : 'Assignments, reviews, work changes, and mentions will appear here.'
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)]">
          <ul className="divide-y divide-[var(--eflow-border)]">
            {pageRows.map(item => {
              const detail = getNotificationDetail(item);
              const destination = resolveNotificationDestination(item, userProfile?.role || '');
              const read = isRead(item);
              const visual = VISUAL_BY_TYPE[item.type] ?? {
                icon: Bell,
                categoryLabel: 'Notification',
                tone: 'neutral' as const,
              };
              const Icon = visual.icon;
              return (
                <li
                  key={item.id}
                  className={`flex flex-col gap-3 px-4 py-3.5 transition-colors sm:flex-row sm:items-center ${
                    read ? 'bg-[var(--eflow-surface)]' : 'bg-[color-mix(in_srgb,var(--eflow-selected)_38%,var(--eflow-surface))]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${ICON_TONE_CLASSES[visual.tone]}`}
                  >
                    <Icon size={16} />
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!read && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-[var(--eflow-primary)]"
                          aria-label="Unread"
                        />
                      )}
                      <h2 className="text-[13.5px] font-semibold text-[var(--eflow-text)] break-words">
                        {item.title}
                      </h2>
                      <span className="rounded-[5px] border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--eflow-text-muted)]">
                        {visual.categoryLabel}
                      </span>
                      <time className="text-[11.5px] text-[var(--eflow-text-muted)] sm:ml-1">
                        · {formatTimeAgo(item.createdAt)}
                      </time>
                    </div>
                    <p className="text-[13px] leading-5 text-[var(--eflow-text-secondary)] break-words">
                      {item.message}
                    </p>
                    {item.taskTitle && (
                      <p className="text-[12px] text-[var(--eflow-text-muted)] break-words">
                        Task: {item.taskTitle}
                      </p>
                    )}
                    {detail && (
                      <p className="text-[12px] leading-5 text-[var(--eflow-text-secondary)] break-words">
                        <strong>{detail.label}:</strong> {detail.text}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Button
                      data-update-id={item.id}
                      variant="outline"
                      size="sm"
                      onClick={() => openItem(item)}
                    >
                      <span>{destination?.label || 'Open'}</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </Button>
                    {!read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending !== null || markingAll}
                        onClick={() => void markRead(item.id)}
                      >
                        {pending === item.id ? 'Saving…' : 'Mark read'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <footer
            className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--eflow-border)] bg-[color-mix(in_srgb,var(--eflow-subtle)_45%,var(--eflow-surface))] px-4 py-2.5 text-[12px] text-[var(--eflow-text-secondary)]"
            aria-label="Notifications pagination"
          >
            <span className="tabular-nums">
              Showing {startIndex + 1}–{Math.min(startIndex + pageRows.length, rows.length)} of {rows.length} loaded notifications
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex items-center gap-1.5">
                <span>Rows</span>
                <select
                  aria-label="Notifications per page"
                  value={pageSize}
                  onChange={event => setPageSize(Number(event.target.value))}
                  className="h-8 rounded-md border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-2 text-[12px] text-[var(--eflow-text)]"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
              <span className="tabular-nums">Page {safePage} of {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages && !feed.next}
                  onClick={handleNextPage}
                >
                  Next
                </Button>
              </div>
              {feed.next && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={feed.loadingMore || feed.refreshing}
                  onClick={feed.loadMore}
                >
                  {feed.loadingMore ? 'Loading…' : 'Load older notifications'}
                </Button>
              )}
            </div>
          </footer>
        </div>
      )}
    </section>
  );
}
