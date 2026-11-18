import type { WorkNode, WorkTreeSnapshot } from '../types';
import { readNodeDetailEditState } from './detailEditing';

export function subtaskPrerequisiteChoices(tree: WorkTreeSnapshot, parentId: string, nodeId: string, previous: string[] = []) {
  return tree.nodes.filter(node => node.task_id === tree.root.id && (node.parent_subtask_id || '') === parentId &&
    node.id !== nodeId && (String(node.status) !== 'cancelled' || previous.includes(node.id)));
}

export function canEditSubtaskPrerequisites(tree: WorkTreeSnapshot, node: WorkNode | undefined) {
  const policy = readNodeDetailEditState(node, tree.root.id);
  return tree.root.kind === 'office' && tree.supportsSubtaskDependencies === true && node?.can_edit_dependencies === true &&
    node.dependency_ids !== undefined && node.status === 'todo' && !node.started_at && !node.percent_complete &&
    !node.restricted_dependency_count && policy?.details === true && policy.planning && !policy.started &&
    (node.dependency_ids || []).every(id => tree.nodes.some(sibling => sibling.id === id && sibling.task_id === node.task_id && sibling.parent_subtask_id === node.parent_subtask_id));
}

export function subtaskPrerequisiteError(tree: WorkTreeSnapshot, parent: string, nodeId: string, selected: string[], previous?: string[]) {
  if (selected.length > 100 || new Set(selected).size !== selected.length || selected.includes(nodeId)) {
    return 'Choose up to 100 distinct prerequisite subtasks other than this subtask.';
  }
  const choices = new Set(subtaskPrerequisiteChoices(tree, parent, nodeId, previous).map(node => node.id));
  if (selected.some(id => !choices.has(id))) return 'Choose available subtasks under the same parent.';
  const nodes = new Map(tree.nodes.map(node => [node.id, node]));
  const pending = [...selected];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === nodeId) return 'Dependencies cannot form a cycle.';
    const node = nodes.get(id);
    if (!node || visited.has(id)) continue;
    visited.add(id);
    if (Array.isArray(node.dependency_ids)) pending.push(...node.dependency_ids);
    else if (node.dependency_ids === null && !node.is_standalone && node.status !== 'completed' && String(node.status) !== 'cancelled') {
      pending.push(...tree.nodes.filter(sibling => sibling.task_id === node.task_id && sibling.parent_subtask_id === node.parent_subtask_id &&
        !sibling.is_standalone && sibling.sibling_order < node.sibling_order && sibling.status !== 'completed').map(sibling => sibling.id));
    }
  }
  return '';
}
