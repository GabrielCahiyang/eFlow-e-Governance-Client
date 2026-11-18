import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, FileText, FolderOpen, RefreshCw } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate } from '../../../components/workflow/primitives';
import { readableUiError } from '../../../shared/userFacingError';
import type { WorkTreeSnapshot } from '../../nested-work';
import { ProjectFileLibrary } from '../../project-files';
import { fetchInspectorFiles, openInspectorFile, type InspectorFile } from '../../task-inspector';
import { fetchSubitemLeadReview, openSubitemReviewEvidence } from '../services/subitemLeadReview';

type SubtaskModalFile = {
  id: string;
  name: string;
  source: string;
  uploader: string;
  at: string;
  restriction: string;
  openUrl: () => Promise<string>;
};

export interface SubitemFilesPanelProps {
  rootTaskId: string;
  subtaskId: string;
  projectId: string;
  kind: 'office' | 'personal';
  people: WorkTreeSnapshot['people'];
}

/** Dedicated modal body for subtask workflow files and related project documents. */
export function SubitemFilesPanel({
  rootTaskId,
  subtaskId,
  projectId,
  kind,
  people,
}: SubitemFilesPanelProps) {
  const [subtaskFiles, setSubtaskFiles] = useState<SubtaskModalFile[]>([]);
  const [taskFiles, setTaskFiles] = useState<InspectorFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openError, setOpenError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [inspectorFiles, proposalData] = await Promise.all([
        fetchInspectorFiles(rootTaskId),
        kind === 'office' ? fetchSubitemLeadReview(rootTaskId, subtaskId).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      const scopedInspector = inspectorFiles.filter((file) => file.subtaskId === subtaskId);
      const otherTaskFiles = inspectorFiles.filter((file) => !file.subtaskId);
      const mappedInspector: SubtaskModalFile[] = scopedInspector.map((file) => ({
        id: file.id,
        name: file.name,
        source: file.source,
        uploader: file.uploader,
        at: file.at,
        restriction: file.restriction,
        openUrl: () => openInspectorFile(file),
      }));
      const proposalAttachments: SubtaskModalFile[] = [];
      for (const item of proposalData?.items ?? []) {
        const author = people.find((person) => person.id === item.author_id)?.name || 'Work contributor';
        const stateLabel = item.state === 'approved' ? 'approved' : item.state === 'changes_requested' ? 'changes requested' : 'awaiting approval';
        const kindLabel = item.kind === 'completion' ? 'Completion submission' : 'Progress submission';
        for (const [index, attachment] of (item.terms.attachments ?? []).entries()) {
          proposalAttachments.push({
            id: `m7-${item.id}-${index}`,
            name: attachment.fileName,
            source: `${kindLabel} (${stateLabel})`,
            uploader: author,
            at: '',
            restriction: 'Work proposal evidence · Original Lead review rules apply',
            openUrl: () => openSubitemReviewEvidence(attachment.filePath),
          });
        }
      }
      setSubtaskFiles([...proposalAttachments, ...mappedInspector]);
      setTaskFiles(otherTaskFiles);
    } catch (reason) {
      setError(readableUiError(reason, 'Could not load subtask files.', 'read'));
    } finally {
      setLoading(false);
    }
  }, [kind, people, rootTaskId, subtaskId]);

  useEffect(() => {
    void loadFiles();
    const refresh = () => void loadFiles();
    window.addEventListener('eflow:work-updated', refresh);
    return () => window.removeEventListener('eflow:work-updated', refresh);
  }, [loadFiles, retryCount]);

  async function openFile(openUrl: () => Promise<string>) {
    setOpenError('');
    try {
      window.open(await openUrl(), '_blank', 'noopener,noreferrer');
    } catch (reason) {
      setOpenError(readableUiError(reason, 'Could not open file.', 'read'));
    }
  }

  return (
    <section className="subitem-action-shell" aria-label="Subtask files">
      <header className="subitem-action-heading">
        <div className="subitem-action-heading__icon" aria-hidden="true">
          <FolderOpen size={22} />
        </div>
        <div className="subitem-action-heading__copy">
          <h3>Files &amp; attachments</h3>
          <p>Attachments from updates, submissions, proposals, and related work.</p>
        </div>
        <div className="subitem-action-heading__meta">
          {!loading && !error && (
            <span className={`subitem-action-pill ${subtaskFiles.length > 0 ? 'subitem-action-pill--accent' : ''}`}>
              {subtaskFiles.length} {subtaskFiles.length === 1 ? 'file' : 'files'}
            </span>
          )}
          <button
            type="button"
            className="subitem-action-btn"
            disabled={loading}
            onClick={() => setRetryCount((c) => c + 1)}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <article className="subitem-action-card" aria-label="Subtask workflow files">
        <header className="subitem-action-card__header">
          <div>
            <h4 className="subitem-action-card__title">Subtask workflow files</h4>
            <p className="subitem-action-card__subtitle">
              Progress updates, submission evidence, and proposal attachments retain their original access rules.
            </p>
          </div>
          {!loading && !error && (
            <span className="r6-library-count">
              {subtaskFiles.length} {subtaskFiles.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </header>

        <div className="subitem-action-card__body">
          {loading && <p role="status" className="task-page__muted">Loading subtask files…</p>}
          {error && (
            <div role="alert" className="subitem-action-alert">
              <span>{error}</span>
              <button type="button" className="subitem-action-btn" onClick={() => setRetryCount((c) => c + 1)}>
                Retry files
              </button>
            </div>
          )}
          {openError && <div role="alert" className="subitem-action-alert mb-3"><span>{openError}</span></div>}
          {!loading && !error && !subtaskFiles.length && (
            <EmptyState
              illustration="files"
              size="compact"
              title="No authorized subtask attachments yet."
              description="Files attached to work updates or formal submissions on this subtask appear here."
            />
          )}
          {subtaskFiles.length > 0 && (
            <ul className="subitem-action-list">
              {subtaskFiles.map((file) => (
                <li key={file.id} className="subitem-action-file">
                  <div className="subitem-action-file__head">
                    <span className="subitem-action-file__icon" aria-hidden="true">
                      <FileText size={15} />
                    </span>
                    <button type="button" className="subitem-action-file__link" onClick={() => void openFile(file.openUrl)}>
                      <span>{file.name}</span>
                      <ExternalLink size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="subitem-action-file__meta">
                    {file.source} · {file.uploader} · {file.at ? formatDate(file.at) : 'Date not recorded'}
                  </p>
                  <p className="subitem-action-file__restriction">{file.restriction}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      {taskFiles.length > 0 && (
        <details className="subitem-action-details">
          <summary>
            <span>Parent task workflow files · {taskFiles.length}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="subitem-action-details__body">
            <ul className="subitem-action-list">
              {taskFiles.map((file) => (
                <li key={file.id} className="subitem-action-file">
                  <div className="subitem-action-file__head">
                    <span className="subitem-action-file__icon" aria-hidden="true">
                      <FileText size={15} />
                    </span>
                    <button type="button" className="subitem-action-file__link" onClick={() => void openFile(() => openInspectorFile(file))}>
                      <span>{file.name}</span>
                      <ExternalLink size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="subitem-action-file__meta">
                    {file.source} · {file.uploader} · {file.at ? formatDate(file.at) : 'Date not recorded'}
                  </p>
                  <p className="subitem-action-file__restriction">{file.restriction}</p>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {kind === 'office' && projectId && (
        <details className="subitem-action-details">
          <summary>
            <span>Linked project library files</span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="subitem-action-details__body">
            <ProjectFileLibrary projectId={projectId} taskId={rootTaskId} readOnly />
          </div>
        </details>
      )}
    </section>
  );
}
