// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  fetch: vi.fn(),
  invalidate: () => {},
  stop: vi.fn(),
}));
vi.mock(
  "../../src/app/features/audit/services/administrativeAuditWindow",
  () => ({
    fetchAdministrativeAuditWindow: api.fetch,
    subscribeAdministrativeAuditInvalidation: (callback: () => void) => {
      api.invalidate = callback;
      return api.stop;
    },
  }),
);
import { useAdministrativeAuditWindow } from "../../src/app/features/audit/hooks/useAdministrativeAuditWindow";
beforeEach(() => {
  api.fetch.mockReset();
  api.stop.mockClear();
});
afterEach(cleanup);
function deferred() {
  let resolve!: (value: { events: []; total: number }) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<{ events: []; total: number }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it("keeps a newer manual refresh when an older initial read fails", async () => {
  const older = deferred(),
    newer = deferred();
  api.fetch
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  const { result } = renderHook(useAdministrativeAuditWindow);
  let refresh!: Promise<void>;
  act(() => {
    refresh = result.current.refresh();
  });
  act(() => {
    void result.current.refresh();
  });
  expect(api.fetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    newer.resolve({ events: [], total: 0 });
    await refresh;
  });
  await act(async () => {
    older.reject(new Error("old failure"));
    await older.promise.catch(() => {});
  });
  expect(result.current.total).toBe(0);
  expect(result.current.error).toBe("");
  expect(result.current.loading).toBe(false);
});
it("invalidates an older refresh after realtime and stops reading on unmount", async () => {
  const older = deferred(),
    newer = deferred();
  api.fetch
    .mockResolvedValueOnce({ events: [], total: 0 })
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  const { result, unmount } = renderHook(useAdministrativeAuditWindow);
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    void result.current.refresh();
    api.invalidate();
  });
  await act(async () => {
    newer.reject(new Error("current failure"));
    await newer.promise.catch(() => {});
  });
  await act(async () => {
    older.resolve({ events: [], total: 0 });
    await older.promise;
  });
  expect(result.current.error).toBe("current failure");
  expect(result.current.total).toBeUndefined();
  unmount();
  expect(api.stop).toHaveBeenCalledOnce();
});
