import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { fetchNotificationSubitem, useNotificationNavigationIntent } from '../../notifications';
import { SubtaskWorkDrawer } from '../../subtasks';
import type { TaskInspectorOrigin } from '../../task-inspector';
import { subscribeWorkChanges } from '../../../shared/workChanges';
import { requestNavigation } from '../../../shared/navigationGuard';
import { fetchAssignedSubtaskReviews, type AssignedSubtaskReview } from '../services/assignedSubtaskReviews';

type OpenSubtask = Awaited<ReturnType<typeof fetchNotificationSubitem>>;

export function AssignedSubtaskReviews({ actor }: { actor: string }) {
  const [rows, setRows] = useState<AssignedSubtaskReview[]>();
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [selection, setSelection] = useState<{ item: OpenSubtask; origin: TaskInspectorOrigin }>();
  const read = useRef(0);
  const open = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++read.current;
    try {
      const data = await fetchAssignedSubtaskReviews();
      if (run === read.current) { setRows(data); setError(''); }
    } catch {
      if (run === read.current) { setRows(undefined); setError('Could not load your assigned reviews.'); }
    }
  }, []);
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

  return <>
    <section hidden={!!selection} aria-labelledby="assigned-subtask-reviews-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="assigned-subtask-reviews-title" tabIndex={-1} className="text-lg font-semibold">Subtask reviews</h2>
          <p className="text-sm text-muted-foreground">Review completion submissions and progress updates assigned to you.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()}>Refresh reviews</Button>
      </div>
      {openError && <p role="alert" className="mb-3">{openError}</p>}
      {error ? <FeedbackState tone="error" title={error} onRetry={() => void refresh()}/>
        : !rows ? <p role="status">Loading reviews…</p>
        : !rows.length ? <EmptyState illustration="complete" title="No reviews waiting" description="Assigned subtask submissions will appear here."/>
        : <ul className="grid gap-2">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div>
            <h3 className="font-semibold">{row.subtask_title}</h3>
            <p className="text-sm text-muted-foreground">{row.task_title} · {row.kind === 'completion' ? 'Completion submission' : 'Progress update'}</p>
            {row.cash_blocked && <p className="mt-1 text-sm text-amber-800">Completion is waiting for cash settlement.</p>}
          </div>
          <Button type="button" variant="outline" disabled={opening} onClick={event => void openReview(row.root_id, row.node_id, event.currentTarget)}>Open review<span className="sr-only"> for {row.subtask_title}</span></Button>
        </li>)}</ul>}
    </section>
    {selection && <SubtaskWorkDrawer subtask={selection.item} parentTask={selection.item.parentTask}
      origin={selection.origin} initialSection="work" onClose={() => { setSelection(undefined); void refresh(); }}/>}
  </>;
}
