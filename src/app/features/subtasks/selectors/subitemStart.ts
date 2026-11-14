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
  if (!node.start_date) return 'Set a planned start date before starting this subtask.';
  const today = tree.root.scheduling?.today;
  if (!today) return 'Reload the subtask to check its scheduled start.';
  if (node.start_date > today) return `You can start this subtask on or after ${node.start_date}.`;
  const parent = tree.nodes.find(item => item.id === node.parent_subtask_id);
  if (parent?.status === 'todo' && !parent.started_at) return 'Start the parent subtask first.';
  if (prerequisiteTitle) return `Complete “${prerequisiteTitle}” first.`;
  if ((node.pending_dependency_count ?? 0) > 0) return 'Complete the prerequisite subtasks first.';
  return null;
}
