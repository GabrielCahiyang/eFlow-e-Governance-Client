import { useState, type FormEvent } from 'react';
import { ListChecks, Plus } from 'lucide-react';
import { builtInStatuses, useWorkStatuses, type StatusDefinition, type StatusScope } from '../../work-status';
import './statusMaintenance.css';

const scopeLabels: Record<StatusScope, string> = {
  builtin: 'Built-in', both: 'Tasks and subtasks', task: 'Tasks', subtask: 'Subtasks',
};

export function StatusMaintenance() {
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

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    const label = draft.label.trim().replace(/\s+/g, ' ');
    if (!label) return setError('Enter a status name.');
    if (!draft.retired && [...builtIn, ...custom].some(item =>
      item.id !== draft.id && !item.retired && item.label.toLowerCase() === label.toLowerCase())) {
      return setError('That status name is already in use.');
    }
    setBusy(true);
    setError('');
    try {
      await catalog.save({ ...draft, label });
      setDraft(null);
      setNotice('Status saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this status.');
    } finally {
      setBusy(false);
    }
  }

  function table(items: StatusDefinition[]) {
    return <div className="status-maintenance-table"><table>
      <thead><tr><th scope="col">Label</th><th scope="col">Applies to</th><th scope="col">Order</th><th scope="col">Action</th></tr></thead>
      <tbody>{[...items].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label)).map(item =>
        <tr key={item.id}>
          <td><span className="status-maintenance-swatch" aria-hidden="true" style={{ backgroundColor: item.color ?? undefined }} />{item.label}
            {item.scope === 'builtin' && item.label !== builtInStatuses[item.id as keyof typeof builtInStatuses] &&
              <small>Workflow: {builtInStatuses[item.id as keyof typeof builtInStatuses]}</small>}
            {item.retired && <small>Retired</small>}</td>
          <td>{item.scope === 'builtin' ? (['planning', 'active', 'on_hold'].includes(item.id) ? 'Projects' : ['completed', 'archived'].includes(item.id) ? 'Work and projects' : 'Work') : scopeLabels[item.scope]}</td>
          <td>{item.position}</td>
          <td><button type="button" aria-label={`Edit ${item.label}`} disabled={busy} onClick={() => edit(item)}>Edit</button></td>
        </tr>)}</tbody>
    </table></div>;
  }

  return <section className="status-maintenance">
    <header className="status-maintenance-header">
      <div><h1><ListChecks size={22} aria-hidden="true" /> Status Maintenance</h1><p>Manage the labels and colors people see on their work.</p></div>
      <button type="button" className="status-maintenance-primary" disabled={!catalog.ready || busy}
        onClick={() => edit({ id: crypto.randomUUID(), label: '', color: null, position: 100, scope: 'both', retired: false })}>
        <Plus size={16} aria-hidden="true" /> Add status
      </button>
    </header>
    {catalog.error && <p role="alert">{catalog.error} Try again when your connection returns.</p>}
    {!catalog.ready && !catalog.error && <p role="status">Loading statuses…</p>}
    {notice && <p role="status">{notice}</p>}
    {catalog.ready && <>
      {draft && <form className="status-maintenance-editor" onSubmit={save}>
        <h2>{draft.label ? 'Edit status' : 'New status'}</h2>
        {draft.scope === 'builtin' && <p>Workflow status · {builtInStatuses[draft.id as keyof typeof builtInStatuses]}</p>}
        <div className="status-maintenance-fields">
          <label>Status name<input required maxLength={50} value={draft.label} disabled={busy}
            onChange={event => setDraft({ ...draft, label: event.target.value })} /></label>
          <label>Display order<input required type="number" min={0} max={999} value={Number.isNaN(draft.position) ? '' : draft.position} disabled={busy}
            onChange={event => setDraft({ ...draft, position: event.target.valueAsNumber })} /></label>
          <label>Accent color<input type="color" value={draft.color || '#0d7473'} disabled={busy}
            onChange={event => setDraft({ ...draft, color: event.target.value })} /></label>
          {draft.scope !== 'builtin' && <label>Applies to<select value={draft.scope} disabled={busy}
            onChange={event => setDraft({ ...draft, scope: event.target.value as StatusScope })}>
            <option value="both">Tasks and subtasks</option><option value="task">Tasks</option><option value="subtask">Subtasks</option>
          </select></label>}
        </div>
        {draft.scope !== 'builtin' && <label className="status-maintenance-retire">
          <input type="checkbox" checked={draft.retired} disabled={busy} onChange={event => setDraft({ ...draft, retired: event.target.checked })} />
          Retire from new selections
        </label>}
        {error && <p role="alert" className="work-state-error">{error}</p>}
        <div className="status-maintenance-actions">
          {draft.color && <button type="button" disabled={busy} onClick={() => setDraft({ ...draft, color: null })}>Use default color</button>}
          <button type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
          <button type="submit" className="status-maintenance-primary" disabled={busy}>{busy ? 'Saving…' : 'Save status'}</button>
        </div>
      </form>}
      <section><h2>Built-in statuses</h2><p>Rename a status to change its display label. Review, completion, and archive still follow their usual steps.</p>{table(builtIn)}</section>
      <section><h2>Custom statuses</h2><p>Custom labels describe work in progress. Retired labels stay on existing work until its status changes.</p>
        {custom.length ? table(custom) : <p>No custom statuses yet.</p>}</section>
    </>}
  </section>;
}
