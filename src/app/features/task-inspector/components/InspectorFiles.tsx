import { readableUiError } from '../../../shared/userFacingError';
import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { Task } from '../../tasks';
import { fetchInspectorFiles, openInspectorFile, type InspectorFile } from '../services/inspectorFileService';

export function InspectorFiles({ task }: { task: Task; readOnly?: boolean }) {
  const [files, setFiles] = useState<InspectorFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setFiles([]); setLoading(true); setError('');
    void fetchInspectorFiles(task.id)
      .then(next => { if (active) setFiles(next); })
      .catch(reason => { if (active) setError(readableUiError(reason, "Could not load workflow files.", 'read')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [task.id, task.latestSubmission?.id, retry]);

  async function open(file: InspectorFile) {
    try { window.open(await openInspectorFile(file), '_blank', 'noopener,noreferrer'); }
    catch (reason) { setError(readableUiError(reason, "Could not open evidence.", 'read')); }
  }

  return (
    <div className="task-page__stack">
      <section aria-label="Workflow files" className="task-page__card task-files-card">
        <div className="task-page__card-heading">
          <div className="flex flex-wrap items-center gap-2">
            <h3>Workflow evidence</h3>
            {!loading && !error && (
              <span className="r6-library-count">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>
          <p>Formal task and subtask submission attachments keep their original access and approval rules.</p>
        </div>
        {loading && <p role="status" className="task-page__muted">Loading workflow files…</p>}
        {error && <div role="alert" className="task-page__alert"><p>{error}</p><button type="button" onClick={() => setRetry(r => r + 1)}>Retry workflow files</button></div>}
        {!loading && !error && !files.length && <EmptyState illustration="files" size="compact" title="No authorized workflow attachments yet." />}
        {files.length > 0 && (
          <ul className="task-files-list">
            {files.map(file => (
              <li key={file.id} className="task-files-item">
                <div className="task-files-item__head">
                  <span className="task-files-item__icon" aria-hidden="true"><FileText size={15} /></span>
                  <button type="button" className="task-files-item__link" onClick={() => void open(file)}>
                    <span>{file.name}</span>
                    <ExternalLink size={13} aria-hidden="true" />
                  </button>
                </div>
                <p className="task-files-item__meta">{file.source} · {file.uploader} · {file.at ? new Date(file.at).toLocaleDateString() : 'Date not recorded'}</p>
                <p className="task-files-item__restriction">{file.restriction}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
