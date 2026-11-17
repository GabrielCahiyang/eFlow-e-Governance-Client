import type { Option } from "../../components/ui";
import type {
  WorkNode,
  WorkTreeSnapshot,
} from "../../../core/web/app/features/nested-work/types";
import { nodeSchedule } from "./subtaskSchedule";
import { buildPrerequisiteChoiceOptions } from "./prerequisiteChoices";

// The hosted snapshot projects these fields for Office subtasks.
export type DependencyNode = WorkNode;

/** Returns true when the server snapshot includes Office subtask planning support. */
export function supportsSubtaskDependencies(tree: WorkTreeSnapshot) {
  return (
    tree.root.kind === "office" &&
    tree.supportsSubtaskDependencies === true
  );
}

/** Lists active sibling subtasks under the same parent that can be chosen as prerequisites. */
export function subtaskPrerequisiteSiblings(
  tree: WorkTreeSnapshot,
  parentId: string | null,
  excludeId?: string | null,
): DependencyNode[] {
  return tree.nodes.filter(
    (item) =>
      item.id !== excludeId &&
      item.task_id === tree.root.id &&
      (item.parent_subtask_id ?? null) === (parentId ?? null) &&
      String(item.status) !== "cancelled",
  );
}

/** Preserve every legacy prerequisite: cancellation does not satisfy completion. */
export function legacySiblingDependencyIds(
  tree: WorkTreeSnapshot,
  node: DependencyNode,
): string[] {
  if (node.dependency_ids != null) return [];
  return subtaskDependencies(tree, node).items.map((item) => item.id);
}

/** Checks whether the actor has Office dependency planning access when adding a subtask. */
export function canCreateSubtaskDependencies(tree: WorkTreeSnapshot): boolean {
  if (!supportsSubtaskDependencies(tree)) return false;
  return !tree.nodes.some(
    (item) =>
      item.status === "todo" &&
      !nodeSchedule(item)?.started_at &&
      !item.percent_complete &&
      (item as DependencyNode).can_edit_dependencies === false,
  );
}

/** Checks whether explicit prerequisites can be edited on an existing subtask. */
export function canEditSubtaskDependencies(
  tree: WorkTreeSnapshot,
  node?: DependencyNode,
): boolean {
  return (
    supportsSubtaskDependencies(tree) &&
    node?.can_edit_dependencies === true &&
    node.status === "todo" &&
    !nodeSchedule(node)?.started_at &&
    !node.percent_complete &&
    subtaskDependencies(tree, node).missingCount === 0
  );
}

/** Detects circular chains across explicit dependencies and active legacy sequence edges. */
export function subtaskDependencyWouldCycle(
  nodes: readonly DependencyNode[],
  nodeId: string,
  candidateIds: readonly string[],
): boolean {
  const byId = new Map<string, readonly string[]>();
  for (const item of nodes) {
    if (item.id === nodeId) {
      byId.set(item.id, candidateIds);
      continue;
    }
    if (String(item.status) === "cancelled") {
      byId.set(item.id, []);
      continue;
    }
    if (Array.isArray(item.dependency_ids)) {
      byId.set(item.id, item.dependency_ids);
      continue;
    }
    if (item.is_standalone || item.status === "completed") {
      byId.set(item.id, []);
      continue;
    }
    byId.set(
      item.id,
      nodes
        .filter(
          (prerequisite) =>
            prerequisite.task_id === item.task_id &&
            prerequisite.parent_subtask_id === item.parent_subtask_id &&
            !prerequisite.is_standalone &&
            prerequisite.status !== "completed" &&
            prerequisite.sibling_order < item.sibling_order,
        )
        .map((prerequisite) => prerequisite.id),
    );
  }
  const visited = new Set<string>();
  const pending = [...candidateIds];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === nodeId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(...(byId.get(id) ?? []));
  }
  return false;
}

/** Builds Picker options for subtask prerequisites and keeps dates informational. */
export function buildSubtaskPrerequisiteOptions({
  siblings,
  nodes,
  selectedIds,
  dependentStart,
  requireScheduledIncomplete = false,
}: {
  siblings: readonly DependencyNode[];
  nodes: readonly DependencyNode[];
  selectedIds: readonly string[];
  dependentStart?: string | null;
  requireScheduledIncomplete?: boolean;
}): Option[] {
  return buildPrerequisiteChoiceOptions({
    choices: siblings,
    allItems: nodes,
    selectedIds,
    getStart: (item) => item.start_date,
    getDue: (item) => item.due_date,
    dependentStart,
    requireScheduledIncomplete,
    kindLabel: "subtask",
  });
}

/** Validates selected subtask prerequisites immediately for scope, uniqueness, self-links and cycles. */
export function subtaskDependencySelectionError({
  nodes,
  siblings,
  nodeId,
  candidateIds,
  startDate,
  requireDueDates = !!startDate,
  requireNewDueDates = requireDueDates,
  originalIds = [],
}: {
  nodes: readonly DependencyNode[];
  siblings: readonly DependencyNode[];
  nodeId: string;
  candidateIds: readonly string[];
  startDate?: string | null;
  requireDueDates?: boolean;
  requireNewDueDates?: boolean;
  originalIds?: readonly string[];
}): string {
  if (!candidateIds.length) return "";
  if (new Set(candidateIds).size !== candidateIds.length || candidateIds.includes(nodeId))
    return "Choose each prerequisite once, without selecting this subtask itself.";
  const siblingIds = new Set(siblings.map((item) => item.id));
  if (candidateIds.some((id) => !siblingIds.has(id))) {
    return "One prerequisite is no longer available. Remove it to continue.";
  }
  if (subtaskDependencyWouldCycle(nodes, nodeId, candidateIds)) {
    return "These prerequisites would create a circular dependency.";
  }
  return "";
}

export function subtaskDependencies(
  tree: WorkTreeSnapshot,
  node: DependencyNode,
) {
  const siblings = tree.nodes.filter(
    (item) =>
      item.id !== node.id &&
      item.task_id === tree.root.id &&
      item.parent_subtask_id === node.parent_subtask_id,
  );
  const restrictedCount = Math.max(0, node.restricted_dependency_count ?? 0);
  if (Array.isArray(node.dependency_ids)) {
    const ids = new Set(node.dependency_ids);
    // A visible cancelled selection is unresolved, not a restricted record.
    // Keeping it visible also lets the authorized pre-start editor remove it.
    const items = siblings.filter((item) => ids.has(item.id));
    const missingCount = Math.max(0, ids.size - items.length) + restrictedCount;
    const pendingCount = Math.max(
      items.filter((item) => item.status !== "completed").length + missingCount,
      node.pending_dependency_count ?? 0,
    );
    return { items, missingCount, pendingCount, known: true };
  }
  if (node.dependency_ids === null || tree.root.kind === "personal") {
    const nodeOrder = node.sibling_order ?? node.position ?? 0;
    const items = node.is_standalone
      ? []
      : siblings
          .filter(
            (item) =>
              !item.is_standalone &&
              (item.sibling_order ?? item.position ?? 0) < nodeOrder,
          )
          .sort(
            (left, right) =>
              (left.sibling_order ?? left.position ?? 0) -
              (right.sibling_order ?? right.position ?? 0),
          );
    const missingCount = restrictedCount;
    const pendingCount = Math.max(
      items.filter((item) => item.status !== "completed").length + missingCount,
      node.pending_dependency_count ?? 0,
    );
    return {
      items,
      missingCount,
      pendingCount,
      known: true,
    };
  }
  return {
    items: [],
    missingCount: restrictedCount,
    pendingCount: Math.max(
      1,
      node.pending_dependency_count ?? 0,
      restrictedCount,
    ),
    known: false,
  };
}
