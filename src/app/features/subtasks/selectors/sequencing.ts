export interface SequencedItem {
  id: string;
  position: number;
}

export interface ExecutableSequenceItem extends SequencedItem {
  taskId?: string;
  parentSubtaskId?: string;
  siblingOrder?: number;
  dependencyIds?: readonly string[] | null;
  title: string;
  isCompleted: boolean;
  isStandalone?: boolean;
}

/** Explicit prerequisites replace the legacy sequence when present. */
export function getSubtaskPrerequisite<T extends ExecutableSequenceItem>(
  subtask: T,
  siblings: readonly T[],
): T | null {
  const isSibling = (candidate: T) => candidate.id !== subtask.id
    && (!subtask.taskId || !candidate.taskId || candidate.taskId === subtask.taskId)
    && (candidate.parentSubtaskId || null) === (subtask.parentSubtaskId || null);
  if (subtask.dependencyIds) {
    return siblings.find(candidate => isSibling(candidate) && subtask.dependencyIds?.includes(candidate.id) && !candidate.isCompleted) || null;
  }
  if (subtask.isStandalone) return null;
  return [...siblings]
    .filter((candidate) =>
      isSibling(candidate)
      && !candidate.isStandalone
      && (candidate.siblingOrder ?? candidate.position) < (subtask.siblingOrder ?? subtask.position)
      && !candidate.isCompleted,
    )
    .sort((left, right) => (left.siblingOrder ?? left.position) - (right.siblingOrder ?? right.position))[0] || null;
}

export function getSequentialStepNumber<T extends ExecutableSequenceItem>(
  subtask: T,
  siblings: readonly T[],
): number | null {
  if (subtask.isStandalone) return null;
  return siblings.filter((candidate) =>
    (!subtask.taskId || !candidate.taskId || candidate.taskId === subtask.taskId)
    && !candidate.isStandalone
    && (candidate.parentSubtaskId || null) === (subtask.parentSubtaskId || null)
    && (candidate.siblingOrder ?? candidate.position) <= (subtask.siblingOrder ?? subtask.position)
  ).length;
}

export function resequenceItems<T extends SequencedItem>(items: readonly T[]): T[] {
  return items.map((item, position) => ({ ...item, position }));
}

export function moveSequenceItem<T extends SequencedItem>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) {
    return resequenceItems(items);
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return resequenceItems(next);
}

export function moveSequenceItemToTarget<T extends SequencedItem>(
  items: readonly T[],
  movingId: string,
  targetId: string,
): T[] {
  return moveSequenceItem(
    items,
    items.findIndex((item) => item.id === movingId),
    items.findIndex((item) => item.id === targetId),
  );
}
