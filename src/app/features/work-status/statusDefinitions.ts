export const builtInStatuses = {
  pending_assignment: 'Unassigned', todo: 'To Do', in_progress: 'In progress',
  stuck: 'Stuck', for_review: 'For review', changes_requested: 'Changes requested',
  completed: 'Completed', cancelled: 'Cancelled', planning: 'Planning',
  active: 'Active', on_hold: 'On hold', archived: 'Archived',
};

export type StatusScope = 'builtin' | 'task' | 'subtask' | 'both';

const builtInPositions = new Map(Object.keys(builtInStatuses).map((id, index) => [id, (index + 1) * 10]));

export interface StatusDefinition {
  id: string;
  label: string;
  color: string | null;
  position: number;
  scope: StatusScope;
  retired: boolean;
}

export function resolveStatus(
  definitions: readonly StatusDefinition[], status: string, fallback: string, customId?: string | null,
) {
  const custom = status === 'in_progress' && customId
    ? definitions.find(item => item.id === customId && item.scope !== 'builtin')
    : undefined;
  const definition = custom || definitions.find(item => item.id === status && item.scope === 'builtin');
  return { label: definition?.label ?? fallback, color: definition?.color ?? undefined };
}

export function customStatusChoices(definitions: readonly StatusDefinition[], scope: 'task' | 'subtask') {
  return definitions.filter(item => !item.retired && (item.scope === scope || item.scope === 'both'))
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
}

export function orderedStatusLabels(definitions: readonly StatusDefinition[], labels: Record<string, string>) {
  const hasOrderOverride = definitions.some(item => item.scope === 'builtin'
    && Object.prototype.hasOwnProperty.call(labels, item.id) && item.position !== builtInPositions.get(item.id));
  return Object.entries(labels).map(([id, label], index) => ({
    id, label: resolveStatus(definitions, id, label).label,
    position: hasOrderOverride
      ? definitions.find(item => item.scope === 'builtin' && item.id === id)?.position
        ?? builtInPositions.get(id) ?? (index + 1) * 10
      : index,
  })).sort((a, b) => a.position - b.position);
}
