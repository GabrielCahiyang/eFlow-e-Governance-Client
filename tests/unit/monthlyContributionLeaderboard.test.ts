import { describe, expect, it } from "vitest";
import type { Employee } from "../../src/app/features/members";
import { buildMonthlyContributionLeaderboard, getManilaMonthPeriod } from "../../src/app/features/productivity";
import type { Task } from "../../src/app/features/tasks";
import type { TeamWorkflowFacts } from "../../src/app/features/team-management";

const employee = (id: string, name = id): Employee => ({ id, name, jobTitle: "Member", jobDescription: "", currentWorkload: 0, departmentName: "LEDIPO" });
const task = (id: string, overrides: Partial<Task> = {}): Task => ({ id, title: id, status: "completed", priority: "medium", estimatedHours: 8, dueDate: "2026-08-31", createdAt: Date.parse("2026-08-01T00:00:00+08:00"), updatedAt: Date.parse("2026-08-05T00:00:00+08:00"), ...overrides });
const emptyFacts = (): TeamWorkflowFacts => ({ subtasks: [], progress: [], submissions: [], statusHistory: [], evidence: [] });
const period = getManilaMonthPeriod(new Date("2026-08-19T12:00:00+08:00"));

describe("monthly contribution leaderboard", () => {
  it("counts only approved, independently reviewed work", () => {
    const facts = emptyFacts();
    facts.submissions = [
      { id: "approved", kind: "task", taskId: "a", version: 1, submitterId: "member", submitterName: "Member", reviewerId: "head", status: "approved", submittedAt: period.start + 1000, decidedAt: period.start + 2000 },
      { id: "pending", kind: "task", taskId: "b", version: 1, submitterId: "member", submitterName: "Member", reviewerId: "head", status: "pending", submittedAt: period.start + 3000 },
      { id: "self", kind: "task", taskId: "c", version: 1, submitterId: "member", submitterName: "Member", reviewerId: "member", status: "approved", submittedAt: period.start + 4000, decidedAt: period.start + 5000 },
    ];
    const rows = buildMonthlyContributionLeaderboard([employee("member")], [task("a"), task("b"), task("c")], facts, period);
    expect(rows).toHaveLength(1);
    expect(rows[0].approvedTasks).toBe(1);
  });

  it("uses Asia/Manila month boundaries", () => {
    const january = getManilaMonthPeriod(new Date("2026-01-01T00:30:00+08:00"));
    expect(january.key).toBe("2026-01");
    expect(new Date(january.start).toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });

  it("caps collaboration credit so many tiny subtasks cannot grow without limit", () => {
    const facts = emptyFacts();
    facts.subtasks = Array.from({ length: 20 }, (_, index) => ({ id: `sub-${index}`, taskId: "parent", title: `Step ${index}`, isCompleted: true, status: "completed" as const, percentComplete: 100, assignedToIds: ["member"], position: index, source: "manual" as const, createdAt: period.start, updatedAt: period.start + 1 }));
    facts.submissions = facts.subtasks.map((subtask, index) => ({ id: `submission-${index}`, kind: "subtask" as const, taskId: "parent", subtaskId: subtask.id, version: 1, submitterId: "member", submitterName: "Member", reviewerId: "lead", status: "approved" as const, submittedAt: period.start + index + 1, decidedAt: period.start + index + 2 }));
    const row = buildMonthlyContributionLeaderboard([employee("member")], [task("parent")], facts, period)[0];
    expect(row.approvedSubtasks).toBe(20);
    expect(row.breakdown.collaboration).toBe(30);
  });

  it("excludes approvals invalidated by a later reopen but counts a later valid approval", () => {
    const reopenedAt = period.start + 10_000;
    const facts = emptyFacts();
    facts.submissions = [
      { id: "old", kind: "task", taskId: "work", version: 1, submitterId: "member", submitterName: "Member", reviewerId: "head", status: "approved", submittedAt: period.start + 1000, decidedAt: period.start + 2000 },
      { id: "new", kind: "task", taskId: "work", version: 2, submitterId: "member", submitterName: "Member", reviewerId: "head", status: "approved", submittedAt: reopenedAt + 1000, decidedAt: reopenedAt + 2000 },
    ];
    const row = buildMonthlyContributionLeaderboard([employee("member")], [task("work", { reopenedAt })], facts, period)[0];
    expect(row.approvedTasks).toBe(1);
    expect(row.firstPassApprovalRate).toBe(0);
  });
});
