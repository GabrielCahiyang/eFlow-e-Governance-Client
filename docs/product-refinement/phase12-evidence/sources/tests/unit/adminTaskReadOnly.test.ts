import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveSubtaskManagementCapability, resolveTaskDetailCapabilities } from "../../src/app/features/tasks/components/taskDetailAccess";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260819000007_super_admin_task_read_only.sql", import.meta.url),
  "utf8",
);

describe("Admin task oversight", () => {
  it("removes every interactive task-detail capability in read-only mode", () => {
    expect(resolveTaskDetailCapabilities(true, {
      canReview: true,
      canPostProgress: true,
      canSubmitForReview: true,
      canDiscuss: true,
    })).toEqual({ canReview: false, canPostProgress: false, canSubmitForReview: false, canDiscuss: false });
  });

  it("preserves normal workflow capabilities outside read-only oversight", () => {
    expect(resolveTaskDetailCapabilities(false, {
      canReview: true,
      canPostProgress: false,
      canDiscuss: true,
    })).toEqual({ canReview: true, canPostProgress: false, canDiscuss: true });
  });

  it("allows leader submission without enabling parent-task progress updates", () => {
    expect(resolveTaskDetailCapabilities(false, {
      canReview: false,
      canPostProgress: false,
      canSubmitForReview: true,
      canDiscuss: true,
    })).toMatchObject({ canPostProgress: false, canSubmitForReview: true });
  });

  it("reserves subtask structure management for the Task Leader", () => {
    expect(resolveSubtaskManagementCapability(false, true)).toBe(true);
    expect(resolveSubtaskManagementCapability(false, false)).toBe(false);
    expect(resolveSubtaskManagementCapability(true, true)).toBe(false);
  });

  it("enforces read-only task oversight in the database", () => {
    expect(sql).toContain("public.is_super_admin(auth.uid())");
    expect(sql).toContain("before insert or update or delete on public.tasks");
    expect(sql).toContain("Admin task access is read-only");
  });
});
