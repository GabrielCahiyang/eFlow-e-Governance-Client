import { readableUiError } from '../../../shared/userFacingError';
import { useState, type FormEvent } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { StatusPill, WorkspaceHeader } from '../../../components/ui/workspace';
import { builtInStatuses, useWorkStatuses, type StatusDefinition, type StatusScope } from '../../work-status';
import './statusMaintenance.css';

const scopeLabels: Record<StatusScope, string> = {
  builtin: 'Built-in', both: 'Tasks and subtasks', task: 'Tasks', subtask: 'Subtasks',
};

export function StatusMaintenance({ embedded = false }: { embedded?: boolean }) {
  const catalog = useWorkStatuses();
  const [draft, setDraft] = useState<StatusDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const builtIn = Object.entries(builtInStatuses).map(([id, label], index): StatusDefinition =>
    catalog.definitions.find(item => item.id === id) ??
      { id, label, color: null, position: (index + 1) * 10, scope: 'builtin', retired: false });
  const custom = catalog.definitions.filter(item => item.scope !== 'builtin');

  function edit(item: StatusDefinition) {
    setError('');
    setNotice('');
    setDraft(item);
  }

  function closeDraft() {
    if (busy) return;
    setError('');
    setDraft(null);
  }

  async function persistDefinition(next: StatusDefinition, successNotice: string, fallbackError: string) {
    if (busy) return;
    if (!next.retired && [...builtIn, ...custom].some(item =>
      item.id !== next.id && !item.retired && item.label.toLowerCase() === next.label.toLowerCase())) {
      return setError('That status name is already in use.');
    }
    setBusy(true);
    setError('');
    try {
      await catalog.save(next);
      setDraft(null);
      setNotice(successNotice);
    } catch (reason) {
      setError(readableUiError(reason, fallbackError, 'write'));
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    const label = draft.label.trim().replace(/\s+/g, ' ');
    if (!label) return setError('Enter a status name.');
    await persistDefinition({ ...draft, label }, 'Status updated.', 'Could not save this status.');
  }

  async function restoreDefault() {
    if (!draft || draft.scope !== 'builtin' || busy) return;
    const defaultLabel = builtInStatuses[draft.id as keyof typeof builtInStatuses];
    if (!defaultLabel) return;
    await persistDefinition(
      { ...draft, label: defaultLabel, color: null, retired: false },
      `Restored “${defaultLabel}” to default.`,
      'Could not restore the default status.',
    );
  }

  const defaultBuiltInLabel = draft?.scope === 'builtin'
    ? builtInStatuses[draft.id as keyof typeof builtInStatuses]
    : undefined;
  const savedBuiltIn = draft?.scope === 'builtin'
    ? builtIn.find(item => item.id === draft.id)
    : undefined;
  const canRestoreBuiltInDefault = Boolean(
    draft && defaultBuiltInLabel && (
      draft.label.trim().replace(/\s+/g, ' ') !== defaultBuiltInLabel
      || Boolean(draft.color)
      || (savedBuiltIn ? savedBuiltIn.label !== defaultBuiltInLabel || Boolean(savedBuiltIn.color) : false)
    ),
  );
  const dialogTitle = draft?.label ? `Edit “${draft.label}”` : 'Create custom status';

  function table(items: StatusDefinition[]) {
    return (
      <div className="status-maintenance-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Applies to</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {[...items].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label)).map(item => (
              <tr key={item.id}>
                <td>
                  <span className="status-maintenance-swatch" aria-hidden="true" style={{ backgroundColor: item.color ?? undefined }} />
                  <span className="font-medium text-[var(--eflow-text)]">{item.label}</span>
                  {item.scope === 'builtin' && item.label !== builtInStatuses[item.id as keyof typeof builtInStatuses] && (
                    <small>Default: {builtInStatuses[item.id as keyof typeof builtInStatuses]}</small>
                  )}
                  {item.retired && (
                    <span className="ml-2 inline-flex align-middle">
                      <StatusPill label="Retired" tone="neutral" />
                    </span>
                  )}
                </td>
                <td>{item.scope === 'builtin' ? (['planning', 'active', 'on_hold'].includes(item.id) ? 'Projects' : ['completed', 'archived'].includes(item.id) ? 'Work & projects' : 'Work') : scopeLabels[item.scope]}</td>
                <td>
                  <Button type="button" variant="outline" size="sm" aria-label={`Edit ${item.label}`} disabled={busy} onClick={() => edit(item)}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="status-maintenance">
      {!embedded ? (
        <WorkspaceHeader
          title="Status Maintenance"
          description="Customize the status labels and colors teams see on tasks, subtasks, and projects."
        />
      ) : (
        <div className="eflow-admin-subsection-header">
          <div>
            <h2>Work statuses</h2>
            <p className="eflow-admin-copy">
              Customize status names and badge colors across tasks, subtasks, and projects. Review and completion workflows stay unchanged.
            </p>
          </div>
        </div>
      )}
      {catalog.error && <FeedbackState tone="error" title="Could not load statuses">{catalog.error}</FeedbackState>}
      {!catalog.ready && !catalog.error && (
        <div role="status" className="eflow-admin-card animate-pulse text-sm text-[var(--eflow-text-muted)]">
          Loading statuses…
        </div>
      )}
      {notice && <FeedbackState tone="success" title="Saved">{notice}</FeedbackState>}
      {catalog.ready && (
        <section className="eflow-admin-card space-y-4">
          <div>
            <h3>Core workflow statuses</h3>
            <p className="eflow-admin-copy">Rename core statuses or customize their colors without changing approval steps.</p>
          </div>
          {table(builtIn)}
        </section>
      )}
      {draft && (
        <FeatureDialog
          title={dialogTitle}
          description="Edit the status name and badge color, or restore a built-in status to its default settings."
          onClose={closeDraft}
          preventClose={busy}
          contentClassName="max-w-lg"
        >
          <form className="status-maintenance-dialog-form" onSubmit={save}>
            <div className="status-maintenance-dialog-header">
              <h2>{dialogTitle}</h2>
              {draft.scope === 'builtin' && defaultBuiltInLabel && (
                <StatusPill label={`Built-in · ${defaultBuiltInLabel}`} tone="info" />
              )}
            </div>
            <div className="status-maintenance-fields">
              <label>
                Status name
                <input
                  required
                  maxLength={50}
                  value={draft.label}
                  disabled={busy}
                  onChange={event => setDraft({ ...draft, label: event.target.value })}
                />
              </label>
              <label>
                Badge color
                <input
                  type="color"
                  value={draft.color || '#0c6f6b'}
                  disabled={busy}
                  onChange={event => setDraft({ ...draft, color: event.target.value })}
                />
              </label>
              {draft.scope !== 'builtin' && (
                <label>
                  Applies to
                  <select
                    value={draft.scope}
                    disabled={busy}
                    onChange={event => setDraft({ ...draft, scope: event.target.value as StatusScope })}
                  >
                    <option value="both">Tasks and subtasks</option>
                    <option value="task">Tasks only</option>
                    <option value="subtask">Subtasks only</option>
                  </select>
                </label>
              )}
            </div>
            {draft.scope !== 'builtin' && (
              <label className="status-maintenance-retire">
                <input
                  type="checkbox"
                  checked={draft.retired}
                  disabled={busy}
                  onChange={event => setDraft({ ...draft, retired: event.target.checked })}
                />
                <span>Hide from new items (keeps label visible on existing work)</span>
              </label>
            )}
            {error && <FeedbackState tone="error" title="Check status details">{error}</FeedbackState>}
            <div className="status-maintenance-dialog-footer">
              <div className="status-maintenance-dialog-reset">
                {canRestoreBuiltInDefault && (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void restoreDefault()}>
                    <RotateCcw size={13} aria-hidden="true" /> Back to default
                  </Button>
                )}
                {draft.color && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDraft({ ...draft, color: null })}>
                    Reset color
                  </Button>
                )}
              </div>
              <div className="status-maintenance-actions">
                <Button type="button" variant="outline" disabled={busy} onClick={closeDraft}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save status'}
                </Button>
              </div>
            </div>
          </form>
        </FeatureDialog>
      )}
    </section>
  );
}
