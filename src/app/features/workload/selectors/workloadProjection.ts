import {
  DEFAULT_WORKLOAD_THRESHOLDS,
  type MemberWorkloadSummary,
  type OverloadOverrideState,
  type ProjectedWorkloadResult,
  type ProposedAssignmentRole,
  type WorkloadThresholds,
  type WorkloadTier,
} from '../types';

export const OVERLOAD_OVERRIDE_MIN_CHARS = 10;
export const OVERLOAD_OVERRIDE_MAX_CHARS = 500;

/** Convert decimal load points to integer tenths to eliminate JS floating-point drift. */
export function toTenths(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10);
}

export function fromTenths(tenths: number): number {
  return Math.round(tenths) / 10;
}

export function formatLoadPoints(value: number): string {
  const clean = fromTenths(toTenths(value));
  return Number.isInteger(clean) ? `${clean}.0` : clean.toFixed(1);
}

export function proposedRoleLabel(role: ProposedAssignmentRole): string {
  switch (role) {
    case 'project_lead_active':
      return 'Active Project Lead';
    case 'project_lead_planning':
      return 'Project Lead';
    case 'task_lead':
      return 'Task Lead';
    case 'task_contributor':
      return 'Task Contributor';
    case 'subtask_lead':
      return 'Subtask Lead';
    case 'subtask_contributor':
      return 'Subtask Contributor';
  }
}

export function proposedRoleWeight(
  role: ProposedAssignmentRole,
  thresholds: WorkloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS,
): number {
  switch (role) {
    case 'project_lead_active':
      return thresholds.weightActiveProjectLead;
    case 'project_lead_planning':
      return thresholds.weightPlanningProjectLead;
    case 'task_lead':
      return thresholds.weightTaskLead;
    case 'task_contributor':
      return thresholds.weightTaskContributor;
    case 'subtask_lead':
      return thresholds.weightSubtaskLead;
    case 'subtask_contributor':
      return thresholds.weightSubtaskContributor;
  }
}

/**
 * Pure, integer-tenth-safe projection of a member's workload after adding a proposed assignment.
 * Set `alreadyAssignedInRole = true` when viewing an existing assignment so the weight is not double-counted.
 */
export function projectMemberWorkload(
  summary: MemberWorkloadSummary | undefined,
  role: ProposedAssignmentRole,
  thresholds: WorkloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS,
  options?: { alreadyAssignedInRole?: boolean },
): ProjectedWorkloadResult | null {
  if (!summary) return null;

  const alreadyAssigned = Boolean(options?.alreadyAssignedInRole);
  const addedTenths = alreadyAssigned ? 0 : toTenths(proposedRoleWeight(role, thresholds));
  const currentTenths = toTenths(summary.loadPoints);
  const projectedTenths = currentTenths + addedTenths;

  const overloadTenths = Math.max(10, toTenths(thresholds.overloadPoints));
  const heavyTenths = Math.max(10, toTenths(thresholds.heavyPoints));

  const nextActiveProjects =
    summary.activeProjectsLed + (!alreadyAssigned && role === 'project_lead_active' ? 1 : 0);
  const nextTaskLeads =
    summary.taskLeads + (!alreadyAssigned && role === 'task_lead' ? 1 : 0);

  const reasons: string[] = [];
  if (projectedTenths >= overloadTenths) {
    reasons.push(
      `Projected load ${formatLoadPoints(fromTenths(projectedTenths))} pts reaches the ${formatLoadPoints(thresholds.overloadPoints)} pt overload threshold`,
    );
  }
  if (nextActiveProjects >= thresholds.maxActiveProjectLeads) {
    reasons.push(
      `Leading ${nextActiveProjects} active project${nextActiveProjects === 1 ? '' : 's'} (limit: ${thresholds.maxActiveProjectLeads})`,
    );
  }
  if (nextTaskLeads >= thresholds.maxActiveTaskLeads) {
    reasons.push(
      `Leading ${nextTaskLeads} active task${nextTaskLeads === 1 ? '' : 's'} (limit: ${thresholds.maxActiveTaskLeads})`,
    );
  }
  if (summary.overdueCount >= thresholds.maxOverdueItems) {
    reasons.push(
      `${summary.overdueCount} overdue open work item${summary.overdueCount === 1 ? '' : 's'} (limit: ${thresholds.maxOverdueItems})`,
    );
  }

  let projectedTier: WorkloadTier = 'balanced';
  if (reasons.length > 0) {
    projectedTier = 'overloaded';
  } else if (
    projectedTenths >= heavyTenths ||
    nextActiveProjects >= Math.max(1, thresholds.maxActiveProjectLeads - 1) ||
    nextTaskLeads >= Math.max(1, thresholds.maxActiveTaskLeads - 1) ||
    summary.overdueCount >= 1
  ) {
    projectedTier = 'heavy';
  }

  const currentTier = summary.tier;
  const projectedPoints = fromTenths(projectedTenths);
  const projectedUtilizationPercent = Math.min(
    200,
    Math.round((projectedTenths / overloadTenths) * 100),
  );
  const alreadyOverloaded = currentTier === 'overloaded';
  const tipsIntoOverload = !alreadyOverloaded && projectedTier === 'overloaded';
  const requiresOverride =
    !alreadyAssigned &&
    projectedTier === 'overloaded' &&
    thresholds.requireOverrideReason !== false;

  return {
    currentPoints: fromTenths(currentTenths),
    addedPoints: fromTenths(addedTenths),
    projectedPoints,
    projectedUtilizationPercent,
    currentTier,
    projectedTier,
    tipsIntoOverload,
    alreadyOverloaded,
    requiresOverride,
    reasons,
    roleLabel: proposedRoleLabel(role),
  };
}

export function overloadOverrideValidationError(
  projection: ProjectedWorkloadResult | null,
  override: OverloadOverrideState,
): string {
  if (!projection || !projection.requiresOverride) return '';
  if (!override.acknowledged) {
    return 'Confirm you reviewed this member’s workload or switch to a lighter-loaded teammate.';
  }
  const trimmed = override.reason.trim();
  if (!trimmed) {
    return 'Enter a short justification before assigning an overloaded member.';
  }
  if (trimmed.length < OVERLOAD_OVERRIDE_MIN_CHARS) {
    return `Enter at least ${OVERLOAD_OVERRIDE_MIN_CHARS} characters explaining why this assignment is necessary.`;
  }
  if (trimmed.length > OVERLOAD_OVERRIDE_MAX_CHARS) {
    return `Override justification may contain up to ${OVERLOAD_OVERRIDE_MAX_CHARS} characters.`;
  }
  return '';
}

export function compactMemberWorkloadAnnotation(
  summary: MemberWorkloadSummary | undefined,
): string {
  if (!summary) return '';
  const totalProjects = summary.activeProjectsLed + summary.planningProjectsLed;
  const totalTasks = summary.taskLeads + summary.taskContributions;
  if (summary.tier === 'overloaded') {
    const parts: string[] = [`OVERLOADED · ${formatLoadPoints(summary.loadPoints)} pts`];
    if (totalProjects > 0) parts.push(`${totalProjects} proj`);
    if (totalTasks > 0) parts.push(`${totalTasks} task${totalTasks === 1 ? '' : 's'}`);
    if (summary.overdueCount > 0) parts.push(`${summary.overdueCount} overdue`);
    return ` [${parts.join(', ')}]`;
  }
  if (summary.tier === 'heavy') {
    return ` [Heavy · ${formatLoadPoints(summary.loadPoints)} pts]`;
  }
  return '';
}
