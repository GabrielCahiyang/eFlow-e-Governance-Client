import type { Task } from "../../tasks";
import { isActive } from "../../tasks";
import { TEAM_WORKLOAD_ELEVATED_THRESHOLD, TEAM_WORKLOAD_HIGH_THRESHOLD } from "../constants";
import type { TeamAttentionItem, TeamHealthSummary, TeamMemberMetrics, TeamWorkflowFacts, WorkflowSubmissionFact } from "../types";
import { submissionWorkKey } from "./analyticsHelpers";

export type WorkloadConcentrationStatus =
  | "empty"
  | "idle"
  | "overloaded"
  | "concentrated"
  | "active_work"
  | "elevated"
  | "balanced";

export interface WorkloadConcentrationSummary {
  status: WorkloadConcentrationStatus;
  tone: "neutral" | "green" | "amber" | "red";
  badge: string;
  message: string;
  loadedCount: number;
  idleCount: number;
  overloadedCount: number;
  elevatedCount: number;
  activeWorkCount: number;
  minSignal: number;
  maxSignal: number;
  spread: number;
}

const isMemberIdle = (member: TeamMemberMetrics) =>
  member.workloadSignal === 0 && member.activeTasks === 0 && member.activeSubtasks === 0;

/** Evaluates how evenly delivery workload is distributed across all team members. */
export function analyzeWorkloadConcentration(members: TeamMemberMetrics[]): WorkloadConcentrationSummary {
  if (members.length === 0) {
    return {
      status: "empty",
      tone: "neutral",
      badge: "No members",
      message: "No team members available.",
      loadedCount: 0,
      idleCount: 0,
      overloadedCount: 0,
      elevatedCount: 0,
      activeWorkCount: 0,
      minSignal: 0,
      maxSignal: 0,
      spread: 0,
    };
  }

  const loadedMembers = members.filter((member) => !isMemberIdle(member));
  const idleMembers = members.filter(isMemberIdle);
  const overloaded = members.filter((member) => member.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD);
  const elevated = members.filter((member) => member.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD);
  const activeWork = members.filter((member) => member.workload?.level === "unknown");
  const signals = members.map((member) => member.workloadSignal);
  const minSignal = Math.min(...signals);
  const maxSignal = Math.max(...signals);
  const spread = maxSignal - minSignal;

  const base = {
    loadedCount: loadedMembers.length,
    idleCount: idleMembers.length,
    overloadedCount: overloaded.length,
    elevatedCount: elevated.length,
    activeWorkCount: activeWork.length,
    minSignal,
    maxSignal,
    spread,
  };

  if (loadedMembers.length === 0) {
    return {
      ...base,
      status: "idle",
      tone: "neutral",
      badge: "No active load",
      message: "No active workload is assigned across the team yet.",
    };
  }

  if (overloaded.length > 0) {
    const spareNote = idleMembers.length > 0
      ? ` while ${idleMembers.length} ${idleMembers.length === 1 ? "member has" : "members have"} no active load`
      : "";
    return {
      ...base,
      status: "overloaded",
      tone: "red",
      badge: `${overloaded.length} overloaded`,
      message: `${overloaded.length} ${overloaded.length === 1 ? "person has" : "people have"} a high workload signal${spareNote}. Rebalance assignments before adding new work.`,
    };
  }

  if (members.length === 1) {
    if (activeWork.length > 0) {
      return {
        ...base,
        status: "active_work",
        tone: "amber",
        badge: "Active work",
        message: `${members[0].employeeName} has active work. Review task counts and deadlines before assigning more.`,
      };
    }
    if (elevated.length > 0) {
      return {
        ...base,
        status: "elevated",
        tone: "amber",
        badge: "Elevated load",
        message: `${members[0].employeeName} carries an elevated workload (${maxSignal} signal).`,
      };
    }
    return {
      ...base,
      status: "balanced",
      tone: "green",
      badge: "Manageable",
      message: `${members[0].employeeName} has a manageable workload (${maxSignal} signal).`,
    };
  }

  const activeNote = activeWork.length > 0
    ? ` ${activeWork.length} ${activeWork.length === 1 ? "member has" : "members have"} active tasks.`
    : "";

  // Concentration occurs when load spread is wide, elevated members coexist with idle members, or <= half the team holds all work.
  const severelyConcentrated =
    spread >= 30 ||
    (elevated.length > 0 && idleMembers.length > 0) ||
    (idleMembers.length > 0 && loadedMembers.length <= Math.floor(members.length / 2));

  if (severelyConcentrated) {
    const detail = idleMembers.length > 0
      ? `${idleMembers.length} ${idleMembers.length === 1 ? "member has" : "members have"} no active load.`
      : "load spread is uneven across the team.";
    return {
      ...base,
      status: "concentrated",
      tone: "amber",
      badge: "Concentrated",
      message: `Workload is concentrated on ${loadedMembers.length} of ${members.length} members (${minSignal}–${maxSignal} signal); ${detail}${activeNote}`,
    };
  }

  if (idleMembers.length > 0) {
    return {
      ...base,
      status: "concentrated",
      tone: "amber",
      badge: "Uneven",
      message: `${loadedMembers.length} of ${members.length} members hold active work (${minSignal}–${maxSignal} signal); ${idleMembers.length} ${idleMembers.length === 1 ? "member has" : "members have"} no active load.${activeNote}`,
    };
  }

  if (activeWork.length > 0) {
    return {
      ...base,
      status: "active_work",
      tone: "amber",
      badge: "Active work",
      message: `${activeWork.length} of ${members.length} members have active tasks. Review assignments and deadlines to assess capacity.`,
    };
  }

  if (elevated.length > 0) {
    return {
      ...base,
      status: "elevated",
      tone: "amber",
      badge: "Elevated load",
      message: `${elevated.length} of ${members.length} members carry an elevated workload (${minSignal}–${maxSignal} signal). Monitor capacity before adding new work.`,
    };
  }

  return {
    ...base,
    status: "balanced",
    tone: "green",
    badge: "Balanced",
    message: `Workload is balanced across the team (${minSignal}–${maxSignal} signal).`,
  };
}

export function buildTeamHealthSummary(tasks: Task[], facts: TeamWorkflowFacts, attention: TeamAttentionItem[]): TeamHealthSummary {
  const activeTasks = tasks.filter(isActive);
  const activeSubtasks = facts.subtasks.filter((subtask) => subtask.status !== "completed" && activeTasks.some((task) => task.id === subtask.taskId));
  const approvedWork = new Map<string, WorkflowSubmissionFact[]>();
  facts.submissions.forEach((submission) => {
    const key = submissionWorkKey(submission);
    approvedWork.set(key, [...(approvedWork.get(key) || []), submission]);
  });
  const approvedAttempts = Array.from(approvedWork.values()).filter((attempts) => attempts.some((attempt) => attempt.status === "approved"));
  const firstPass = approvedAttempts.filter((attempts) => attempts.some((attempt) => attempt.version === 1 && attempt.status === "approved")).length;
  const decided = facts.submissions.filter((submission) => submission.decidedAt && submission.decidedAt >= submission.submittedAt);
  const averageReviewHours = decided.length
    ? Math.round((decided.reduce((sum, submission) => sum + ((submission.decidedAt || submission.submittedAt) - submission.submittedAt), 0) / decided.length / 3_600_000) * 10) / 10
    : null;
  const uniqueKind = (kind: TeamAttentionItem["kind"]) => new Set(attention.filter((item) => item.kind === kind).map((item) => `${item.taskId}:${item.subtaskId || "task"}`)).size;
  return {
    activeTasks: activeTasks.length,
    activeSubtasks: activeSubtasks.length,
    completedTasks: tasks.filter((task) => task.status === "completed" && !task.archivedAt).length,
    overdue: uniqueKind("overdue"),
    blocked: uniqueKind("blocked"),
    stalled: uniqueKind("stalled"),
    awaitingReview: uniqueKind("awaiting_review"),
    changesRequested: uniqueKind("changes_requested"),
    vagueSchedules: uniqueKind("vague_schedule"),
    firstPassApprovalRate: approvedAttempts.length ? Math.round((firstPass / approvedAttempts.length) * 100) : null,
    averageReviewHours,
  };
}

