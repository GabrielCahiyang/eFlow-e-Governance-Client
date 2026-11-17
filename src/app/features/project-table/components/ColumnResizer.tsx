import { TableColumnResizer } from '../../../components/ui/workspace';
import { COLUMN_LAYOUT, type ResizableColumn } from '../columnLayout';

export function ColumnResizer({ column, label, width, onResize }: { column: ResizableColumn; label: string; width: number; onResize: (column: ResizableColumn, width: number) => void }) {
  const bounds = COLUMN_LAYOUT[column];
  return (
    <TableColumnResizer
      label={label}
      width={width}
      defaultWidth={bounds.width}
      min={bounds.min}
      max={bounds.max}
      onResize={next => onResize(column, next)}
    />
  );
}
