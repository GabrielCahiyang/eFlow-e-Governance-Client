import { beforeEach, expect, jest, test } from "@jest/globals";
import { rememberWorkCapabilityContext } from "../../../../core/web/app/features/nested-work/selectors/capabilities";
import {
  fetchWorkTree,
  saveWorkTree,
} from "../../../../core/web/app/features/nested-work/services/workTreeService";
import type {
  WorkRequest,
  WorkTreeSnapshot,
} from "../../../../core/web/app/features/nested-work/types";
import { supabase } from "../../../../platform/supabase";
import { recoverWorkRequest } from "../workRecovery";

jest.mock("../../../../platform/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock(
  "../../../../core/web/app/features/nested-work/services/workTreeService",
  () => ({
    fetchWorkTree: jest.fn(),
    saveWorkTree: jest.fn(),
  }),
);

beforeEach(() => {
  jest.clearAllMocks();
});

function snapshot(appoint: boolean, contributors = true) {
  const tree = {
    revision: 2,
    root: {
      id: "task",
      project: "project",
      office: "office",
      kind: "office",
      open: true,
      lead: "actor",
      people: ["actor"],
      capabilities: {
        appoint_lead: appoint
          ? { allowed: true, reason_code: null }
          : { allowed: false, reason_code: "appointment_denied" },
        manage_contributors: contributors
          ? { allowed: true, reason_code: null }
          : { allowed: false, reason_code: "branch_denied" },
      },
    },
    nodes: [],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(tree, "actor");
  return tree;
}

test("an uncommitted edit cannot replay after detail authority is revoked", async () => {
  const tree = snapshot(false);
  tree.nodes = [{ id: "node", task_id: "task", status: "in_progress", capabilities: {
    edit_details: { allowed: false, reason_code: "branch_denied" },
  } }] as WorkTreeSnapshot["nodes"];
  jest.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as never);
  jest.mocked(fetchWorkTree).mockResolvedValue(tree);
  await expect(recoverWorkRequest("task", { id: "edit-request", revision: 2, command: "edit",
    payload: { id: "node", title: "Retained title", due: null } }, "actor")).rejects.toMatchObject({ kind: "confirmed_failure" });
  expect(saveWorkTree).not.toHaveBeenCalled();
});

test("a retained due-date edit rechecks supervising authority without changing its request", async () => {
  const tree = snapshot(false);
  tree.nodes = [{ id: "node", task_id: "task", status: "in_progress", due_date: "2026-11-20",
    detail_edit: { version: 1, task_id: "task", node_id: "node", started: true, details: true, due: false, planning: false },
    capabilities: { edit_details: { allowed: true, reason_code: null } },
  }] as unknown as WorkTreeSnapshot["nodes"];
  jest.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as never);
  jest.mocked(fetchWorkTree).mockResolvedValue(tree);
  const request: WorkRequest = { id: "edit-request", revision: 2, command: "edit",
    payload: { id: "node", title: "Retained title", due: "2026-11-21", note: "Original reason" } };
  await expect(recoverWorkRequest("task", request, "actor")).rejects.toThrow(/supervising Lead/);
  expect(request.payload.note).toBe("Original reason");
  expect(saveWorkTree).not.toHaveBeenCalled();
});

test.each(["root_lead", "contributors"] as const)(
  "uncommitted %s recovery cannot write after its specific authority is lost",
  async (command) => {
    const request: WorkRequest = {
      id: "same-request",
      revision: 2,
      command,
      payload: { people: ["actor", "worker"] },
    };
    jest
      .mocked(supabase.rpc)
      .mockResolvedValue({ data: false, error: null } as never);
    jest.mocked(fetchWorkTree).mockResolvedValue(snapshot(false, false));
    await expect(
      recoverWorkRequest("task", request, "actor"),
    ).rejects.toMatchObject({
      kind: "confirmed_failure",
      message:
        command === "root_lead"
          ? "Only the Project Lead or responsible Office Head can change the Task Lead."
          : "You do not have permission for this action on this work.",
    });
    expect(saveWorkTree).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith("nw_work_command_receipt", {
      p_root: "task",
      p_request: "same-request",
      p_command: command,
      p_payload: request.payload,
    });
  },
);

test("an already committed Task staffing request is verified even after appointment authority is lost", async () => {
  const tree = snapshot(false);
  jest
    .mocked(supabase.rpc)
    .mockResolvedValue({ data: true, error: null } as never);
  jest.mocked(fetchWorkTree).mockResolvedValue(tree);
  await expect(
    recoverWorkRequest(
      "task",
      {
        id: "committed",
        revision: 1,
        command: "contributors",
        payload: { people: ["actor"] },
      },
      "actor",
    ),
  ).resolves.toBe(tree);
  expect(saveWorkTree).not.toHaveBeenCalled();
});

test("an authorized uncommitted Task staffing retry preserves its exact request", async () => {
  const tree = snapshot(false);
  const request: WorkRequest = {
    id: "same-request",
    revision: 2,
    command: "contributors",
    payload: { people: ["actor", "worker"] },
  };
  jest
    .mocked(supabase.rpc)
    .mockResolvedValue({ data: false, error: null } as never);
  jest.mocked(fetchWorkTree).mockResolvedValue(tree);
  jest.mocked(saveWorkTree).mockResolvedValue(tree);
  await expect(recoverWorkRequest("task", request, "actor")).resolves.toBe(
    tree,
  );
  expect(saveWorkTree).toHaveBeenCalledWith("task", request);
});

test("a Task Lead cannot replay a Lead transfer merely because contributor editing remains allowed", async () => {
  jest
    .mocked(supabase.rpc)
    .mockResolvedValue({ data: false, error: null } as never);
  jest.mocked(fetchWorkTree).mockResolvedValue(snapshot(false));
  await expect(
    recoverWorkRequest(
      "task",
      {
        id: "transfer",
        revision: 2,
        command: "root_lead",
        payload: { lead: "other", people: ["actor", "other"] },
      },
      "actor",
    ),
  ).rejects.toMatchObject({ kind: "confirmed_failure" });
  expect(saveWorkTree).not.toHaveBeenCalled();
});

test.each([false, true])(
  "Subtask contributor recovery with Lead transfer=%s rechecks the corresponding permission",
  async (transfer) => {
    const tree = snapshot(false);
    tree.nodes = [
      {
        id: "sub",
        task_id: "task",
        lead_id: "actor",
        capabilities: {
          appoint_lead: { allowed: false, reason_code: "appointment_denied" },
          manage_contributors: { allowed: true, reason_code: null },
        },
      },
    ] as WorkTreeSnapshot["nodes"];
    jest
      .mocked(supabase.rpc)
      .mockResolvedValue({ data: false, error: null } as never);
    jest.mocked(fetchWorkTree).mockResolvedValue(tree);
    jest.mocked(saveWorkTree).mockResolvedValue(tree);
    const request: WorkRequest = {
      id: "same-subtask-request",
      revision: 2,
      command: "staff",
      payload: {
        id: "sub",
        lead: transfer ? "other" : "actor",
        people: ["actor", "other"],
      },
    };
    if (transfer) {
      await expect(
        recoverWorkRequest("task", request, "actor"),
      ).rejects.toMatchObject({ kind: "confirmed_failure" });
      expect(saveWorkTree).not.toHaveBeenCalled();
    } else {
      await expect(recoverWorkRequest("task", request, "actor")).resolves.toBe(
        tree,
      );
      expect(saveWorkTree).toHaveBeenCalledWith("task", request);
    }
  },
);
