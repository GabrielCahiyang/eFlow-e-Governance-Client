// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDepartmentBudget } from "../../src/app/features/budget/hooks/useDepartmentBudget";
import { useGeneralJournal } from "../../src/app/features/budget/hooks/useGeneralJournal";

const api = vi.hoisted(() => ({
  budget: vi.fn(),
  journal: vi.fn(),
  accounts: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  fetchDepartmentBudgetBundle: api.budget,
  fetchGeneralJournal: api.journal,
  fetchAccountingAccounts: api.accounts,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const bundle = (id: string) => ({
  summary: { id },
  requests: [],
  releases: [],
  liquidations: [],
  ledger: [],
  lines: [],
  commitments: [],
  allocations: [],
  allocationLines: [],
  requestAttachments: [],
  adjustments: [],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Phase 16 financial context isolation", () => {
  it("does not expose old Office rows while the new fiscal year is loading or failed", async () => {
    const later = deferred<ReturnType<typeof bundle>>();
    api.budget
      .mockResolvedValueOnce(bundle("2026"))
      .mockReturnValueOnce(later.promise);
    const hook = renderHook(({ year }) => useDepartmentBudget("office", year), {
      initialProps: { year: 2026 },
    });
    await waitFor(() => expect(hook.result.current.summary?.id).toBe("2026"));
    hook.rerender({ year: 2027 });
    expect(hook.result.current.summary).toBeNull();
    expect(hook.result.current.loading).toBe(true);
    await act(async () => later.resolve(bundle("2027")));
    expect(hook.result.current.summary?.id).toBe("2027");
    api.budget.mockRejectedValueOnce(new Error("Read failed"));
    hook.rerender({ year: 2028 });
    await waitFor(() => expect(hook.result.current.error).toBe("Read failed"));
    expect(hook.result.current.summary).toBeNull();
    expect(hook.result.current.loading).toBe(false);
  });
  it("ignores an older response after the selected year has finished loading", async () => {
    const older = deferred<ReturnType<typeof bundle>>();
    api.budget
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(bundle("new"));
    const hook = renderHook(({ year }) => useDepartmentBudget("office", year), {
      initialProps: { year: 2026 },
    });
    hook.rerender({ year: 2027 });
    await waitFor(() => expect(hook.result.current.summary?.id).toBe("new"));
    await act(async () => older.resolve(bundle("old")));
    expect(hook.result.current.summary?.id).toBe("new");
  });
  it("keeps same-scope rows visible during refresh and discloses a failed refresh", async () => {
    api.budget
      .mockResolvedValueOnce(bundle("known"))
      .mockRejectedValueOnce(new Error("Refresh unavailable"));
    const hook = renderHook(() => useDepartmentBudget("office", 2026));
    await waitFor(() => expect(hook.result.current.summary?.id).toBe("known"));
    await act(async () => hook.result.current.refresh());
    expect(hook.result.current.summary?.id).toBe("known");
    expect(hook.result.current.error).toBe("Refresh unavailable");
    expect(hook.result.current.loading).toBe(false);
  });
  it("keeps journal responses and account lists within the selected scope", async () => {
    const older = deferred<unknown[]>();
    api.journal
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce([{ id: "new" }]);
    const hook = renderHook(({ org }) => useGeneralJournal(org, 2026), {
      initialProps: { org: "old" },
    });
    hook.rerender({ org: "new" });
    expect(hook.result.current.entries).toEqual([]);
    await waitFor(() => expect(hook.result.current.entries[0]?.id).toBe("new"));
    await act(async () => older.resolve([{ id: "old" }]));
    expect(hook.result.current.entries[0]?.id).toBe("new");
    api.journal.mockRejectedValueOnce(new Error("Journal unavailable"));
    hook.rerender({ org: "other" });
    await waitFor(() =>
      expect(hook.result.current.error).toBe("Journal unavailable"),
    );
    expect(hook.result.current.entries).toEqual([]);
    expect(hook.result.current.accounts).toEqual([]);
  });
});
