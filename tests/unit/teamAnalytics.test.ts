import { describe, expect, it } from "vitest";
import type { Employee } from "../../src/app/services/employeeService";
import type { Task } from "../../src/app/services/taskService";
import {
  buildSkillCoverage,
  buildTeamAttentionItems,
  buildTeamHealthSummary,
  buildTeamMemberMetrics,
  type TeamWorkflowFacts,
} from "../../src/app/features/team-management";

const NOW = new Date("2026-08-17T08:00:00Z").getTime();

const employee = (id: string, name: string, skills = ""): Employee => ({
  id,
  name,
  jobTitle: "Member",
  jobDescription: skills || "Member",
  currentWorkload: 0,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Prepare investment report",
  status: "in_progress",
  assigneeId: "lead-1",
  assigneeName: "Lead One",
  teamMemberIds: ["lead-1", "member-1"],
  teamMemberNames: ["Lead One", "Member One"],
  priority: "high",
  deadline: "2026-08-16",
  createdAt: NOW - 10 * 86_400_000,
  updatedAt: NOW - 5 * 86_400_000,
  ...overrides,
});

const facts: TeamWorkflowFacts = {
  subtasks: [{
    id: "subtask-1",
    taskId: "task-1",
    title: "Collect evidence",
    isCompleted: false,
    status: "in_progress",
    percentComplete: 40,
    assignedTo: "member-1",
    assignedToIds: ["member-1"],
    position: 0,
    source: "manual",
    createdAt: NOW - 7 * 86_400_000,
    updatedAt: NOW - 4 * 86_400_000,
  }],
  progress: [{
    id: "progress-1",
    kind: "subtask",
    taskId: "task-1",
    subtaskId: "subtask-1",
    authorId: "member-1",
    authorName: "Member One",
    percentComplete: 40,
    blockerCategory: "Missing information",
    blocker: "Waiting for source documents",
    createdAt: NOW - 4 * 86_400_000,
  }],
  submissions: [
    { id: "submission-1", kind: "task", taskId: "task-old", version: 1, submitterId: "member-1", submitterName: "Member One", status: "approved", submittedAt: NOW - 4_000_000, decidedAt: NOW - 400_000 },
  ],
  statusHistory: [],
  evidence: [],
};

describe("team analytics", () => {
  it("counts task and subtask contribution without trusting stored workload", () => {
    const rows = buildTeamMemberMetrics(
      [employee("lead-1", "Lead One"), employee("member-1", "Member One")],
      [task()],
      facts,
      NOW,
    );
    const member = rows.find((row) => row.employeeId === "member-1");

    expect(member).toMatchObject({ activeTasks: 1, activeSubtasks: 1, overdue: 1, blocked: 1, firstPassApprovalRate: 100 });
    expect(member!.workloadSignal).toBeGreaterThan(member!.recordedWorkload);
  });

  it("builds an actionable queue and resolves proposal-relative schedules", () => {
    const attention = buildTeamAttentionItems([
      task(),
      task({ id: "task-2", title: "Relative schedule", deadline: "Month 2", assigneeId: undefined, teamMemberIds: [] }),
    ], facts, NOW);

    expect(attention.some((item) => item.kind === "overdue" && item.taskId === "task-1")).toBe(true);
    expect(attention.some((item) => item.kind === "blocked" && item.subtaskId === "subtask-1")).toBe(true);
    expect(attention.some((item) => item.kind === "vague_schedule" && item.taskId === "task-2")).toBe(false);
    expect(attention.some((item) => item.kind === "unassigned" && item.taskId === "task-2")).toBe(true);

    const health = buildTeamHealthSummary([task()], facts, attention);
    expect(health).toMatchObject({ activeTasks: 1, activeSubtasks: 1, overdue: 1, blocked: 1, firstPassApprovalRate: 100 });
  });

  it("keeps manager tags compatible with AI assignment while exposing coverage risks", () => {
    const employees = [
      employee("employee-1", "Ana", "Budgeting, Facilitation"),
      employee("employee-2", "Ben", "Facilitation"),
    ];
    const coverage = buildSkillCoverage(employees, {
      "employee-1": { employeeId: "employee-1", strengths: "Strong writer", weaknesses: "", notes: "", tags: ["Report writing"], updatedAt: NOW },
    });

    expect(coverage.find((row) => row.skill === "Report writing")).toMatchObject({ coverage: "single_point", employeeNames: ["Ana"] });
    expect(coverage.find((row) => row.skill === "Facilitation")).toMatchObject({ coverage: "limited" });
  });
});
