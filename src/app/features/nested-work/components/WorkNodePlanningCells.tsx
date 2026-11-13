import { PrerequisiteCell, PriorityCell } from '../../../components/ui/workspace';
import type { WorkNode } from '../types';

interface PlanningCellProps {
  node: WorkNode;
  disabled: boolean;
  save: (patch: { priority: WorkNode['priority'] } | { dependency_ids: string[] }) => Promise<void>;
}

export function WorkNodePriorityCell({ node, disabled, save }: PlanningCellProps) {
  return <PriorityCell title={node.title} value={node.priority} disabled={disabled || !node.priority}
    onSave={priority => save({ priority })} />;
}

export function WorkNodeDependenciesCell({ node, nodes, supported, disabled, save }: PlanningCellProps & {
  nodes: WorkNode[];
  supported: boolean;
}) {
  if (!supported) return <span>—</span>;
  const siblings = nodes.filter(item => item.task_id === node.task_id && item.parent_subtask_id === node.parent_subtask_id);
  const selectedIds = node.dependency_ids || [];
  const previousSteps = node.dependency_ids === null && !node.is_standalone
    ? siblings.filter(item => !item.is_standalone && item.sibling_order < node.sibling_order && item.status !== 'completed')
    : [];
  return <PrerequisiteCell title={node.title} itemName="subtask" selectedIds={selectedIds}
    records={siblings} getChoices={() => siblings.filter(item => item.id !== node.id)}
    pendingCount={node.pending_dependency_count} restrictedCount={node.restricted_dependency_count ?? 0}
    emptyLabel={previousSteps.length ? 'Waiting for earlier subtasks' : undefined}
    disabled={disabled || node.can_edit_dependencies !== true || !!node.started_at || node.status !== 'todo'}
    description="This subtask can start only after every selected sibling subtask is completed. Cycles are blocked."
    completedLabel="Completed" onSave={dependency_ids => save({ dependency_ids })} />;
}
