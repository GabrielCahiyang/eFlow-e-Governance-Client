import { resolveScheduleDateInput } from "../../../shared/scheduling/relativeSchedule";
import type {
  CollaborationDraftSnapshot,
  CollaborationOrganizationSelection,
  CollaborationSnapshotTask,
} from "../types";
import type { ProposalBudgetDraft } from "../../budget/types";
import { buildProposalBudgetFromTasks } from "../../budget";

export interface DraftTaskInput extends Omit<CollaborationSnapshotTask,
  "activityPrimaryOrgId" | "activitySupportingOrgIds" | "primaryOrgId" | "supportingOrgIds"> {
  activityPrimaryOrgId?: string;
  activitySupportingOrgIds?: string[];
  primaryOrgId?: string;
  supportingOrgIds?: string[];
}

export function buildCollaborationSnapshot({
  title,
  description = "",
  tasks,
  organizations,
  ownerOrgId,
  planningAnchor = Date.now(),
  budget,
}: {
  title: string;
  description?: string;
  tasks: DraftTaskInput[];
  organizations: CollaborationOrganizationSelection[];
  ownerOrgId: string;
  planningAnchor?: number;
  budget?: ProposalBudgetDraft;
}): CollaborationDraftSnapshot {
  const scopedOrganizations = organizations.map((item, index) => ({
    ...item,
    approvalPolicy: item.approvalPolicy || "one_of" as const,
    quorumCount: item.quorumCount || 1,
    sequence: item.sequence || Math.max(1, index),
    reviewDeadlineDays: item.reviewDeadlineDays || 5,
  }));
  const normalizedOrganizations = scopedOrganizations.some((item) => item.participationRole === "owner")
    ? scopedOrganizations
    : [{ orgId: ownerOrgId, participationRole: "owner" as const, staffingEnabled: true, approvalPolicy: "one_of" as const, quorumCount: 1, sequence: 1, reviewDeadlineDays: 5 }, ...scopedOrganizations];
  const normalizedTasks = tasks.map<CollaborationSnapshotTask>((task) => {
    const activityPrimaryOrgId = task.activityPrimaryOrgId || task.primaryOrgId || ownerOrgId;
    const activitySupportingOrgIds = Array.from(new Set(task.activitySupportingOrgIds || task.supportingOrgIds || []))
      .filter((orgId) => orgId && orgId !== activityPrimaryOrgId);
    const leadMemberId = task.leadMemberId || null;
    const assignedMemberIds = Array.from(new Set([
      ...(task.assignedMemberIds || []).filter(Boolean),
      ...(leadMemberId ? [leadMemberId] : []),
    ]));
    const deadline = (/^\d{4}-\d{2}-\d{2}T/.test(task.deadline) ? task.deadline : resolveScheduleDateInput(task.deadline || task.activitySchedule, planningAnchor))
      || task.deadline
      || "";
    return {
      ...task,
      assignedMemberIds,
      leadMemberId,
      deadline,
      activityPrimaryOrgId,
      activitySupportingOrgIds,
      // Kept in the compatibility snapshot shape for existing SQL contracts;
      // operational tasks always inherit the activity's responsible offices.
      primaryOrgId: activityPrimaryOrgId,
      supportingOrgIds: activitySupportingOrgIds,
    };
  });
  return {
    version: 1,
    proposalId: normalizedTasks[0]?.proposalId || `proposal-${crypto.randomUUID()}`,
    title: title.trim() || "Untitled proposal",
    description,
    planningAnchor: new Date(planningAnchor).toISOString(),
    organizations: normalizedOrganizations,
    tasks: normalizedTasks,
    ...(budget ? { budget } : {}),
  };
}

export function snapshotTaskAssignmentsByOrganization(snapshot: CollaborationDraftSnapshot) {
  const assignments = new Map<string, { taskCount: number; memberIds: Set<string>; leadIds: Set<string> }>();
  snapshot.tasks.filter((task) => task.enabled).forEach((task) => {
    const orgIds = new Set([task.primaryOrgId, ...task.supportingOrgIds]);
    orgIds.forEach((orgId) => {
      if (!orgId) return;
      const current = assignments.get(orgId) || { taskCount: 0, memberIds: new Set<string>(), leadIds: new Set<string>() };
      current.taskCount += 1;
      task.assignedMemberIds.forEach((id) => current.memberIds.add(id));
      if (task.leadMemberId) current.leadIds.add(task.leadMemberId);
      assignments.set(orgId, current);
    });
  });
  return assignments;
}

export function withSynchronizedProposalBudget(
  snapshot: CollaborationDraftSnapshot,
  tasks: CollaborationSnapshotTask[],
): CollaborationDraftSnapshot {
  return {
    ...snapshot,
    tasks,
    budget: buildProposalBudgetFromTasks(tasks, snapshot.budget?.fiscalYear),
  };
}
