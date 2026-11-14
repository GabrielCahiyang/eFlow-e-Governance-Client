import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../src/lib/supabase", () => ({ supabase: { rpc: api.rpc } }));

import { cancelTask } from "../../src/app/features/tasks/services/taskLifecycleService";

describe("task cancellation errors", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("explains statement timeouts without showing the raw Postgres message", async () => {
    api.rpc.mockResolvedValue({
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    });

    await expect(cancelTask("task-1", "No longer needed")).rejects.toThrow(
      "Task cancellation took longer than the server allows. No changes were saved. Refresh the task, then try again.",
    );
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith("cancel_task", {
      p_task_id: "task-1",
      p_reason: "No longer needed",
    });
  });

  it("keeps empty cancellation reasons local", async () => {
    await expect(cancelTask("task-1", "   ")).rejects.toThrow("A cancellation reason is required.");
    expect(api.rpc).not.toHaveBeenCalled();
  });
});
