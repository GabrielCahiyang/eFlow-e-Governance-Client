import { beforeEach, expect, jest, test } from "@jest/globals";
import { supabase } from "../../../../platform/supabase";
import {
  detailEditError,
  fetchDetailEditState,
  readDetailEditState,
  type WorkDetailEditState,
} from "../workDetailEditing";
jest.mock("../../../../platform/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));
const started: WorkDetailEditState = {
  version: 1,
  task_id: "task",
  node_id: null,
  updated_at: null,
  started: true,
  details: true,
  due: true,
  planning: false,
};
beforeEach(() => {
  jest.clearAllMocks();
});

test("a completed prerequisite does not unlock planning fields on started work", () => {
  expect(detailEditError(started, {})).toBe("");
  expect(detailEditError(started, { planning: true })).toMatch(
    /cannot change after work/,
  );
  expect(detailEditError(started, { due: true })).toMatch(/reason/);
  expect(
    detailEditError(started, { due: true, reason: "Approved reschedule" }),
  ).toBe("");
});
test("contributor or delegated detail editing cannot grant supervising reschedule authority", () => {
  const worker = { ...started, due: false };
  expect(detailEditError(worker, {})).toBe("");
  expect(
    detailEditError(worker, { due: true, reason: "Worker request" }),
  ).toMatch(/supervising Lead/);
});
test("pending-review and completed detail editing fail closed", () => {
  expect(detailEditError({ ...started, details: false }, {})).toMatch(
    /read-only/,
  );
  expect(detailEditError(undefined, {})).toMatch(/could not be verified/);
});
test("unstarted planning remains available to an authorized editor", () => {
  expect(
    detailEditError(
      { ...started, started: false, planning: true },
      { planning: true, due: true },
    ),
  ).toBe("");
});
test("cached, incomplete, wrong-record or unsupported policy responses cannot authorize edits", () => {
  for (const value of [
    null,
    {},
    { ...started, version: 2 },
    { ...started, task_id: "other" },
    { ...started, node_id: "other" },
    { ...started, started: undefined },
    { ...started, due: "true" },
  ])
    expect(readDetailEditState(value, "task")).toBeUndefined();
});
test("missing backend policy is an explicit unavailable state", async () => {
  jest
    .mocked(supabase.rpc)
    .mockResolvedValue({ data: null, error: { code: "PGRST202" } } as never);
  await expect(fetchDetailEditState("task")).rejects.toThrow(
    /shared editing update/,
  );
});
