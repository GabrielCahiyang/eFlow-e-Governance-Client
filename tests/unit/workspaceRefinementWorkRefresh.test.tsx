// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock(
  "../../src/app/features/personal-work/services/workFeedService",
  () => ({ loadWorkFeed: api.load }),
);
vi.mock("../../src/app/features/project-access", () => ({
  ACCESS_CHANGED_EVENT: "eflow-project-access-changed",
}));
import { useWorkFeed } from "../../src/app/features/personal-work/hooks/useWorkFeed";
const data = {
  rows: [{ key: "old" }],
  projects: [],
  workspaces: [],
  issues: [],
  unavailable: [],
  loadedAt: 1,
};
function pending() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe("R10 access-sensitive feed lifecycle", () => {
  it("does not confuse an empty selected project scope with an unrestricted fallback", async () => {
    const workspace = {
      id: "office",
      name: "Office",
      kind: "office" as const,
      office_id: "office",
      owner_id: null,
      state: "active" as const,
      timezone: "Asia/Singapore",
    };
    api.load.mockResolvedValueOnce(data);
    const next = pending();
    const view = renderHook(
      ({ ids }: { ids?: string[] }) =>
        useWorkFeed("me", { workspace, projectIds: ids }),
      { initialProps: { ids: undefined } },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(data));
    api.load.mockReturnValue(next.promise);
    view.rerender({ ids: [] });
    expect(view.result.current.data).toBeUndefined();
    await act(async () => next.resolve({ ...data, rows: [] }));
    expect(view.result.current.data?.rows).toEqual([]);
  });
  it("allows a slow source refresh to finish without overlapping polling", async () => {
    vi.useFakeTimers();
    const next = pending();
    api.load.mockReturnValue(next.promise);
    const view = renderHook(() => useWorkFeed("me"));
    await act(async () => vi.advanceTimersByTime(45000));
    expect(api.load).toHaveBeenCalledTimes(1);
    await act(async () => next.resolve(data));
    expect(view.result.current.data).toEqual(data);
    await act(async () => vi.advanceTimersByTime(15000));
    expect(api.load).toHaveBeenCalledTimes(2);
  });
  it("clears rows during actor changes and ignores late responses from the old actor", async () => {
    api.load.mockResolvedValueOnce(data);
    const old = pending(),
      next = pending();
    const view = renderHook(({ user }) => useWorkFeed(user), {
      initialProps: { user: "one" },
    });
    await waitFor(() => expect(view.result.current.data).toEqual(data));
    api.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    act(() => {
      void view.result.current.refresh();
    });
    view.rerender({ user: "two" });
    expect(view.result.current.data).toBeUndefined();
    await act(async () => old.resolve(data));
    expect(view.result.current.data).toBeUndefined();
    await act(async () => next.resolve({ ...data, rows: [] }));
    expect(view.result.current.data?.rows).toEqual([]);
  });
  it("rechecks access events, clears denied data, and unregisters on unmount", async () => {
    api.load.mockResolvedValue(data);
    const view = renderHook(() => useWorkFeed("me"));
    await waitFor(() => expect(view.result.current.data).toEqual(data));
    api.load.mockRejectedValue(new Error("Expired access"));
    act(() => window.dispatchEvent(new Event("eflow-project-access-changed")));
    await waitFor(() =>
      expect(view.result.current.error).toBe("Expired access"),
    );
    expect(view.result.current.data).toBeUndefined();
    const count = api.load.mock.calls.length;
    view.unmount();
    act(() => window.dispatchEvent(new Event("eflow-project-access-changed")));
    expect(api.load).toHaveBeenCalledTimes(count);
  });
});
