import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttentionBox, Button as VibeButton } from '@vibe/core';
import { Search, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { fetchNotificationSubitem, useNotificationNavigationIntent } from '../../notifications';
import { formatManilaDate } from '../../../shared/calendarDisplay';

function formatRelativeTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  const mins = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatManilaDate(time, value);
}
import { SubtaskWorkDrawer } from '../../subtasks';
import type { TaskInspectorOrigin } from '../../task-inspector';
import { subscribeWorkChanges } from '../../../shared/workChanges';
import { requestNavigation } from '../../../shared/navigationGuard';
import { fetchAssignedSubtaskReviews, type AssignedSubtaskReview } from '../services/assignedSubtaskReviews';

type OpenSubtask = Awaited<ReturnType<typeof fetchNotificationSubitem>>;
type ReviewKindFilter = 'all' | 'completion' | 'progress';

export function AssignedSubtaskReviews({
  actor,
  refreshSignal = 0,
  onLoadingChange,
}: {
  actor: string;
  refreshSignal?: number;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [rows, setRows] = useState<AssignedSubtaskReview[]>();
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [kindFilter, setKindFilter] = useState<ReviewKindFilter>('all');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<{ item: OpenSubtask; origin: TaskInspectorOrigin }>();
  const read = useRef(0);
  const open = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++read.current;
    onLoadingChange?.(true);
    try {
      const data = await fetchAssignedSubtaskReviews();
      if (run === read.current) { setRows(data); setError(''); }
    } catch {
      if (run === read.current) { setRows(undefined); setError('Could not load your assigned reviews.'); }
    } finally {
      if (run === read.current) onLoadingChange?.(false);
    }
  }, [onLoadingChange]);
  useEffect(() => {
    if (!actor) return;
    const reload = () => void refresh();
    reload();
    const timer = window.setInterval(reload, 15000);
    window.addEventListener('focus', reload);
    const unsubscribe = subscribeWorkChanges(reload);
    return () => {
      ++read.current;
      ++open.current;
      window.clearInterval(timer);
      window.removeEventListener('focus', reload);
      unsubscribe();
    };
  }, [actor, refresh]);
  useEffect(() => {
    if (refreshSignal > 0 && actor) void refresh();
  }, [actor, refreshSignal, refresh]);

  async function openReview(rootId: string, nodeId: string, opener: HTMLElement | null, isCurrent = () => true) {
    const run = ++open.current;
    setOpening(true);
    setOpenError('');
    try {
      const item = await fetchNotificationSubitem({ notificationId: 'assigned-review', kind: 'leading_task', taskId: rootId, entityId: nodeId }, actor);
      if (run !== open.current || !isCurrent()) return;
      await requestNavigation(() => {
        if (run !== open.current || !isCurrent()) return;
        setSelection({ item, origin: { view: 'Reviews', section: 'work', returnFocus: opener,
          restoreFocus: () => document.getElementById('assigned-subtask-reviews-title')?.focus() } });
      });
    } catch {
      if (run === open.current && isCurrent()) setOpenError('Could not open this subtask. Refresh your review list and try again.');
    } finally {
      if (run === open.current) setOpening(false);
    }
  }
  useNotificationNavigationIntent(
    intent => intent.kind === 'leading_task' && !!intent.entityId && !!intent.taskId,
    async (intent, isCurrent) => {
      await openReview(intent.taskId!, intent.entityId!, document.activeElement instanceof HTMLElement ? document.activeElement : null, isCurrent);
      return isCurrent();
    },
    [actor],
  );

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    const needle = query.trim().toLocaleLowerCase();
    return rows.filter(row => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      if (!needle) return true;
      return row.subtask_title.toLocaleLowerCase().includes(needle) || row.task_title.toLocaleLowerCase().includes(needle);
    });
  }, [rows, kindFilter, query]);

  const hasFilter = kindFilter !== 'all' || !!query.trim();
  const reviewWord = visibleRows.length === 1 ? 'review' : 'reviews';

  return <>
    <section aria-label="Assigned reviews" className="r10-reviews-queue">
      <div className="r10-toolbar">
        <label className="r10-search">
          <span className="sr-only">Search reviews</span>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search reviews"
            maxLength={120}
            placeholder="Search subtask or parent task…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" aria-label="Clear review search" onClick={() => setQuery('')}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
        <div className="r10-inline-controls">
          <div className="r10-quick-filters" role="group" aria-label="Filter reviews by type">
            {([
              ['all', 'All'],
              ['completion', 'Completion reviews'],
              ['progress', 'Progress updates'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={kindFilter === key}
                className={`r10-quick-chip ${kindFilter === key ? 'is-active' : ''}`}
                onClick={() => setKindFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {openError && <p role="alert" className="mb-3">{openError}</p>}
      {error ? <FeedbackState tone="error" title={error} onRetry={() => void refresh()}/>
        : !rows ? <p role="status" className="r10-result-count">Loading reviews…</p>
        : <>
          <p id="assigned-subtask-reviews-title" tabIndex={-1} role="status" className="r10-result-count">
            {visibleRows.length} {reviewWord}
          </p>
          {!rows.length ? (
            <EmptyState
              size="page"
              illustration="inbox"
              title="No reviews waiting"
              description="Subtask completion submissions and progress check-ins awaiting your decision will appear here."
            />
          ) : !visibleRows.length ? (
            <EmptyState
              size="page"
              illustration="search"
              title={
                kindFilter === 'completion'
                  ? 'No matching completion reviews'
                  : kindFilter === 'progress'
                    ? 'No matching progress updates'
                    : 'No matching reviews'
              }
              description="Try another search term or clear your review type filter."
              action={hasFilter ? <Button type="button" variant="outline" onClick={() => { setKindFilter('all'); setQuery(''); }}>Clear search and filters</Button> : undefined}
            />
          ) : (
            <ul className="r10-review-list">{visibleRows.map(row => <li key={row.id} className="r10-review-card">
              <div className="r10-review-card__main">
                <div className="r10-review-card__head">
                  <h3>{row.subtask_title}</h3>
                  <span className={`r10-review-kind ${row.kind === 'completion' ? 'is-completion' : 'is-progress'}`}>
                    {row.kind === 'completion' ? 'Completion submission' : 'Progress update'}
                  </span>
                </div>
                <p className="r10-review-card__meta">
                  <span>{row.task_title}</span>
                  {row.submitted_at && <span> · Submitted {formatRelativeTime(row.submitted_at)}</span>}
                </p>
                {row.cash_blocked && (
                  <div className="r10-review-card__alert">
                    <AttentionBox type="warning" text="Work can be accepted now. Required receipts and settlement still block final completion." />
                  </div>
                )}
              </div>
              <div className="r10-review-card__actions">
                <VibeButton kind="secondary" size="small" disabled={opening} onClick={event => void openReview(row.root_id, row.node_id, event.currentTarget)}>
                  Open review<span className="sr-only"> for {row.subtask_title}</span>
                </VibeButton>
              </div>
            </li>)}</ul>
          )}
        </>}
    </section>
    {selection && <SubtaskWorkDrawer presentation="dialog" subtask={selection.item} parentTask={selection.item.parentTask}
      origin={selection.origin} initialSection="work" onClose={() => { setSelection(undefined); void refresh(); }}/>}
  </>;
}
