import { beforeEach, describe, it, expect, vi } from "vitest";
const api = vi.hoisted(() => ({ result: {} as any }));
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          order: () => ({ limit: () => Promise.resolve(api.result) }),
        }),
      }),
    }),
  },
}));
import { fetchAdministrativeAuditWindow } from "../../src/app/features/audit/services/administrativeAuditWindow";
beforeEach(() => {
  api.result = { data: [], error: null, count: 0 };
});
describe("R12 bounded administrative audit", () => {
  it("distinguishes confirmed empty history from a failed read", async () => {
    expect(await fetchAdministrativeAuditWindow()).toEqual({
      events: [],
      total: 0,
    });
    api.result.error = { message: "failed" };
    await expect(fetchAdministrativeAuditWindow()).rejects.toThrow(
      "could not be read",
    );
  });
  it("reports the authorized total separately from the latest-500 window", async () => {
    api.result = {
      data: Array.from({ length: 500 }, (_, id) => ({
        id: String(id),
        created_at: "2026-10-01",
      })),
      count: 801,
      error: null,
    };
    const result = await fetchAdministrativeAuditWindow();
    expect(result.events).toHaveLength(500);
    expect(result.total).toBe(801);
  });
  it("rejects unknown or incomplete coverage rather than claiming complete history", async () => {
    api.result.count = null;
    await expect(fetchAdministrativeAuditWindow()).rejects.toThrow("coverage");
    api.result.count = 10;
    await expect(fetchAdministrativeAuditWindow()).rejects.toThrow("coverage");
  });
});
