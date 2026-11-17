import { EmptyState } from '../../../components/ui/EmptyState';
import { useEffect, useState } from 'react';
import { subscribeToProgressUpdates, type ProgressUpdate } from '../../tasks';

export function InspectorProgressUpdates({ taskId }: { taskId: string }) {
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setLoading(true); setUpdates([]); setError('');
    return subscribeToProgressUpdates(
      taskId,
      next => { setLoading(false); setError(''); setUpdates(next); },
      message => { setLoading(false); setError(message); setUpdates([]); },
    );
  }, [taskId, retry]);

  return (
    <section aria-label="Progress updates" className="task-updates-feed">
      <h3 className="task-updates-feed__title">Progress updates</h3>
      {loading && <p role="status" className="task-page__muted">Loading progress updates…</p>}
      {error && <div role="alert" className="task-page__alert"><p>{error}</p><button type="button" onClick={() => setRetry(r => r + 1)}>Retry progress updates</button></div>}
      {!loading && !error && !updates.length && <EmptyState illustration="tasks" size="compact" title="No progress updates yet." />}
      {updates.map(update => (
        <article key={update.id} className="task-updates-feed__item">
          <header className="task-updates-feed__head">
            <span className="task-updates-feed__author">{update.authorName}</span>
            <span className={update.blocker ? 'task-update-step-badge task-update-step-badge--stuck' : 'task-update-step-badge task-update-step-badge--in_progress'}>
              {update.blocker ? 'Stuck' : 'Work update'}
            </span>
            <time className="task-updates-feed__time">{new Date(update.createdAt).toLocaleString()}</time>
          </header>
          {update.note ? <p className="task-updates-feed__note">{update.note}</p> : null}
          {update.blocker ? <p className="task-updates-feed__blocker">Blocker: {update.blocker}</p> : null}
          {update.nextStep ? <p className="task-updates-feed__next">Next: {update.nextStep}</p> : null}
          {update.attachmentPath ? <p className="task-updates-feed__meta">Attachment available in Files</p> : null}
        </article>
      ))}
    </section>
  );
}
