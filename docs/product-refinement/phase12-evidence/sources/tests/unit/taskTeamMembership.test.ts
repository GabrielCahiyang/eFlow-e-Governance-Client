import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTaskTeamMemberIds, getTaskTeamRemovalBlockers, validateTaskTeamMembers } from "../../src/app/features/tasks";
import type { Task } from "../../src/app/features/tasks";

const task: Task = {
  id: "task",
  title: "Prepare investment brief",
  status: "in_progress",
  assigneeId: "lead",
  recommendationLeadId: "lead",
  teamMemberIds: ["member", "lead"],
  createdAt: 1,
  updatedAt: 1,
};

describe("task team membership", () => {
  it("shows every member exactly once and keeps the Task Lead first", () => {
    expect(getTaskTeamMemberIds(task)).toEqual(["lead", "member"]);
  });

  it("keeps the current assignee as Task Lead after an AI suggestion becomes stale", () => {
    expect(getTaskTeamMemberIds({ ...task, assigneeId: "replacement", recommendationLeadId: "lead" }))
      .toEqual(["replacement", "member", "lead"]);
  });

  it("blocks removal while a member owns unfinished subtask work", () => {
    const subtasks = [{ title: "Draft presentation", status: "in_progress", assignedToIds: ["member"] }];
    const blockers = getTaskTeamRemovalBlockers(task, subtasks);
    expect(blockers.get("member")?.subtaskTitles).toEqual(["Draft presentation"]);
    expect(() => validateTaskTeamMembers(task, ["lead"], subtasks)).toThrow(/unfinished subtask/i);
  });

  it("allows removal after all of that member's subtasks are complete", () => {
    const subtasks = [{ title: "Draft presentation", status: "completed", isCompleted: true, assignedToIds: ["member"] }];
    expect(() => validateTaskTeamMembers(task, ["lead"], subtasks)).not.toThrow();
  });

  it("enforces the same protection in the database", () => {
    const migration = readFileSync("supabase/migrations/20260821000006_task_team_removal_guard.sql", "utf8");
    expect(migration).toContain("guard_active_subtask_team_member_removal");
    expect(migration).toContain("unfinished subtask");
    expect(migration).toContain("before update of team_member_ids");
  });

  it("converts PostgREST JSON team arrays before assigning them to PostgreSQL arrays", () => {
    const migration = readFileSync("supabase/migrations/20260822000000_fix_task_team_assignment_array_types.sql", "utf8");
    expect(migration).toContain("jsonb_array_elements_text(p_team_member_ids)");
    expect(migration).toContain("::uuid");
    expect(migration).toContain("jsonb_array_elements_text(p_team_member_names)");
    expect(migration).not.toContain("team_member_ids = coalesce(p_team_member_ids, team_member_ids)");
  });
});
