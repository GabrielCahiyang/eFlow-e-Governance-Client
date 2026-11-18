import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Banknote, Loader2, RefreshCw } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { readableUiError } from '../../../shared/userFacingError';
import { fetchProjectExpenseTotals, peso, WorkBudgetCard } from '../../budget';
import type { Task } from '../../tasks';

type WorkSubtask = ComponentProps<typeof WorkBudgetCard>['subtask'];

export interface SubitemFundingPanelProps {
  isOffice: boolean;
  task: Task;
  subtask: WorkSubtask;
  subtaskId: string;
  canManage: boolean;
  readOnly: boolean;
  authorityPending: boolean;
}

/** Dedicated modal body for subtask budget, cash requests, and recorded expenses. */
export function SubitemFundingPanel({
  isOffice,
  task,
  subtask,
  subtaskId,
  canManage,
  readOnly,
  authorityPending,
}: SubitemFundingPanelProps) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string;
    settled?: number;
    pending?: number;
    complete: boolean;
  }>({ loading: isOffice, error: '', complete: false });
  const [retryCount, setRetryCount] = useState(0);

  const load = useCallback(async () => {
    if (!isOffice) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const totals = await fetchProjectExpenseTotals([task.id]);
      const taskTotals = totals.tasks.get(task.id);
      const subtaskTotals = totals.subtasks.get(subtaskId);
      const complete = Boolean(subtaskTotals?.complete || taskTotals?.complete);
      setState({
        loading: false,
        error: '',
        settled: subtaskTotals?.settled ?? (complete ? 0 : undefined),
        pending: subtaskTotals?.pending ?? (complete ? 0 : undefined),
        complete,
      });
    } catch (reason) {
      setState({
        loading: false,
        error: readableUiError(reason, 'Actual expense totals are unavailable.', 'read'),
        complete: false,
      });
    }
  }, [isOffice, subtaskId, task.id]);

  useEffect(() => {
    if (!isOffice) return;
    void load();
    const refresh = () => void load();
    window.addEventListener('eflow:expenses-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('eflow:expenses-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isOffice, load, retryCount]);

  if (!isOffice) {
    return (
      <section className="subitem-action-shell" aria-label="Subtask funding details">
        <header className="subitem-action-heading">
          <div className="subitem-action-heading__icon" aria-hidden="true">
            <Banknote size={22} />
          </div>
          <div className="subitem-action-heading__copy">
            <h3>Subtask funding</h3>
            <p>Budget allocation and task-linked cash requests for this step.</p>
          </div>
        </header>
        <div className="subitem-action-card">
          <div className="subitem-action-card__body">
            <EmptyState
              illustration="budget"
              size="compact"
              title="Funding unavailable"
              description="Only office subtasks have task funding controls."
            />
          </div>
        </div>
      </section>
    );
  }

  const hasTotals = state.settled != null || state.pending != null;

  return (
    <section className="subitem-action-shell" aria-label="Subtask funding details">
      <header className="subitem-action-heading">
        <div className="subitem-action-heading__icon" aria-hidden="true">
          <Banknote size={22} />
        </div>
        <div className="subitem-action-heading__copy">
          <h3>Subtask funding</h3>
          <p>Budget availability, cash requests, and recorded subtask expenses.</p>
        </div>
        <div className="subitem-action-heading__meta">
          <button
            type="button"
            className="subitem-action-btn"
            disabled={state.loading}
            onClick={() => setRetryCount((c) => c + 1)}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Refresh expenses</span>
          </button>
        </div>
      </header>

      <WorkBudgetCard
        task={task}
        subtask={subtask}
        canManage={canManage}
        readOnly={readOnly}
        authorityPending={authorityPending}
      />

      <article className="subitem-action-card" aria-label="Recorded subtask expenses">
        <header className="subitem-action-card__header">
          <div>
            <h4 className="subitem-action-card__title">Recorded subtask expenses</h4>
            <p className="subitem-action-card__subtitle">
              {state.complete
                ? 'Work totals across fiscal years and funding sources.'
                : 'Totals from cash records you can access across fiscal years.'}
            </p>
          </div>
          {!state.loading && !state.error && (
            <span className={`subitem-action-pill ${hasTotals ? 'subitem-action-pill--accent' : ''}`}>
              {state.complete ? 'All records included' : 'Accessible records'}
            </span>
          )}
        </header>

        <div className="subitem-action-card__body">
          {state.loading && !hasTotals ? (
            <div className="flex items-center gap-2 text-[13px] text-[var(--eflow-text-secondary,#61777c)]" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              <span>Loading expenses…</span>
            </div>
          ) : state.error ? (
            <div role="alert" className="subitem-action-alert">
              <span>{state.error}</span>
              <button
                type="button"
                className="subitem-action-btn"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                <RefreshCw size={13} aria-hidden="true" />
                Retry expenses
              </button>
            </div>
          ) : hasTotals ? (
            <dl className="subitem-action-metrics">
              <div className="subitem-action-metric">
                <dt>Settled expenses</dt>
                <dd>{state.settled == null ? 'Unavailable' : peso.format(state.settled / 100)}</dd>
              </div>
              <div className="subitem-action-metric">
                <dt>Pending liquidation</dt>
                <dd>{state.pending == null ? 'Unavailable' : peso.format(state.pending / 100)}</dd>
              </div>
            </dl>
          ) : (
            <p className="subitem-action-note">
              No accessible settled expenses or pending liquidations have been recorded for this subtask yet.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
