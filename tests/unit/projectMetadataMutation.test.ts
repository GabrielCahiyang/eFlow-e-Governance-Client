import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  read: vi.fn(),
  rpc: vi.fn(),
  audit: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: api.read }) }) }),
    rpc: api.rpc,
  },
}));
vi.mock("../../src/app/services/auditService", () => ({
  recordAudit: api.audit,
}));
vi.mock("../../src/app/features/projects/services/projectQueryService", () => ({
  notifyProjectListeners: api.refresh,
}));
import { updateProject } from "../../src/app/features/projects/services/projectMutationService";
const version = "2026-10-20T00:00:00.123456Z";
beforeEach(() => {
  vi.clearAllMocks();
  api.read.mockResolvedValue({
    data: { id: "p", status: "planning", org_id: "office", owner_id: "head" },
    error: null,
  });
  api.rpc.mockResolvedValue({ error: null });
});
describe("atomic metadata service", () => {
  it("sends the exact observed version and allowed column mapping", async () => {
    await updateProject(
      "p",
      { title: "Updated", startDate: "", targetDate: "2099-01-01" },
      version,
    );
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith("update_project_metadata", {
      p_project_id: "p",
      p_expected_updated_at: version,
      p_changes: {
        title: "Updated",
        start_date: null,
        target_date: "2099-01-01",
      },
    });
    expect(api.refresh).toHaveBeenCalledOnce();
  });
  it("requires an observed version and never silently retries a conflict", async () => {
    await expect(updateProject("p", { title: "Edit" })).rejects.toThrow(
      /Refresh project details/,
    );
    expect(api.rpc).not.toHaveBeenCalled();
    api.rpc.mockResolvedValue({ error: { code: "40001", message: "Stale" } });
    await expect(
      updateProject("p", { title: "Edit" }, version),
    ).rejects.toThrow(/updated elsewhere/);
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.audit).not.toHaveBeenCalled();
  });
  it("fails closed on a denied read and refuses generic lifecycle/ownership changes", async () => {
    api.read.mockResolvedValueOnce({
      data: null,
      error: { message: "Read denied" },
    });
    await expect(
      updateProject("p", { title: "Edit" }, version),
    ).rejects.toEqual({ message: "Read denied" });
    await expect(
      updateProject("p", { status: "active" }, version),
    ).rejects.toThrow(/lifecycle/);
    await expect(
      updateProject("p", { ownerId: "foreign" }, version),
    ).rejects.toThrow(/ownership/);
    expect(api.rpc).not.toHaveBeenCalled();
  });
});
