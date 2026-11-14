import { useState } from 'react';
import { Calendar, Check, CircleCheck, Flag, Link2, MoreHorizontal, Plus, ReceiptText, Search, UserRound, Wallet } from 'lucide-react';
import { ActionMenu, WorkspacePopover } from '../../../components/ui/workspace';
import { SUBTASK_COLUMNS, type SubtaskColumn } from '../hooks/useWorkTableColumns';

const icons: Record<SubtaskColumn, typeof UserRound> = {
  owner: UserRound,
  status: CircleCheck,
  timeline: Calendar,
  budget: Wallet,
  actualExpenses: ReceiptText,
  priority: Flag,
  dependencies: Link2,
};

export function WorkTableColumnHeader({
  column,
  label,
  canReset = false,
  onHide,
  onReset,
}: {
  column: 'subtask' | SubtaskColumn;
  label: string;
  canReset?: boolean;
  onHide: (column: SubtaskColumn) => void;
  onReset: () => void;
}) {
  return (
    <th scope="col" aria-label={label} className={`nw-col nw-col--${column}`}>
      <span>
        {label}
        <ActionMenu
          trigger={
            <button className="pt-column-menu" type="button" aria-label={'Column actions for ' + label}>
              <MoreHorizontal size={13} />
            </button>
          }
          actions={
            column === 'subtask'
              ? [{ id: 'reset', label: 'Restore default columns', disabled: !canReset, onSelect: onReset }]
              : [{ id: 'hide', label: 'Hide column', onSelect: () => onHide(column) }]
          }
        />
      </span>
    </th>
  );
}

export function AddSubtaskColumnButton({
  columns,
  onAdd,
}: {
  columns: SubtaskColumn[];
  onAdd: (column: SubtaskColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = SUBTASK_COLUMNS.filter(column =>
    (column.label + (column.id === 'timeline' ? ' Timeline' : ''))
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const allVisible = SUBTASK_COLUMNS.every(column => columns.includes(column.id));

  return (
    <WorkspacePopover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (next) setQuery('');
      }}
      tooltip="Add column"
      trigger={
        <button type="button" className="pt-add-column-button" aria-label="Add column">
          <Plus size={17} />
        </button>
      }
    >
      <section className="pt-column-catalogue" aria-label="Supported subtask columns">
        <strong>Add column</strong>
        <label className="pt-column-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search columns"
            placeholder="Search columns"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        {allVisible && <p role="status">All supported columns are visible. Use a column menu to hide one.</p>}
        <div className="pt-column-options">
          {matches.map(column => {
            const Icon = icons[column.id];
            const visible = columns.includes(column.id);
            const label = column.id === 'timeline' ? 'Timeline / Due date' : column.label;
            return (
              <button
                key={column.id}
                type="button"
                disabled={visible}
                aria-label={label + (visible ? ' — already visible' : '')}
                onClick={() => {
                  onAdd(column.id);
                  setOpen(false);
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                {visible && (
                  <>
                    <Check size={15} aria-hidden="true" />
                    <small>Visible</small>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {!matches.length && <p role="status">No supported columns match your search.</p>}
      </section>
    </WorkspacePopover>
  );
}
