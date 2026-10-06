import { useEffect, useState } from 'react';
import { boundedColumnWidth, DEFAULT_COLUMN_WIDTHS, normalizeColumnWidths, normalizeHiddenColumns, type ResizableColumn } from '../columnLayout';
import type { ProjectColumn } from '../types';

function load(projectId: string) {
  let hidden: unknown, widths: unknown;
  try { hidden = JSON.parse(localStorage.getItem('eflow_project_columns_' + projectId) || '[]'); } catch { /* Keep usable defaults. */ }
  try { const saved = JSON.parse(localStorage.getItem('eflow_project_table_layout_v1_' + projectId) || 'null'); widths = saved?.version === 1 ? saved.widths : null; } catch { /* Keep usable defaults. */ }
  return { projectId, hidden: normalizeHiddenColumns(hidden), widths: normalizeColumnWidths(widths) };
}
/** Existing visibility key; new device-local widths. Never write another project's state. */
export function useTableLayout(projectId: string) {
  const [stored, setStored] = useState(() => load(projectId));
  const current = stored.projectId === projectId ? stored : load(projectId);
  useEffect(() => {
    if (stored.projectId !== projectId) { setStored(load(projectId)); return; }
    try {
      localStorage.setItem('eflow_project_columns_' + projectId, JSON.stringify(stored.hidden));
      localStorage.setItem('eflow_project_table_layout_v1_' + projectId, JSON.stringify({ version: 1, widths: stored.widths }));
    } catch { /* Presentation remains usable if storage is blocked. */ }
  }, [projectId, stored]);
  const change = (transform: (value: typeof current) => typeof current) => setStored(previous => transform(previous.projectId === projectId ? previous : load(projectId)));
  return { ...current,
    toggleColumn: (column: ProjectColumn) => change(value => ({ ...value, hidden: value.hidden.includes(column) ? value.hidden.filter(id => id !== column) : [...value.hidden, column] })),
    hideColumn: (column: ProjectColumn) => change(value => ({ ...value, hidden: normalizeHiddenColumns([...value.hidden, column]) })),
    resizeColumn: (column: ResizableColumn, width: number) => change(value => ({ ...value, widths: { ...value.widths, [column]: boundedColumnWidth(column, width) } })),
    resetWidths: () => change(value => ({ ...value, widths: { ...DEFAULT_COLUMN_WIDTHS } })),
  };
}
