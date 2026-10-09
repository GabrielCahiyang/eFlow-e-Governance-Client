import { useEffect, useState } from 'react';
import { boundedColumnWidth, COMPACT_COLUMN_WIDTHS, COMPACT_HIDDEN_COLUMNS, DEFAULT_COLUMN_WIDTHS, normalizeColumnWidths, normalizeHiddenColumns, type ResizableColumn } from '../columnLayout';
import type { ProjectColumn } from '../types';
import { useWorkspaceScope } from '../../workspaces';

function load(projectId: string, storageId = projectId) {
  let hidden: unknown, widths: unknown;
  try { hidden = JSON.parse(localStorage.getItem('eflow_project_columns_' + storageId) ?? localStorage.getItem('eflow_project_columns_' + projectId) ?? 'null'); } catch { /* Keep usable defaults. */ }
  try { const saved = JSON.parse(localStorage.getItem('eflow_project_table_layout_v1_' + storageId) || localStorage.getItem('eflow_project_table_layout_v1_' + projectId) || 'null'); widths = saved?.version === 1 ? saved.widths : null; } catch { /* Keep usable defaults. */ }
  const hasVisibility = Array.isArray(hidden) && hidden.every(id => typeof id === 'string');
  const hasWidths = widths && typeof widths === 'object' && !Array.isArray(widths);
  return { projectId: storageId, hidden: hasVisibility ? normalizeHiddenColumns(hidden) : [...COMPACT_HIDDEN_COLUMNS],
    widths: hasVisibility || hasWidths ? normalizeColumnWidths(widths) : { ...COMPACT_COLUMN_WIDTHS } };
}
/** Existing visibility key; new device-local widths. Never write another project's state. */
export function useTableLayout(projectId: string) {
  const scope = useWorkspaceScope();
  const storageId = scope ? `${scope.userId}:${scope.workspace.id}:${projectId}` : projectId;
  const [stored, setStored] = useState(() => load(projectId,storageId));
  const current = stored.projectId === storageId ? stored : load(projectId,storageId);
  useEffect(() => {
    if (stored.projectId !== storageId) { setStored(load(projectId,storageId)); return; }
    try {
      localStorage.setItem('eflow_project_columns_' + storageId, JSON.stringify(stored.hidden));
      localStorage.setItem('eflow_project_table_layout_v1_' + storageId, JSON.stringify({ version: 1, widths: stored.widths }));
    } catch { /* Presentation remains usable if storage is blocked. */ }
  }, [projectId,storageId, stored]);
  const change = (transform: (value: typeof current) => typeof current) => setStored(previous => transform(previous.projectId === storageId ? previous : load(projectId,storageId)));
  return { ...current,
    toggleColumn: (column: ProjectColumn) => change(value => ({ ...value, hidden: value.hidden.includes(column) ? value.hidden.filter(id => id !== column) : [...value.hidden, column] })),
    hideColumn: (column: ProjectColumn) => change(value => ({ ...value, hidden: normalizeHiddenColumns([...value.hidden, column]) })),
    showColumn: (column: ProjectColumn) => change(value => ({ ...value, hidden: value.hidden.filter(id => id !== column) })),
    resizeColumn: (column: ResizableColumn, width: number) => change(value => ({ ...value, widths: { ...value.widths, [column]: boundedColumnWidth(column, width) } })),
    resetWidths: () => change(value => ({ ...value, widths: { ...DEFAULT_COLUMN_WIDTHS } })),
    resetCompact: () => change(value => ({ ...value, hidden: [...COMPACT_HIDDEN_COLUMNS], widths: { ...COMPACT_COLUMN_WIDTHS } })),
  };
}
