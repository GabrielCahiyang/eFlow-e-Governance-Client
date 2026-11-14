import { useEffect, useState } from 'react';

export type SubtaskColumn = 'owner' | 'status' | 'timeline' | 'priority' | 'dependencies' | 'budget' | 'actualExpenses';

export const SUBTASK_COLUMNS: { id: SubtaskColumn; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'status', label: 'Status' },
  { id: 'timeline', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'budget', label: 'Budget' },
  { id: 'actualExpenses', label: 'Actual expenses' },
];

export const DEFAULT_HIDDEN_SUBTASK_COLUMNS: SubtaskColumn[] = ['budget'];

function normalizeHidden(value: unknown): SubtaskColumn[] {
  if (!Array.isArray(value)) return [...DEFAULT_HIDDEN_SUBTASK_COLUMNS];
  return SUBTASK_COLUMNS.filter(col => value.includes(col.id)).map(col => col.id);
}

function loadHidden(storageKey: string): SubtaskColumn[] {
  try {
    const raw = JSON.parse(localStorage.getItem('eflow_subtask_columns_' + storageKey) ?? 'null');
    if (Array.isArray(raw)) return normalizeHidden(raw);
  } catch { /* Keep usable defaults if storage is unavailable. */ }
  return [...DEFAULT_HIDDEN_SUBTASK_COLUMNS];
}

export function useWorkTableColumns(rootId: string, actorId?: string | null) {
  const storageKey = rootId ? `${actorId || 'anon'}:${rootId}` : '';
  const [state, setState] = useState<{ key: string; hidden: SubtaskColumn[] }>(() => ({
    key: storageKey,
    hidden: storageKey ? loadHidden(storageKey) : [...DEFAULT_HIDDEN_SUBTASK_COLUMNS],
  }));

  const currentHidden = state.key === storageKey ? state.hidden : storageKey ? loadHidden(storageKey) : [...DEFAULT_HIDDEN_SUBTASK_COLUMNS];

  useEffect(() => {
    if (!storageKey) return;
    if (state.key !== storageKey) {
      setState({ key: storageKey, hidden: loadHidden(storageKey) });
      return;
    }
    try {
      localStorage.setItem('eflow_subtask_columns_' + storageKey, JSON.stringify(state.hidden));
    } catch { /* Presentation remains usable if storage is blocked. */ }
  }, [storageKey, state]);

  const columns = SUBTASK_COLUMNS.filter(col => !currentHidden.includes(col.id)).map(col => col.id);
  const canReset =
    currentHidden.length !== DEFAULT_HIDDEN_SUBTASK_COLUMNS.length ||
    DEFAULT_HIDDEN_SUBTASK_COLUMNS.some(col => !currentHidden.includes(col));
  return {
    columns,
    hidden: currentHidden,
    canReset,
    hideColumn: (col: SubtaskColumn) =>
      setState({ key: storageKey, hidden: normalizeHidden([...currentHidden, col]) }),
    showColumn: (col: SubtaskColumn) =>
      setState({ key: storageKey, hidden: currentHidden.filter(id => id !== col) }),
    resetColumns: () =>
      setState({ key: storageKey, hidden: [...DEFAULT_HIDDEN_SUBTASK_COLUMNS] }),
  };
}
