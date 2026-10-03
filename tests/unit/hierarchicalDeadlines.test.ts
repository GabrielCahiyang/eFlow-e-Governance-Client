import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getSubtaskDeadlineState, parentTaskDueDate } from "../../src/app/features/subtasks/selectors/deadlines";
import { deriveProposalTargetDate, getPortfolioDeadlineState } from "../../src/app/features/projects/selectors/deadlines";
import type { Project } from "../../src/app/features/projects/services/types";

const now = new Date("2026-08-20T08:00:00+08:00").getTime();

function project(id: string, targetDate: string): Project {
  return { id, title: id, description: "", status: "active", priority: "medium", targetDate, createdAt: 1, updatedAt: 1 };
}

describe("hierarchical deadline rules", () => {
  it("classifies subtask deadlines without treating the due date itself as overdue", () => {
    expect(getSubtaskDeadlineState({ dueDate: "2026-08-19", isCompleted: false, status: "in_progress" }, now).tone).toBe("overdue");
    expect(getSubtaskDeadlineState({ dueDate: "2026-08-20", isCompleted: false, status: "todo" }, now).label).toBe("Due today");
    expect(getSubtaskDeadlineState({ dueDate: "2026-08-23", isCompleted: false, status: "todo" }, now).tone).toBe("due_soon");
    expect(getSubtaskDeadlineState({ dueDate: "2026-08-19", isCompleted: true, status: "completed" }, now).tone).toBe("completed");
  });

  it("uses the task's measurable date as the maximum subtask date", () => {
    expect(parentTaskDueDate("Month 1", "2026-09-01")).toBe("2026-09-01");
    expect(parentTaskDueDate("Month 1", undefined)).toBeUndefined();
  });

  it("derives proposal target from the last program and reports overdue state", () => {
    const programs = [
      { projects: [project("early", "2026-08-25")] },
      { projects: [project("final-a", "2026-09-10"), project("final-b", "2026-09-15")] },
    ];
    expect(deriveProposalTargetDate(programs)).toBe("2026-09-15");
    expect(getPortfolioDeadlineState("2026-08-19", false, now).tone).toBe("overdue");
    expect(getPortfolioDeadlineState("2026-08-19", true, now).tone).toBe("completed");
  });

  it("keeps database enforcement, audit, reminders, and completion recommendations together", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20260820000001_hierarchical_deadlines.sql", import.meta.url), "utf8");
    expect(sql).toContain("set_subtask_due_date");
    expect(sql).toContain("A reason is required after subtask work has started");
    expect(sql).toContain("Subtask due date cannot be later than its parent task due date");
    expect(sql).toContain("A subtask due date is required");
    expect(sql).toContain("hierarchy_deadline_reminders");
    expect(sql).toContain("completion_recommended");
    expect(sql).toContain("unique (entity_type, entity_key, recipient_id, reminder_kind, due_on)");
    expect(sql).toContain("create or replace function public.dispatch_task_review_reminders()");
    expect(sql).toContain("+ public.dispatch_task_review_reminders()");
    expect(sql).toContain("Admin task oversight is read-only");
  });
});
