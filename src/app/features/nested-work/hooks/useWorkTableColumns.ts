import { useEffect, useState } from 'react';

export type SubtaskColumn = 'owner' | 'status' | 'timeline' | 'priority' | 'dependencies' | 'budget' | 'actualExpenses';
export type SubtaskResizableColumn = 'subtask' | SubtaskColumn;
export type SubtaskColumnWidths = Record<SubtaskResizableColumn, number>;

export const SUBTASK_COLUMNS: { id: SubtaskColumn; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'status', label: 'Status' },
  { id: 'timeline', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'budget', label: 'Budget' },
  { id: 'actualExpenses', label: 'Actual expenses' },
];

export const SUBTASK_COLUMN_LAYOUT: Record<SubtaskResizableColumn, { width: number; min: number; max: number }> = {
  subtask: { width: 280, min: 190, max: 520 },
  owner: { width: 124, min: 104, max: 280 },
  status: { width: 132, min: 112, max: 220 },
  timeline: { width: 168, min: 148, max: 260 },
  priority: { width: 114, min: 96, max: 180 },
  dependencies: { width: 156, min: 130, max: 260 },
  budget: { width: 136, min: 112, max: 240 },
  actualExpenses: { width: 146, min: 126, max: 240 },
};

export const DEFAULT_SUBTASK_COLUMN_WIDTHS: SubtaskColumnWidths = Object.fromEntries(
  Object.entries(SUBTASK_COLUMN_LAYOUT).map(([key, spec]) => [key, spec.width]),
) as SubtaskColumnWidths;

export const DEFAULT_HIDDEN_SUBTASK_COLUMNS: SubtaskColumn[] = ['budget'];

export function boundedSubtaskColumnWidth(column: SubtaskResizableColumn, width: number) {
  const { width: fallback, min, max } = SUBTASK_COLUMN_LAYOUT[column];
  return Number.isFinite(width) ? Math.min(max, Math.max(min, Math.round(width))) : fallback;
}

export function normalizeSubtaskColumnWidths(widths: unknown): SubtaskColumnWidths {
  const input = widths && typeof widths === 'object' ? widths as Record<string, unknown> : {};
  return Object.fromEntries(
    (Object.keys(SUBTASK_COLUMN_LAYOUT) as SubtaskResizableColumn[]).map(col => [
      col,
      boundedSubtaskColumnWidth(col, Number(input[col])),
    ]),
  ) as SubtaskColumnWidths;
}

function normalizeHidden(value: unknown): SubtaskColumn[] {
  if (!Array.isArray(value)) return [...DEFAULT_HIDDEN_SUBTASK_COLUMNS];
  return SUBTASK_COLUMNS.filter(col => value.includes(col.id)).map(col => col.id);
}

function loadState(storageKey: string): { key: string; hidden: SubtaskColumn[]; widths: SubtaskColumnWidths } {
  let hidden = [...DEFAULT_HIDDEN_SUBTASK_COLUMNS];
  let widths = { ...DEFAULT_SUBTASK_COLUMN_WIDTHS };
  if (storageKey) {
    try {
      const rawHidden = JSON.parse(localStorage.getItem('eflow_subtask_columns_' + storageKey) ?? 'null');
      if (Array.isArray(rawHidden)) hidden = normalizeHidden(rawHidden);
    } catch { /* Keep usable defaults if storage is unavailable. */ }
    try {
      const rawLayout = JSON.parse(localStorage.getItem('eflow_subtask_table_layout_v1_' + storageKey) ?? 'null');
      if (rawLayout?.version === 1 && rawLayout.widths) {
        widths = normalizeSubtaskColumnWidths(rawLayout.widths);
      }
    } catch { /* Keep usable defaults if storage is unavailable. */ }
  }
  return { key: storageKey, hidden, widths };
}

export function useWorkTableColumns(rootId: string, actorId?: string | null) {
  const storageKey = rootId ? `${actorId || 'anon'}:${rootId}` : '';
  const [state, setState] = useState(() => loadState(storageKey));

  const current = state.key === storageKey ? state : loadState(storageKey);

  useEffect(() => {
    if (!storageKey) return;
    if (state.key !== storageKey) {
      setState(loadState(storageKey));
      return;
    }
    try {
      localStorage.setItem('eflow_subtask_columns_' + storageKey, JSON.stringify(state.hidden));
      localStorage.setItem('eflow_subtask_table_layout_v1_' + storageKey, JSON.stringify({ version: 1, widths: state.widths }));
    } catch { /* Presentation remains usable if storage is blocked. */ }
  }, [storageKey, state]);

  const columns = SUBTASK_COLUMNS.filter(col => !current.hidden.includes(col.id)).map(col => col.id);
  const widthsChanged = (Object.keys(DEFAULT_SUBTASK_COLUMN_WIDTHS) as SubtaskResizableColumn[])
    .some(col => current.widths[col] !== DEFAULT_SUBTASK_COLUMN_WIDTHS[col]);
  const canReset =
    current.hidden.length !== DEFAULT_HIDDEN_SUBTASK_COLUMNS.length ||
    DEFAULT_HIDDEN_SUBTASK_COLUMNS.some(col => !current.hidden.includes(col)) ||
    widthsChanged;

  const update = (transform: (prev: typeof current) => typeof current) =>
    setState(prev => transform(prev.key === storageKey ? prev : loadState(storageKey)));

  return {
    columns,
    hidden: current.hidden,
    widths: current.widths,
    canReset,
    hideColumn: (col: SubtaskColumn) =>
      update(prev => ({ ...prev, hidden: normalizeHidden([...prev.hidden, col]) })),
    showColumn: (col: SubtaskColumn) =>
      update(prev => ({ ...prev, hidden: prev.hidden.filter(id => id !== col) })),
    resizeColumn: (col: SubtaskResizableColumn, width: number) =>
      update(prev => ({ ...prev, widths: { ...prev.widths, [col]: boundedSubtaskColumnWidth(col, width) } })),
    resetColumns: () =>
      setState({ key: storageKey, hidden: [...DEFAULT_HIDDEN_SUBTASK_COLUMNS], widths: { ...DEFAULT_SUBTASK_COLUMN_WIDTHS } }),
  };
}
