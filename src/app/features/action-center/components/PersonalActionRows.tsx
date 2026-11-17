import { ArrowRight, ClipboardCheck, GitBranch } from 'lucide-react';
import type { ActionItem } from '../selectors';

export function PersonalActionRowsSkeleton({ rows = 3 }: { rows?: number }) {
  const pulse = 'animate-pulse rounded bg-muted';
  return (
    <ul className="inbox-action-list rounded-xl border border-[var(--eflow-border)] divide-y divide-[var(--eflow-border)] bg-[var(--eflow-surface)] overflow-hidden" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className={`size-9 shrink-0 rounded-lg ${pulse}`} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className={`block h-4 w-2/5 ${pulse}`} />
            <span className={`block h-3 w-3/5 ${pulse}`} />
          </div>
          <span className={`h-7 w-20 rounded-md ${pulse}`} />
        </li>
      ))}
    </ul>
  );
}

export function PersonalActionRows({ items, onOpen }: { items: ActionItem[]; onOpen: (item: ActionItem) => void }) {
  if (!items.length) return null;
  return (
    <ul className="inbox-action-list rounded-xl border border-[var(--eflow-border)] divide-y divide-[var(--eflow-border)] bg-[var(--eflow-surface)] overflow-hidden">
      {items.map(item => {
        const isTask = item.source === 'task-review';
        const kind = isTask ? 'Task review' : 'Subtask review';
        const Icon = isTask ? ClipboardCheck : GitBranch;
        return (
          <li key={item.key}>
            <button
              data-action-key={item.key}
              onClick={() => onOpen(item)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[var(--eflow-subtle)]"
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-selected)] text-[var(--eflow-primary)]"
              >
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-[var(--eflow-text)] break-words">
                    {item.title}
                  </span>
                  <span className="rounded-[6px] border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--eflow-text-secondary)]">
                    {kind}
                  </span>
                </span>
                {item.context && item.context !== kind && (
                  <span className="mt-1 block text-[12px] text-[var(--eflow-text-muted)] break-words">
                    {item.context}
                  </span>
                )}
              </span>
              <span className="inbox-action-list__open inline-flex items-center gap-1 rounded-[6px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--eflow-primary)]">
                <span>Review</span>
                <ArrowRight size={13} aria-hidden="true" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
