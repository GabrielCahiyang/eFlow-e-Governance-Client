import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import type {
  MemberWorkloadHiddenCounts,
  WorkloadCommitmentItem,
  WorkloadItemKind,
} from '../types';
import { formatLoadPoints } from '../selectors/workloadProjection';
import '../workload.css';

type FilterTab = 'all' | 'projects' | 'task_leads' | 'contributors' | 'subtasks' | 'reviews';

const ROLE_LABELS: Record<WorkloadItemKind, string> = {
  project_lead: 'Project Lead',
  task_lead: 'Task Lead',
  task_contributor: 'Contributor',
  subtask_lead: 'Subtask Lead',
  subtask_contributor: 'Subtask Support',
  pending_review: 'Pending Review',
};

function matchesTab(item: WorkloadCommitmentItem, tab: FilterTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'projects') return item.kind === 'project_lead';
  if (tab === 'task_leads') return item.kind === 'task_lead';
  if (tab === 'contributors') return item.kind === 'task_contributor';
  if (tab === 'subtasks') return item.kind === 'subtask_lead' || item.kind === 'subtask_contributor';
  if (tab === 'reviews') return item.kind === 'pending_review';
  return true;
}

export function WorkloadCommitmentList({
  items,
  hiddenCounts,
  loading = false,
  error = '',
}: {
  items: WorkloadCommitmentItem[];
  hiddenCounts?: MemberWorkloadHiddenCounts;
  loading?: boolean;
  error?: string;
}) {
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      all: items.length,
      projects: items.filter((item) => item.kind === 'project_lead').length,
      task_leads: items.filter((item) => item.kind === 'task_lead').length,
      contributors: items.filter((item) => item.kind === 'task_contributor').length,
      subtasks: items.filter(
        (item) => item.kind === 'subtask_lead' || item.kind === 'subtask_contributor',
      ).length,
      reviews: items.filter((item) => item.kind === 'pending_review').length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesTab(item, tab)) return false;
      if (!q) return true;
      return `${item.title} ${item.projectTitle} ${ROLE_LABELS[item.kind]} ${item.status}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, tab, query]);

  const hiddenTotal =
    (hiddenCounts?.projects || 0) +
    (hiddenCounts?.tasks || 0) +
    (hiddenCounts?.subtasks || 0) +
    (hiddenCounts?.reviews || 0);

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'projects', label: 'Projects Led', count: counts.projects },
    { id: 'task_leads', label: 'Task Leads', count: counts.task_leads },
    { id: 'contributors', label: 'Contributor', count: counts.contributors },
    { id: 'subtasks', label: 'Subtasks', count: counts.subtasks },
    { id: 'reviews', label: 'Reviews', count: counts.reviews },
  ];

  return (
    <div className="wl-breakdown" aria-label="Current active commitments">
      <div className="wl-breakdown__controls">
        <div className="wl-tabs" role="tablist" aria-label="Filter commitments by role">
          {tabs
            .filter((t) => t.id === 'all' || t.count > 0)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className="wl-tab"
                onClick={() => setTab(t.id)}
              >
                {t.label} ({t.count})
              </button>
            ))}
        </div>
        {items.length > 0 && (
          <div className="wl-search">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              maxLength={INPUT_LIMITS.SEARCH}
              aria-label="Filter commitments"
              placeholder="Filter tasks or projects…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}
      </div>

      {loading && items.length === 0 ? (
        <p role="status" className="wl-item__meta">
          Loading active projects, tasks, subtasks, and pending reviews…
        </p>
      ) : error ? (
        <p role="alert" className="wl-override__error">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <p className="wl-item__meta">
          {items.length === 0
            ? 'No visible open projects, tasks, subtasks, or reviews.'
            : 'No commitments match this filter.'}
        </p>
      ) : (
        <ul className="wl-item-list">
          {filtered.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className={`wl-item${item.isOverdue ? ' wl-item--overdue' : ''}`}
            >
              <div className="wl-item__main">
                <div className="wl-item__title-row">
                  <span className="wl-role-chip">{ROLE_LABELS[item.kind]}</span>
                  <span className="wl-item__title">{item.title}</span>
                  {item.isOverdue && (
                    <span className="wl-tag wl-tag--overloaded">Overdue</span>
                  )}
                  {!item.isOverdue && item.isDueSoon && (
                    <span className="wl-tag wl-tag--heavy">Due soon</span>
                  )}
                </div>
                <span className="wl-item__meta">
                  {item.kind === 'project_lead'
                    ? `Project status: ${item.status.replace(/_/g, ' ')}`
                    : `${item.projectTitle} · ${item.status.replace(/_/g, ' ')}`}
                </span>
              </div>
              <div className="wl-item__right">
                <strong>+{formatLoadPoints(item.points)} pts</strong>
                <span className="wl-item__meta">
                  {item.dueDate ? `Due ${formatManilaDate(item.dueDate)}` : 'No due date'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hiddenTotal > 0 && (
        <p className="wl-hidden-note" role="note">
          Also carrying{' '}
          {[
            hiddenCounts?.projects ? `${hiddenCounts.projects} private/other-office project(s)` : '',
            hiddenCounts?.tasks ? `${hiddenCounts.tasks} private/other-office task(s)` : '',
            hiddenCounts?.subtasks ? `${hiddenCounts.subtasks} subtask(s)` : '',
            hiddenCounts?.reviews ? `${hiddenCounts.reviews} review(s)` : '',
          ]
            .filter(Boolean)
            .join(', ')}{' '}
          included in the total load score.
        </p>
      )}
    </div>
  );
}
