import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCheck,
  ExternalLink,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  markAllNotificationsRead,
  markRecentNotificationRead,
  type Notification,
} from '../../../services/notificationService';
import {
  useNotificationInbox,
  NOTIFICATION_CATEGORIES,
  DEFAULT_NOTIFICATION_FILTERS,
  getNotificationDetail,
  resolveNotificationDestination,
  type NotificationInboxFilters,
} from '../../notifications';
import {
  formatNotificationExactManila,
  formatNotificationRelativeTime,
  getNotificationVisual,
  groupNotificationsByManilaDate,
  ICON_TONE_CLASSES,
} from '../../notifications/visuals';
import { playNotificationChime } from '../../notifications/notificationSound';
import { Button } from '../../../components/ui/button';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  PERSONAL_SETTINGS_CHANGED_EVENT,
  readPersonalSettings,
  savePersonalSettings,
} from '../../settings/personalSettingsStore';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

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
  const [searchDraft, setSearchDraft] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(() => readPersonalSettings(user?.id).notificationSoundEnabled);
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
    setSearchDraft('');
    setSoundEnabled(saved.notificationSoundEnabled);
    setFilters({
      category: saved.defaultNotificationCategory,
      unreadOnly: saved.defaultNotificationTab === 'unread',
      period: DEFAULT_NOTIFICATION_FILTERS.period,
    });
    setPage(1);
    const syncPrefs = () => setSoundEnabled(readPersonalSettings(user?.id).notificationSoundEnabled);
    window.addEventListener(PERSONAL_SETTINGS_CHANGED_EVENT, syncPrefs);
    return () => window.removeEventListener(PERSONAL_SETTINGS_CHANGED_EVENT, syncPrefs);
  }, [user?.id]);

  // Debounce server search while omitting `query` when empty to keep default filter shape clean
  useEffect(() => {
    const trimmed = searchDraft.trim();
    const timer = window.setTimeout(() => {
      setFilters(current => {
        const currentQuery = current.query || '';
        if (currentQuery === trimmed) return current;
        if (!trimmed) {
          const { query: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, query: trimmed };
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [filters.category, filters.period, filters.unreadOnly, filters.query, pageSize]);

  const isRead = (item: Notification) => item.read || readIds.includes(item.id);
  const unreadCount = feed.rows.filter(item => !isRead(item)).length;
  const rows = feed.rows.filter(item => !filters.unreadOnly || !isRead(item));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);
  const groupedPageRows = useMemo(() => groupNotificationsByManilaDate(pageRows), [pageRows]);
  const hasFilters = Boolean(
    filters.category !== 'all' ||
      filters.period !== 'all' ||
      filters.unreadOnly ||
      filters.query ||
      searchDraft.trim(),
  );

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const toggleSound = () => {
    const next = !soundEnabled;
    const saved = savePersonalSettings(user?.id, { notificationSoundEnabled: next });
    setSoundEnabled(saved.notificationSoundEnabled);
    if (next) {
      playNotificationChime('normal', { volume: saved.notificationSoundVolume, force: true });
    }
  };

  const clearAllFilters = () => {
    setSearchDraft('');
    setFilters(DEFAULT_NOTIFICATION_FILTERS);
  };

  const markRead = async (id: string) => {
    const recipient = user?.id;
    if (!recipient || pendingRef.current) return;
    pendingRef.current = true;
    setPending(id);
    setError('');
    try {
      await markRecentNotificationRead(recipient, id);
      if (scopeRef.current === recipient) {
        setReadIds(current => [...current, id]);
        feed.retry();
      }
    } catch {
      if (scopeRef.current === recipient) {
        setError('We couldn’t mark this notification as read. Try again.');
      }
    } finally {
      if (scopeRef.current === recipient) {
        pendingRef.current = false;
        setPending(null);
      }
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
          <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-initial">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-[11px] z-10 text-[var(--eflow-text-muted)]"
            />
            <BoundedTextInput
              value={searchDraft}
              maxLength={120}
              compact
              showCounter={false}
              type="search"
              aria-label="Search notifications"
              placeholder="Search title, task, person…"
              className="h-9 w-full rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] pl-8 pr-8 text-[12.5px] text-[var(--eflow-text)] focus:border-[var(--eflow-primary)] focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              onChange={event => setSearchDraft(event.target.value)}
            />
            {searchDraft && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchDraft('')}
                className="absolute right-2 top-[7px] inline-flex size-6 items-center justify-center rounded-md text-[var(--eflow-text-muted)] hover:bg-[var(--eflow-subtle)] hover:text-[var(--eflow-text)]"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <select
            aria-label="Activity type"
            className="h-9 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[12.5px] text-[var(--eflow-text)]"
            value={filters.category}
            onChange={event =>
              setFilters(current => ({
                ...current,
                category: event.target.value as NotificationInboxFilters['category'],
              }))
            }
          >
            {NOTIFICATION_CATEGORIES.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Time period"
            className="h-9 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[12.5px] text-[var(--eflow-text)]"
            value={filters.period}
            onChange={event =>
              setFilters(current => ({
                ...current,
                period: event.target.value as NotificationInboxFilters['period'],
              }))
            }
          >
            <option value="all">All time</option>
            <option value="today">Today (PH)</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear filters
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={soundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
            aria-pressed={!soundEnabled}
            title={soundEnabled ? 'Mute bell chime' : 'Unmute bell chime'}
            onClick={toggleSound}
          >
            {soundEnabled ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound on' : 'Muted'}</span>
          </Button>
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
        {feed.unreadCount === null
          ? 'Checking unread notifications…'
          : `${feed.unreadCount} unread across your inbox`}
        {filters.query ? ` · Searching "${filters.query}"` : ''}
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
            illustration={filters.query ? 'search' : filter === 'unread' ? 'complete' : 'inbox'}
            title={
              filters.query
                ? 'No matching notifications'
                : filter === 'unread'
                  ? 'No unread notifications'
                  : filters.category !== 'all' || filters.period !== 'all'
                    ? 'No matching notifications'
                    : 'No notifications yet'
            }
            description={
              filters.query
                ? `No notifications matched "${filters.query}". Try a different term or clear your filters.`
                : filter === 'unread'
                  ? 'No unread notifications match these filters.'
                  : filters.category !== 'all' || filters.period !== 'all'
                    ? 'Try another activity type or time period.'
                    : 'Assignments, reviews, work changes, and mentions will appear here.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Clear search &amp; filters
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)]">
          {groupedPageRows.map(group => (
            <section key={group.id} aria-label={group.label} className="border-b border-[var(--eflow-border)] last:border-b-0">
              <header className="flex items-center justify-between gap-2 border-b border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-4 py-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--eflow-text-secondary)]">
                  {group.label}
                </h2>
                <span className="rounded-[4px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--eflow-text-muted)]">
                  {group.items.length}
                </span>
              </header>
              <ul className="divide-y divide-[var(--eflow-border)]">
                {group.items.map(item => {
                  const detail = getNotificationDetail(item);
                  const destination = resolveNotificationDestination(item, userProfile?.role || '');
                  const read = isRead(item);
                  const visual = getNotificationVisual(item.type);
                  const Icon = visual.icon;
                  const exactManila = formatNotificationExactManila(item.createdAt);
                  return (
                    <li
                      key={item.id}
                      className={`flex flex-col gap-3 px-4 py-3.5 transition-colors sm:flex-row sm:items-center ${
                        read
                          ? 'bg-[var(--eflow-surface)]'
                          : 'bg-[color-mix(in_srgb,var(--eflow-selected)_38%,var(--eflow-surface))]'
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
                              className="size-2 shrink-0 rounded-[2px] bg-[var(--eflow-primary)]"
                              aria-label="Unread"
                            />
                          )}
                          <h3 className="text-[13.5px] font-semibold text-[var(--eflow-text)] break-words">
                            {item.title}
                          </h3>
                          <span className="rounded-[5px] border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--eflow-text-muted)]">
                            {visual.categoryLabel}
                          </span>
                          <time
                            className="text-[11.5px] text-[var(--eflow-text-muted)] sm:ml-1"
                            title={exactManila || undefined}
                          >
                            · {formatNotificationRelativeTime(item.createdAt)}
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
            </section>
          ))}
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
