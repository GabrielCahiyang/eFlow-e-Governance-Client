import type { BudgetLineInput } from "../../budget";
import type { CollaborationDraftSnapshot, CollaborationSnapshotTask } from "../types";
import { normalizeCollaborationOrganization } from "./participationRole";

export type MaterialRevisionReason = "organization_participation" | "task_structure" | "staffing" | "responsibility" | "budget" | "schedule";

export interface RevisionMateriality {
  material: boolean;
  reasons: MaterialRevisionReason[];
}

const sorted = (values: string[] | undefined) => [...(values || [])].sort();

function lineAmount(line: BudgetLineInput) {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const unitCost = Math.max(0, Number(line.unitCost) || 0);
  return quantity > 0 && unitCost > 0 ? quantity * unitCost : Math.max(0, Number(line.amount) || 0);
}

function organizationSignature(snapshot: CollaborationDraftSnapshot) {
  return snapshot.organizations.map(normalizeCollaborationOrganization).map((item) => ({
    orgId: item.orgId,
    participationRole: item.participationRole,
    staffingEnabled: item.staffingEnabled,
    approvalPolicy: item.approvalPolicy || "one_of",
    quorumCount: item.quorumCount || 1,
    sequence: item.sequence || 1,
  })).sort((left, right) => left.orgId.localeCompare(right.orgId));
}

function taskStructureSignature(tasks: CollaborationSnapshotTask[]) {
  return tasks.map((task) => ({ key: task.key, enabled: task.enabled !== false }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function staffingSignature(tasks: CollaborationSnapshotTask[]) {
  return tasks.map((task) => ({
    key: task.key,
    assignedMemberIds: sorted(task.assignedMemberIds),
    leadMemberId: task.leadMemberId || null,
  })).sort((left, right) => left.key.localeCompare(right.key));
}

function responsibilitySignature(tasks: CollaborationSnapshotTask[]) {
  return tasks.map((task) => ({
    key: task.key,
    activityPrimaryOrgId: task.activityPrimaryOrgId || "",
    activitySupportingOrgIds: sorted(task.activitySupportingOrgIds),
    primaryOrgId: task.primaryOrgId || "",
    supportingOrgIds: sorted(task.supportingOrgIds),
  })).sort((left, right) => left.key.localeCompare(right.key));
}

function scheduleSignature(tasks: CollaborationSnapshotTask[]) {
  return tasks.map((task) => ({ key: task.key, deadline: task.deadline || "", estimatedHours: Number(task.estimatedHours || 0) })).sort((a, b) => a.key.localeCompare(b.key));
}

function budgetSignature(snapshot: CollaborationDraftSnapshot) {
  const tasks = snapshot.tasks.map((task) => ({
    key: task.key,
    decision: task.budgetDecision || "missing",
    lines: (task.budgetLines || []).map((line) => ({ id: line.id, amount: lineAmount(line) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  })).sort((left, right) => left.key.localeCompare(right.key));
  return { totalAmount: Number(snapshot.budget?.totalAmount || 0), tasks };
}

const differs = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);

export function evaluateRevisionMateriality(previous: CollaborationDraftSnapshot, next: CollaborationDraftSnapshot): RevisionMateriality {
  const reasons: MaterialRevisionReason[] = [];
  if (differs(organizationSignature(previous), organizationSignature(next))) reasons.push("organization_participation");
  if (differs(taskStructureSignature(previous.tasks), taskStructureSignature(next.tasks))) reasons.push("task_structure");
  if (differs(staffingSignature(previous.tasks), staffingSignature(next.tasks))) reasons.push("staffing");
  if (differs(responsibilitySignature(previous.tasks), responsibilitySignature(next.tasks))) reasons.push("responsibility");
  if (differs(scheduleSignature(previous.tasks), scheduleSignature(next.tasks))) reasons.push("schedule");
  if (differs(budgetSignature(previous), budgetSignature(next))) reasons.push("budget");
  return { material: reasons.length > 0, reasons };
}

export function summarizeRevisionDiff(previous: CollaborationDraftSnapshot, next: CollaborationDraftSnapshot): string[] {
  const changes: string[] = [];
  const materiality = evaluateRevisionMateriality(previous, next);
  if (previous.title !== next.title || previous.description !== next.description) changes.push("Proposal details changed");
  if (materiality.reasons.includes("organization_participation")) changes.push("Organization participation changed");
  if (materiality.reasons.includes("task_structure")) changes.push("Work structure changed");
  if (materiality.reasons.includes("staffing")) changes.push("Task staffing changed");
  if (materiality.reasons.includes("responsibility")) changes.push("Office responsibilities changed");
  if (materiality.reasons.includes("budget")) changes.push("Task funding changed");
  if (materiality.reasons.includes("schedule")) changes.push("Task deadlines or duration changed");
  return changes.length ? changes : ["Draft metadata updated"];
}
