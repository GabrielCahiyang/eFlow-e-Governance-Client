import { useRef } from 'react';
import { COLUMN_LAYOUT, type ResizableColumn } from '../columnLayout';

export function ColumnResizer({ column, label, width, onResize }: { column: ResizableColumn; label: string; width: number; onResize: (column: ResizableColumn, width: number) => void }) {
  const start = useRef<{ pointer: number; x: number; width: number } | null>(null);
  const bounds = COLUMN_LAYOUT[column];
  return <button type="button" role="separator" aria-label={'Resize ' + label + ' column'} aria-orientation="vertical"
    aria-valuemin={bounds.min} aria-valuemax={bounds.max} aria-valuenow={width} aria-valuetext={width + ' pixels preferred width'}
    title="Drag to resize. Arrow keys adjust width; Home/End use limits. Double-click resets this column."
    className="pt-column-resizer" onDoubleClick={() => onResize(column, bounds.width)}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      onResize(column, event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : width + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 32 : 16));
    }} onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); start.current = { pointer: event.pointerId, x: event.clientX, width }; event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      if (start.current?.pointer === event.pointerId) onResize(column, start.current.width + event.clientX - start.current.x);
    }} onPointerUp={event => { start.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { start.current = null; }} />;
}
