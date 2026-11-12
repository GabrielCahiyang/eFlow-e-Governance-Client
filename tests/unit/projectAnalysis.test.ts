import { expect, it } from "vitest";
import { analyzeProject, projectScheduleResult } from "../../src/app/features/analytics/selectors/projectAnalysis";
import type { AnalyticsInput, AnalyticsProject } from "../../src/app/features/analytics/types";

const project: AnalyticsProject = { id: "p", title: "Seminar", targetDate: "2026-11-05", status: "active" };

it("uses Manila calendar days and treats missing completion dates as unknown", () => {
  const now = Date.parse("2026-11-06T20:00:00Z");
  expect(projectScheduleResult(project, now)).toBe("2 days overdue");
  expect(projectScheduleResult(project, Date.parse("2026-11-04T18:00:00Z"))).toBe("Due today");
  expect(projectScheduleResult({ ...project, status: "archived" }, now)).toBe("No completion date recorded");
  expect(projectScheduleResult({ ...project, status: "completed", completedAt: "2026-11-02T18:00:00Z" }, now)).toBe("Completed 2 days early");
});

it("credits the first submitter and separates deadline, approval and contributor activity", () => {
  const submittedAt = Date.parse("2026-11-05T13:00:00Z");
  const decidedAt = submittedAt + 72 * 3_600_000;
  const task = { id: "work", linkedProjectId: project.id, title: "Book venue", status: "completed" as const,
    assigneeId: "new-lead", teamMemberIds: ["new-lead", "helper"], dueDate: "2026-11-05", createdAt: 1, updatedAt: 2 };
  const input: AnalyticsInput = {
    projects: [project], now: decidedAt, people: [{ id: "helper", name: "Helper" }, { id: "new-lead", name: "New lead" }],
    tasks: [task, { ...task, id: "other", linkedProjectId: "elsewhere" }, { ...task, id: "cancel", title: "Cancelled prerequisite", status: "cancelled" },
      { ...task, id: "late-open", status: "in_progress", dependencyIds: [task.id, "cancel", "other"] },
      { ...task, id: "no-date", status: "todo", dueDate: undefined }],
    facts: { subtasks: [], progress: [], evidence: [],
      submissions: [{ id: "s1", kind: "task", taskId: "work", version: 1, submitterId: "old-lead", submitterName: "Old lead", status: "approved", submittedAt, decidedAt }],
      statusHistory: [{ id: "h1", taskId: "work", actorId: "old-lead", toStatus: "in_progress", createdAt: submittedAt - 4 * 3_600_000 }],
    },
  };
  const result = analyzeProject(project, input);
  expect(result.rows.map(row => row.task.id)).toEqual(["work", "late-open", "no-date"]);
  expect(result.rows[0]).toMatchObject({ late: false, approvedAt: decidedAt, reviewHours: 72, turnaroundHours: 4, submitterChanged: true });
  expect(result.rows[1]).toMatchObject({ unsubmittedOverdue: true, prerequisites: ["Cancelled prerequisite"], unavailablePrerequisites: 1 });
  expect(result.rows[2]).toMatchObject({ deadline: null, late: null, unsubmittedOverdue: false });
  expect(result.people.find(person => person.id === "old-lead")).toMatchObject({ name: "Old lead", onTime: 1, leading: 0, reviewHours: 72 });
  expect(result.people.find(person => person.id === "new-lead")).toMatchObject({ onTime: 0, leading: 3, overdue: 1 });
  expect(result.people.find(person => person.id === "helper")).toMatchObject({ contributing: 3 });
});
