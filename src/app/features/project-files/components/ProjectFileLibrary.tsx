import { readableUiError } from '../../../shared/userFacingError';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, FileText, FolderPlus, Search, Trash2, Unlink2, UploadCloud } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { PROJECT_FILE_ACCEPT, validateProjectFile } from '../constants';
import { fetchProjectFiles, openProjectFile, projectFileCommand, uploadProjectFile } from '../services/projectFileService';
import type { ProjectFile, ProjectFileSnapshot, ProjectUploadDraft } from '../types';
import '../projectFiles.css';

export function ProjectFileLibrary({ projectId, taskId, readOnly = false }: { projectId: string; taskId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  return <ProjectFileLibraryContent key={`${user?.id || ''}:${projectId}:${taskId || ''}`} projectId={projectId} taskId={taskId} readOnly={readOnly} />;
}

function ProjectFileLibraryContent({ projectId, taskId, readOnly = false }: { projectId: string; taskId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<ProjectFileSnapshot>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const [draft, setDraft] = useState<ProjectUploadDraft>(),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState(false),
    [search, setSearch] = useState('');
  const input = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    mounted = useRef(true);
  const uploadId = useId(),
    searchId = useId();
  const guard = useExplicitDraft('Project file upload', !!draft, busy, () => {
    setDraft(undefined);
    if (input.current) input.current.value = '';
  });

  async function refresh() {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    setData(undefined);
    try {
      const next = await fetchProjectFiles(projectId, taskId);
      if (mounted.current && current === generation.current) setData(next);
    } catch (reason) {
      if (mounted.current && current === generation.current) setError(readableUiError(reason, 'Could not load project files.', 'read'));
    } finally {
      if (mounted.current && current === generation.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const reload = () => {
      if (!guard.pendingRef.current) void refresh();
    };
    window.addEventListener('focus', reload);
    return () => {
      mounted.current = false;
      ++generation.current;
      window.removeEventListener('focus', reload);
    };
  }, [projectId, taskId, user?.id]);

  const canWrite = !readOnly && !!data?.can_write;

  async function run(action: () => Promise<unknown>, message: string, upload = false) {
    if (guard.pendingRef.current || !canWrite) return;
    guard.pendingRef.current = true;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await action();
      if (upload) {
        setDraft(undefined);
        if (input.current) input.current.value = '';
      }
      guard.markClean();
      setSaved(message);
      await refresh();
    } catch (reason) {
      setError(readableUiError(reason, 'Could not save project file.', 'write'));
    } finally {
      guard.pendingRef.current = false;
      setBusy(false);
    }
  }

  async function open(file: ProjectFile) {
    try {
      const url = await openProjectFile(file);
      if (mounted.current) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) {
      setError(readableUiError(reason, 'Could not open file.', 'read'));
    }
  }

  const files = data?.files || [];
  const attached = taskId ? files.filter((f) => f.linked) : files;
  const availableToLink = files.filter((f) => !f.linked);
  const filteredLibrary = availableToLink.filter((f) => {
    const q = search.trim().toLocaleLowerCase();
    return !q || `${f.file_name} ${f.uploader_name}`.toLocaleLowerCase().includes(q);
  });

  return (
    <section aria-label="Project documents" className="r6-file-library">
      <div className="r6-library-header">
        <div className="r6-library-heading">
          <div className="r6-library-title-row">
            <h3>Project documents</h3>
            {!loading && data && (
              <span className="r6-library-count">
                {attached.length} {taskId ? 'linked' : attached.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>
          <p className="r6-library-subtitle">
            Shared reference files for this project — separate from formal task submission evidence.
          </p>
        </div>
        {canWrite && taskId && (
          <div className="r6-library-actions">
            <button
              type="button"
              className="r6-btn"
              disabled={busy || !!draft}
              aria-expanded={picker}
              onClick={() => setPicker(!picker)}
            >
              <FolderPlus size={14} aria-hidden="true" />
              <span>Insert from project library</span>
            </button>
          </div>
        )}
      </div>

      {loading && <p role="status" className="text-xs text-muted-foreground">Loading project files…</p>}
      {error && (
        <div role="alert" className="r6-file-alert">
          <p>{error}</p>
          <button type="button" className="r6-btn" disabled={busy} onClick={() => void refresh()}>
            Retry project files
          </button>
        </div>
      )}
      {saved && <p role="status" className="r6-file-status">{saved}</p>}

      {canWrite && (
        <div className={`r6-upload-dropzone ${busy || draft ? 'is-disabled' : ''}`}>
          <span className="r6-upload-dropzone__lead">
            <span className="r6-upload-dropzone__icon" aria-hidden="true">
              <UploadCloud size={17} />
            </span>
            <span className="r6-upload-dropzone__copy">
              <label htmlFor={uploadId} className="r6-upload-dropzone__title">Upload a project document</label>
              <span className="r6-upload-dropzone__hint">PDF, text, images, DOCX or XLSX · Up to 10 MB</span>
            </span>
          </span>
          <span className="r6-upload-dropzone__cta" aria-hidden="true">Choose file</span>
          <input
            id={uploadId}
            ref={input}
            aria-label="Upload a project document"
            className="r6-upload-input"
            type="file"
            accept={PROJECT_FILE_ACCEPT}
            disabled={busy || !!draft}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const invalid = validateProjectFile(file);
              setError(invalid);
              setSaved('');
              if (!invalid) setDraft({ id: crypto.randomUUID(), file });
              else e.target.value = '';
            }}
          />
        </div>
      )}

      {canWrite && draft && (
        <div className="r6-draft-card">
          <div className="r6-draft-card__meta">
            <FileText size={16} aria-hidden="true" />
            <span className="r6-draft-card__name">{draft.file.name}</span>
            <span className="r6-draft-card__size">({Math.max(1, Math.ceil(draft.file.size / 1024))} KB)</span>
          </div>
          <div className="r6-library-actions">
            <button
              type="button"
              className="r6-btn r6-btn--primary"
              disabled={busy}
              onClick={() => void run(() => uploadProjectFile(projectId, taskId, draft), 'Document saved to the project library.', true)}
            >
              {busy ? 'Uploading…' : 'Save document / retry'}
            </button>
            <button
              type="button"
              className="r6-btn"
              disabled={busy}
              onClick={() => {
                setDraft(undefined);
                if (input.current) input.current.value = '';
              }}
            >
              Discard upload draft
            </button>
          </div>
        </div>
      )}

      {picker && canWrite && (
        <section aria-label="Insert project document" className="r6-library-picker">
          <div className="r6-library-picker__head">
            <span className="r6-library-picker__title">
              Project library ({availableToLink.length} available to link)
            </span>
          </div>
          <label className="r6-library-picker__search" htmlFor={searchId}>
            <span className="r6-library-picker__search-label">Find a project document</span>
            <span className="r6-library-picker__search-box">
              <Search size={14} aria-hidden="true" />
              <input
                id={searchId}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                placeholder="Search by file name or uploader…"
              />
            </span>
          </label>
          {filteredLibrary.length > 0 ? (
            <div className="r6-library-picker__list">
              {filteredLibrary.map((file) => (
                <div key={file.id} className="r6-library-picker__row">
                  <span className="break-all text-foreground">
                    {file.file_name} · <span className="text-muted-foreground">{file.uploader_name}</span>
                  </span>
                  <div className="r6-library-actions">
                    <button
                      type="button"
                      className="r6-btn r6-btn--primary"
                      disabled={busy || !!draft}
                      onClick={() => void run(() => projectFileCommand(projectId, taskId, 'link', { id: file.id }), 'Project document linked.')}
                    >
                      Insert {file.file_name}
                    </button>
                    {file.can_remove && !file.links && (
                      <button
                        type="button"
                        className="r6-btn r6-btn--danger"
                        disabled={busy || !!draft}
                        onClick={() => void run(() => projectFileCommand(projectId, taskId, 'remove', { id: file.id }), 'Document removed from library.')}
                      >
                        Remove {file.file_name}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="r6-library-picker__empty">
              {availableToLink.length === 0
                ? 'No other files in this project library yet. Upload a document above to add one.'
                : 'No project documents match your search.'}
            </p>
          )}
        </section>
      )}

      {!loading && data && !attached.length && (
        <EmptyState
          illustration="files"
          title={taskId ? 'No general documents linked to this task.' : 'No general documents in this project.'}
          description={canWrite && taskId ? 'Upload a file above or link an existing file from the project library.' : undefined}
          size="compact"
        />
      )}

      {attached.length > 0 && (
        <ul className="r6-file-list">
          {attached.map((file) => (
            <li key={file.id} className="r6-file-card">
              <div className="r6-file-card__main">
                <span className="r6-file-card__icon" aria-hidden="true">
                  <FileText size={15} />
                </span>
                <div className="r6-file-card__info">
                  <button type="button" className="r6-file-card__link" onClick={() => void open(file)}>
                    <span>{file.file_name}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </button>
                  <p className="r6-file-card__meta">
                    Uploaded by {file.uploader_name} · {new Date(file.created_at).toLocaleDateString()} · {Math.ceil(file.file_size / 1024)} KB
                  </p>
                  <p className="r6-file-card__meta">
                    Source: this project library{file.link ? ` · Linked ${new Date(file.link.linked_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              {canWrite && (
                <div className="r6-file-card__actions">
                  {taskId && (
                    <button
                      type="button"
                      className="r6-btn"
                      disabled={busy || !!draft}
                      onClick={() => void run(() => projectFileCommand(projectId, taskId, 'unlink', { id: file.id }), 'Document unlinked. Source retained in the project library.')}
                    >
                      <Unlink2 size={13} aria-hidden="true" />
                      <span>Unlink document</span>
                    </button>
                  )}
                  {file.can_remove && !file.links && (
                    <button
                      type="button"
                      className="r6-btn r6-btn--danger"
                      disabled={busy || !!draft}
                      onClick={() => void run(() => projectFileCommand(projectId, taskId, 'remove', { id: file.id }), 'Document removed from the library; provenance retained.')}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Remove from library</span>
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
