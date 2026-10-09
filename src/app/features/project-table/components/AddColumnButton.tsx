import { useState } from 'react';
import { Building2, Calendar, Check, CircleGauge, Clock, Flag, GitBranch, Plus, Search, UserRound, Wallet, CircleCheck } from 'lucide-react';
import { WorkspacePopover } from '../../../components/ui/workspace';
import { PROJECT_COLUMNS, type ProjectColumn } from '../types';

const icons = { office: Building2, owner: UserRound, status: CircleCheck, priority: Flag, timeline: Calendar, effort: Clock, dependencies: GitBranch, budget: Wallet, progress: CircleGauge };

export function AddColumnButton({ columns, onAdd }: { columns: ProjectColumn[]; onAdd: (column: ProjectColumn) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const matches = PROJECT_COLUMNS.filter(column => (column.label + (column.id === 'timeline' ? ' Timeline' : '')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const allVisible = PROJECT_COLUMNS.every(column => columns.includes(column.id));
  return <WorkspacePopover open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(''); }} tooltip="Add column"
    trigger={<button type="button" className="pt-add-column-button" aria-label="Add column"><Plus size={17}/></button>}>
    <section className="pt-column-catalogue" aria-label="Supported columns">
      <strong>Add column</strong>
      <label className="pt-column-search"><Search size={16} aria-hidden="true"/><input aria-label="Search columns" placeholder="Search columns" value={query} onChange={event => setQuery(event.target.value)}/></label>
      {allVisible && <p role="status">All supported columns are visible. Use Columns to hide a field.</p>}
      <div className="pt-column-options">{matches.map(column => {
        const Icon = icons[column.id], visible = columns.includes(column.id), label = column.id === 'timeline' ? 'Timeline / Due date' : column.label;
        return <button key={column.id} type="button" disabled={visible} aria-label={label + (visible ? ' — already visible' : '')}
          onClick={() => { onAdd(column.id); setOpen(false); }}>
          <Icon size={17} aria-hidden="true"/><span>{label}</span>{visible && <><Check size={15} aria-hidden="true"/><small>Visible</small></>}
        </button>;
      })}</div>
      {!matches.length && <p role="status">No supported columns match your search.</p>}
    </section>
  </WorkspacePopover>;
}
