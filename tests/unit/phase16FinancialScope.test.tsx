// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDepartmentBudget } from "../../src/app/features/budget/hooks/useDepartmentBudget";
import { useGeneralJournal } from "../../src/app/features/budget/hooks/useGeneralJournal";
import { resetAuthCaches } from "../../src/app/shared/authCacheReset";

const api = vi.hoisted(() => ({
  budget: vi.fn(),
  journal: vi.fn(),
  accounts: vi.fn().mockResolvedValue([]),
  onBudgetStatus: undefined as ((status: string) => void) | undefined,
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    channel: (topic: string) => {
      const channel = { on: () => channel, subscribe: (callback: (status: string) => void) => {
        if (topic.startsWith("office-budget:")) api.onBudgetStatus = callback;
        return channel;
      } };
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
  resetAuthCaches();
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
  it("shares a forced budget read across two consumers and clears rows on access denial", async () => {
    api.budget.mockResolvedValueOnce(bundle("old"));
    const first = renderHook(() => useDepartmentBudget("office", 2026));
    const second = renderHook(() => useDepartmentBudget("office", 2026));
    await waitFor(() => expect(second.result.current.summary?.id).toBe("old"));
    expect(api.budget).toHaveBeenCalledTimes(1);

    const next = deferred<ReturnType<typeof bundle>>();
    api.budget.mockReturnValueOnce(next.promise);
    await act(async () => {
      const pending = [first.result.current.refresh(), second.result.current.refresh()];
      expect(api.budget).toHaveBeenCalledTimes(2);
      next.resolve(bundle("current"));
      await Promise.all(pending);
    });
    expect(first.result.current.summary?.id).toBe("current");
    expect(second.result.current.summary?.id).toBe("current");

    api.budget.mockRejectedValueOnce(Object.assign(new Error("Permission denied"), { code: "42501" }));
    await act(async () => {
      await Promise.all([first.result.current.refresh(), second.result.current.refresh()]);
    });
    expect(first.result.current.summary).toBeNull();
    expect(second.result.current.summary).toBeNull();
  });
  it("joins a refresh on focus, then checks again after Realtime reconnects", async () => {
    api.budget.mockResolvedValueOnce(bundle("known"));
    const hook = renderHook(() => useDepartmentBudget("office", 2026));
    await waitFor(() => expect(hook.result.current.summary?.id).toBe("known"));
    const next = deferred<ReturnType<typeof bundle>>();
    api.budget.mockReturnValueOnce(next.promise);
    await act(async () => {
      const refresh = hook.result.current.refresh();
      window.dispatchEvent(new Event("focus"));
      next.resolve(bundle("updated"));
      await refresh;
    });
    await waitFor(() => expect(hook.result.current.summary?.id).toBe("updated"));
    expect(api.budget).toHaveBeenCalledTimes(2);

    api.budget.mockResolvedValueOnce(bundle("after-reconnect"));
    act(() => {
      api.onBudgetStatus?.("SUBSCRIBED");
      api.onBudgetStatus?.("CHANNEL_ERROR");
      api.onBudgetStatus?.("SUBSCRIBED");
    });
    await waitFor(() => expect(hook.result.current.summary?.id).toBe("after-reconnect"));
    expect(api.budget).toHaveBeenCalledTimes(3);
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
