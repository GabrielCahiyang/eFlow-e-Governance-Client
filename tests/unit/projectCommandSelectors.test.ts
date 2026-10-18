import { describe, expect, it } from "vitest";
import { buildProjectActivity, buildProjectCommandMetrics, buildProjectPortfolioSummary, buildProjectWorkGroups } from "../../src/app/features/projects/selectors/projectCommandSelectors";
import type { Project } from "../../src/app/features/projects/services/types";
import type { Task } from "../../src/app/features/tasks";
import type { TeamWorkflowFacts } from "../../src/app/features/team-management";

const now = new Date("2026-08-19T00:00:00+08:00").getTime();
const project: Project = { id: "project", title: "Flood control", description: "", status: "active", priority: "high", targetDate: "2026-08-30", createdAt: now - 1000, updatedAt: now - 500 };
const tasks: Task[] = [
  { id: "a", linkedProjectId: "project", title: "Survey", status: "completed", percentComplete: 100, createdAt: now - 5000, updatedAt: now - 3000 },
  { id: "b", linkedProjectId: "project", title: "Design", status: "for_review", percentComplete: 80, dueDate: "2026-08-18", assigneeId: "lead", createdAt: now - 4000, updatedAt: now - 2000 },
];
const facts: TeamWorkflowFacts = {
  subtasks: [], progress: [], statusHistory: [], evidence: [],
  submissions: [{ id: "s", kind: "task", taskId: "b", version: 1, submitterId: "lead", submitterName: "Lead", status: "pending", submittedAt: now - 3600000 }],
};

describe("Project Command Workspace selectors", () => {
  it("derives approved-task progress and review health from canonical task data", () => {
    const metrics = buildProjectCommandMetrics(project, tasks, [], facts, [{ id: "overdue:b", kind: "overdue", severity: "critical", title: "Overdue", detail: "", taskId: "b", taskTitle: "Design", employeeIds: [] }], now);
    expect(metrics.progress).toBe(50);
    expect(metrics.scheduleHealth).toBe("overdue");
    expect(metrics.awaitingReview).toBe(1);
    expect(metrics.activeLeadIds).toEqual(["lead"]);
  });

  it("uses the same linked tasks for portfolio card summaries", () => {
    const summary = buildProjectPortfolioSummary(project, tasks, now);
    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.awaitingReview).toBe(1);
    expect(summary.health).toBe("overdue");
    expect(summary.isEmpty).toBe(false);
  });

  it("marks a retained project container with no linked work as empty", () => {
    const summary = buildProjectPortfolioSummary(project, [], now);
    expect(summary.total).toBe(0);
    expect(summary.isEmpty).toBe(true);
  });

  it("recommends project completion instead of silently changing its status", () => {
    const completedTasks = [
      { ...tasks[0], id: "complete-1" },
      { ...tasks[0], id: "complete-2" },
    ];
    const summary = buildProjectPortfolioSummary(project, completedTasks, now);
    const metrics = buildProjectCommandMetrics(project, completedTasks, [], { ...facts, submissions: [] }, [], now);
    expect(summary.progress).toBe(100);
    expect(summary.completionRecommended).toBe(true);
    expect(metrics.completionRecommended).toBe(true);
    expect(project.status).toBe("active");
  });

  it("merges audit and workflow events into one newest-first timeline", () => {
    const rows = buildProjectActivity(facts, [{ id: "audit", kind: "project", title: "project updated", detail: "", occurredAt: now }]);
    expect(rows.map((row) => row.id)).toEqual(["audit", "submission:s"]);
  });

  it("groups linked tasks by activity and surfaces broken links as a repair queue", () => {
    const milestones = [{ id: "activity-1", projectId: "project", title: "Site preparation", description: "", dueDate: "2026-08-25", status: "in_progress" as const, sortOrder: 0, createdAt: now, updatedAt: now }];
    const groupedTasks = [
      { ...tasks[0], milestoneId: "activity-1" },
      { ...tasks[1], milestoneId: undefined },
    ];
    const groups = buildProjectWorkGroups(groupedTasks, milestones);
    expect(groups.map((group) => group.title)).toEqual(["Site preparation", "Needs activity assignment"]);
    expect(groups[0].needsActivityAssignment).toBe(false);
    expect(groups[1].needsActivityAssignment).toBe(true);
    expect(groups[1].tasks.map((task) => task.id)).toEqual(["b"]);
  });
});
