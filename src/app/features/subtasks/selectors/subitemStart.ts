import type { WorkNode, WorkTreeSnapshot } from '../../nested-work';

export function subitemStartBlocker(
  tree: WorkTreeSnapshot,
  node: WorkNode,
  actorId: string | null,
  readOnly: boolean,
  executionBlocked: boolean,
  prerequisiteTitle?: string,
): string | null {
  if (executionBlocked || tree.root.project_status === 'on_hold') return 'Work is paused while the project is on hold.';
  if (readOnly || !tree.root.open) return 'This subtask is read-only right now.';
  if (!node.lead_id) return 'Appoint a subtask lead before starting this work.';
  if (node.lead_id !== actorId) return 'The appointed subtask lead must start this work before the team can post updates.';
  if (tree.root.project_status && tree.root.project_status !== 'active') return 'The project must be active before this subtask can start.';
  if (tree.root.status !== 'in_progress') return 'Start the parent task before starting this subtask.';
  // Start is date-neutral: the planned start date is informational only.
  const parent = tree.nodes.find(item => item.id === node.parent_subtask_id);
  if (parent?.status === 'todo' && !parent.started_at) return 'Start the parent subtask first.';
  if (node.dependency_ids == null && prerequisiteTitle) return `Complete “${prerequisiteTitle}” first.`;
  if ((node.restricted_dependency_count ?? 0) > 0 || node.dependency_ids?.some(id => !tree.nodes.some(item =>
    item.id === id && item.id !== node.id && item.task_id === node.task_id && item.parent_subtask_id === node.parent_subtask_id))) {
    return 'A selected prerequisite is missing or restricted. Reload this work to verify its dependencies.';
  }
  const selected = tree.nodes.find(item => node.dependency_ids?.includes(item.id) && item.status !== 'completed');
  if (selected) return `Complete “${selected.title}” first.`;
  if ((node.pending_dependency_count ?? 0) > 0) return 'Complete the prerequisite subtasks first.';
  return null;
}
