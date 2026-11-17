import { useRef } from 'react';

export function TableColumnResizer({
  label,
  width,
  defaultWidth,
  min,
  max,
  onResize,
}: {
  label: string;
  width: number;
  defaultWidth: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
}) {
  const start = useRef<{ pointer: number; x: number; width: number } | null>(null);
  return (
    <button
      type="button"
      role="separator"
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels preferred width`}
      title="Drag to resize. Arrow keys adjust width; Home/End use limits. Double-click resets this column."
      className="pt-column-resizer"
      onDoubleClick={() => onResize(defaultWidth)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        onResize(
          event.key === 'Home'
            ? min
            : event.key === 'End'
              ? max
              : width + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 32 : 16),
        );
      }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const pointer = event.pointerId ?? 0;
        start.current = { pointer, x: event.clientX, width };
        event.currentTarget.setPointerCapture?.(pointer);
      }}
      onPointerMove={event => {
        if (start.current && start.current.pointer === (event.pointerId ?? 0)) {
          onResize(start.current.width + event.clientX - start.current.x);
        }
      }}
      onPointerUp={event => {
        start.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId ?? 0);
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}
