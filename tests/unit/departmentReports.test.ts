import { describe, expect, it } from "vitest";
import type { Employee } from "../../src/app/services/employeeService";
import type { Project } from "../../src/app/features/projects";
import type { Task } from "../../src/app/features/tasks";
import type { TeamWorkflowFacts } from "../../src/app/features/team-management";
import {
  buildDepartmentReportRows,
  filterDepartmentReportRows,
} from "../../src/app/features/reports";

const NOW = new Date("2026-08-17T08:00:00Z").getTime();
const employees: Employee[] = [
  { id: "lead", name: "Lead One", jobTitle: "Head", jobDescription: "Planning", currentWorkload: 0 },
  { id: "member", name: "Member One", jobTitle: "Member", jobDescription: "Writing", currentWorkload: 0 },
];
const tasks: Task[] = [{
  id: "task",
  title: "Prepare plan",
  status: "in_progress",
  assigneeId: "lead",
  assigneeName: "Lead One",
  teamMemberIds: ["lead", "member"],
  teamMemberNames: ["Lead One", "Member One"],
  linkedProjectId: "project",
  percentComplete: 40,
  priority: "high",
  createdAt: NOW - 10_000,
  updatedAt: NOW - 5_000,
}];
const projects: Project[] = [{
  id: "project",
  title: "Development plan",
  description: "Plan the work",
  ownerId: "lead",
  status: "active",
  priority: "high",
  createdAt: NOW - 20_000,
  updatedAt: NOW - 5_000,
}];
const facts: TeamWorkflowFacts = {
  subtasks: [{
    id: "subtask",
    taskId: "task",
    title: "Draft annex",
    isCompleted: false,
    status: "for_review",
    percentComplete: 100,
    assignedTo: "member",
    assignedToIds: ["member"],
    position: 0,
    source: "manual",
    createdAt: NOW - 9_000,
    updatedAt: NOW - 4_000,
  }],
  progress: [],
  submissions: [{
    id: "submission",
    kind: "subtask",
    taskId: "task",
    subtaskId: "subtask",
    version: 1,
    submitterId: "member",
    submitterName: "Member One",
    reviewerId: "lead",
    status: "pending",
    submittedAt: NOW - 3_600_000,
  }],
  statusHistory: [],
  evidence: [{
    id: "evidence",
    kind: "subtask",
    taskId: "task",
    submissionId: "submission",
    fileName: "annex.pdf",
    filePath: "task/submission/annex.pdf",
    fileSize: 2048,
    mimeType: "application/pdf",
    createdAt: NOW - 3_500_000,
  }],
};

describe("office reports", () => {
  it("attributes task and subtask contributions instead of counting only the lead", () => {
    const rows = buildDepartmentReportRows("contributions", tasks, projects, employees, facts, [], NOW);
    expect(rows.filter((row) => row.personId === "member").map((row) => row.role)).toEqual([
      "Task member",
      "Subtask contributor",
    ]);
    expect(rows.some((row) => row.personId === "lead" && row.role === "Team Lead")).toBe(true);
  });

  it("links evidence to the submitter, work item, project, and approval state", () => {
    const rows = buildDepartmentReportRows("evidence", tasks, projects, employees, facts, [], NOW);
    expect(rows[0]).toMatchObject({
      title: "annex.pdf",
      parent: "Draft annex",
      project: "Development plan",
      person: "Member One",
      status: "pending",
      taskId: "task",
    });
  });

  it("exports the same exact rows selected by report filters", () => {
    const rows = buildDepartmentReportRows("contributions", tasks, projects, employees, facts, [], NOW);
    const filtered = filterDepartmentReportRows(rows, {
      search: "annex",
      personId: "member",
      projectId: "project",
      status: "for review",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Draft annex");
  });
});

