import { MoreHorizontal } from 'lucide-react';
import { ActionMenu } from '../../../components/ui/workspace';
import { ColumnResizer } from './ColumnResizer';
import type { ResizableColumn } from '../columnLayout';
import type { ProjectColumn } from '../types';
import type { TableSort } from '../selectors';

export function TableColumnHeader({ column, label, width, sort, onResize, onHide, onSort }: {
  column: ResizableColumn; label: string; width: number; sort: TableSort; onResize?: (column: ResizableColumn, width: number) => void; onHide: (column: ProjectColumn) => void; onSort: (sort: TableSort) => void;
}) {
  const columnSort = column === 'task' ? 'title' : column === 'timeline' ? 'deadline' : column === 'priority' ? 'priority' : undefined;
  return <th scope="col" aria-label={label} aria-sort={columnSort && sort === columnSort ? 'ascending' : undefined} className={column === 'task' ? 'pt-title-col' : undefined}>
    <span>{label}{columnSort && sort === columnSort && <span aria-hidden="true">↑</span>}
      <ActionMenu trigger={<button className="pt-column-menu" type="button" aria-label={'Column actions for ' + label}><MoreHorizontal size={13}/></button>} actions={[
        ...(column !== 'task' ? [{ id: 'hide', label: 'Hide column', onSelect: () => onHide(column) }] : []),
        ...(columnSort ? [{ id: 'sort', label: 'Sort by ' + (columnSort === 'deadline' ? 'due date' : columnSort === 'title' ? 'task name' : 'priority'), onSelect: () => onSort(columnSort) }] : []),
      ]} />
    </span>{onResize && <ColumnResizer column={column} label={label} width={width} onResize={onResize} />}
  </th>;
}
