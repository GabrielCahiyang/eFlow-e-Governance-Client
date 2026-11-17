import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { captureWorkEditorBaseline } from "../../../../core/web/app/features/nested-work/selectors/editorDraft";
import { rememberWorkCapabilityContext } from "../../../../core/web/app/features/nested-work/selectors/capabilities";
import type { WorkTreeSnapshot } from "../../../../core/web/app/features/nested-work/types";
import { WorkRequestFailure } from "../../../../core/web/app/features/nested-work/types/editor";
import { draftStore } from "../../../../platform/draftStore";
import { recoverWorkRequest } from "../workRecovery";
import { WorkEditorSheet } from "../WorkEditorSheet";
import { fetchWorkTree, saveWorkTree } from "../../../../core/web/app/features/nested-work/services/workTreeService";

jest.mock("../../../../core/web/app/features/nested-work/services/workTreeService", () => ({
  fetchWorkTree: jest.fn(),
  saveWorkTree: jest.fn(),
}));

jest.mock("../../authentication", () => ({
  useAuth: () => ({ profile: { id: "actor" } }),
}));
jest.mock("../../../../platform/supabase", () => ({ supabase: {} }));
jest.mock("../../../../platform/draftStore", () => ({
  draftStore: { get: jest.fn(), remove: jest.fn(), set: jest.fn() },
}));
jest.mock("../workRecovery", () => ({
  ...jest.requireActual<object>("../workRecovery"),
  recoverWorkRequest: jest.fn(),
}));

test("a confirmed rejection restores saved Subtask details with the specific error", async () => {
  const data = {
    root: { status: "in_progress", id: "task", kind: "office", office: "office", project: "project",
      open: true, people: [], capabilities: { create_child: { allowed: true, reason_code: null } } },
    revision: 3,
    nodes: [],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  const edit = { command: "create" } as const;
  const baseline = captureWorkEditorBaseline(data, edit, "actor", "original-node");
  jest.mocked(draftStore.get).mockResolvedValue({
    baseline,
    fields: { ...baseline.fields, title: "Prepare venue invitation" },
    request: { id: "original-request", revision: 3, command: "create", payload: {} },
  });
  jest.mocked(recoverWorkRequest).mockRejectedValue(
    new WorkRequestFailure("confirmed_failure", "Choose a start date within the parent schedule, or reschedule the parent first"),
  );
  await render(<WorkEditorSheet data={data} edit={edit} onClose={jest.fn()} onSaved={async () => {}} />);
  expect(await screen.findByText(/An earlier save still needs to be confirmed/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Add subtask" }));
  expect(await screen.findByText(/Choose a start date within the parent schedule/)).toBeOnTheScreen();
  expect(screen.getByDisplayValue("Prepare venue invitation")).toHaveProp("editable", true);
  expect(draftStore.remove).toHaveBeenCalledWith("actor", "work.task");
});

test("a confirmed save closes the editor and refreshes the list without a notice", async () => {
  const data = {
    root: { status: "in_progress",
      id: "task", kind: "office", office: "office", project: "project",
      open: true, lead: "task-lead", people: [],
      scheduling: { version: 1, today: "2026-11-13" },
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    revision: 3,
    nodes: [],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  const edit = { command: "create" } as const;
  const baseline = captureWorkEditorBaseline(data, edit, "actor", "original-node");
  jest.mocked(draftStore.get).mockResolvedValue({
    baseline, fields: baseline.fields,
    request: {
      id: "original-request", revision: 3, command: "create",
      payload: { id: "original-node", start: "2026-11-25" },
    },
  });
  jest.mocked(recoverWorkRequest).mockResolvedValue(data);
  const onClose = jest.fn();
  const onSaved = jest.fn(async (_receipt: WorkTreeSnapshot) => {});
  await render(<WorkEditorSheet data={data} edit={edit} onClose={onClose} onSaved={onSaved} />);
  await fireEvent.press(await screen.findByRole("button", { name: "Add subtask" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledWith(data);
  expect(screen.queryByText("Subtask saved")).toBeNull();
});

test.each(["create", "edit"] as const)("Office Subtask %s saves the selected priority with the work request", async (command) => {
  const data = {
    root: { status: "in_progress", id: "task", kind: "office", office: "office", project: "project",
      open: true, people: [], capabilities: { create_child: { allowed: true, reason_code: null } } },
    revision: 3,
    supportsSubtaskDependencies: true,
    nodes: [{
      id: "node", task_id: "task", title: "Prepare invitation", priority: "low",
      parent_subtask_id: null, assigned_to_ids: [], status: "todo",
      capabilities: { edit_details: { allowed: true, reason_code: null } },
    }],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  jest.mocked(saveWorkTree).mockResolvedValue(data);
  const edit = command === "create" ? { command } : { command, node: data.nodes[0] };
  await render(<WorkEditorSheet data={data} edit={edit} onClose={jest.fn()} onSaved={async () => {}} />);
  const priority = await screen.findByRole("button", { name: "Priority" });
  expect(screen.getByText("Subtask name *")).toBeOnTheScreen();
  if (command === "create") await fireEvent.changeText(screen.getByLabelText("Subtask name"), "Prepare invitation");
  expect(screen.getByText(command === "create" ? "Medium" : "Low")).toBeOnTheScreen();
  await fireEvent.press(priority);
  await fireEvent.press(await screen.findByRole("radio", { name: "High" }));
  await fireEvent.press(screen.getByRole("button", { name: command === "create" ? "Add subtask" : "Save subtask" }));
  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledWith("task", expect.objectContaining({
    command, payload: expect.objectContaining({ priority: "high" }),
  })));
});

test("an authorized Subtask editor replaces legacy sequencing with selected sibling prerequisites", async () => {
  const data = {
    root: { status: "in_progress", id: "task", kind: "office", office: "office", project: "project", open: true, people: [] },
    supportsSubtaskDependencies: true,
    revision: 3,
    nodes: [
      { id: "a", task_id: "task", parent_subtask_id: null, title: "First step", sibling_order: 0, status: "completed" },
      { id: "b", task_id: "task", parent_subtask_id: null, title: "Second step", sibling_order: 1,
        status: "todo", dependency_ids: null, can_edit_dependencies: true, assigned_to_ids: [],
        capabilities: { edit_details: { allowed: true, reason_code: null } } },
      { id: "c", task_id: "task", parent_subtask_id: null, title: "Third step", sibling_order: 2, status: "completed" },
    ],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  jest.mocked(saveWorkTree).mockResolvedValue(data);
  await render(<WorkEditorSheet data={data} edit={{ command: "edit", node: data.nodes[1] }}
    onClose={jest.fn()} onSaved={async () => {}} />);
  const prerequisitesButton = await screen.findByRole("button", { name: "Prerequisite subtasks" });
  expect(screen.queryByRole("button", { name: "Choose explicit prerequisites" })).toBeNull();
  expect(screen.queryByLabelText("Can start independently")).toBeNull();
  expect(screen.queryByText(/Can start independently/)).toBeNull();
  expect(screen.queryByText(/Choose explicit prerequisites after creating/)).toBeNull();
  expect(screen.queryByLabelText("Work note")).toBeNull();
  await fireEvent.press(prerequisitesButton);
  await fireEvent.press(await screen.findByRole("checkbox", { name: "First step" }));
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Third step" }));
  const prerequisiteClose = screen.getAllByLabelText("Close dialog").at(-1);
  if (prerequisiteClose) await fireEvent.press(prerequisiteClose);
  await fireEvent.press(screen.getByRole("button", { name: "Save subtask" }));
  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledWith("task", expect.objectContaining({
    command: "edit", payload: expect.objectContaining({ id: "b", dependency_ids: ["c"] }),
  })));
});

test("an authorized pre-start editor can remove a visible cancelled selected prerequisite", async () => {
  const data = {
    root: { status: "in_progress", id: "task", kind: "office", office: "office", project: "project", open: true, people: [] },
    supportsSubtaskDependencies: true, revision: 3,
    nodes: [
      { id: "cancelled", task_id: "task", parent_subtask_id: null, title: "Cancelled prerequisite",
        sibling_order: 0, status: "cancelled" },
      { id: "target", task_id: "task", parent_subtask_id: null, title: "Target", sibling_order: 1,
        status: "todo", dependency_ids: ["cancelled"], can_edit_dependencies: true, assigned_to_ids: [],
        capabilities: { edit_details: { allowed: true, reason_code: null } } },
    ], people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  jest.mocked(saveWorkTree).mockResolvedValue(data);
  await render(<WorkEditorSheet data={data} edit={{ command: "edit", node: data.nodes[1] }}
    onClose={jest.fn()} onSaved={async () => {}} />);
  expect(screen.queryByText(/restricted prerequisite.*read-only/)).toBeNull();
  await fireEvent.press(await screen.findByRole("button", { name: "Prerequisite subtasks" }));
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Unavailable prerequisite — remove to continue" }));
  const close = screen.getAllByLabelText("Close dialog").at(-1);
  if (close) await fireEvent.press(close);
  await fireEvent.press(screen.getByRole("button", { name: "Save subtask" }));
  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledWith("task", expect.objectContaining({
    command: "edit", payload: expect.objectContaining({ id: "target", dependency_ids: [] }),
  })));
});

test("Subtask creation exposes Prerequisite subtasks directly and saves selected prerequisites in two steps", async () => {
  const data = {
    root: { status: "in_progress",
      id: "task-create-deps",
      kind: "office",
      office: "office",
      project: "project",
      open: true,
      can_edit_dependencies: true,
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    supportsSubtaskDependencies: true,
    revision: 3,
    nodes: [
      { id: "a", task_id: "task-create-deps", parent_subtask_id: null, title: "First step", sibling_order: 0, status: "todo", capabilities: {} },
    ],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  let createdId = "";
  let finalSnapshot: WorkTreeSnapshot | undefined;
  jest.mocked(saveWorkTree)
    .mockImplementationOnce(async (_taskId, req) => {
      createdId = String((req.payload as Record<string, unknown>).id);
      return {
        ...data,
        revision: 4,
        nodes: [
          ...data.nodes,
          {
            id: createdId,
            task_id: "task-create-deps",
            parent_subtask_id: null,
            title: "Second step",
            sibling_order: 1,
            status: "todo",
            standalone: false,
            dependency_ids: null,
            can_edit_dependencies: true,
            assigned_to_ids: [],
            capabilities: { edit_details: { allowed: true, reason_code: null } },
          },
        ],
      } as unknown as WorkTreeSnapshot;
    })
    .mockImplementationOnce(async () => {
      finalSnapshot = {
        ...data,
        revision: 5,
        nodes: [
          ...data.nodes,
          {
            id: createdId,
            task_id: "task-create-deps",
            parent_subtask_id: null,
            title: "Second step",
            sibling_order: 1,
            status: "todo",
            standalone: false,
            dependency_ids: ["a"],
            can_edit_dependencies: true,
            assigned_to_ids: [],
            capabilities: { edit_details: { allowed: true, reason_code: null } },
          },
        ],
      } as unknown as WorkTreeSnapshot;
      return finalSnapshot;
    });
  const onSaved = jest.fn(async (_snapshot?: WorkTreeSnapshot) => {});
  const onClose = jest.fn();

  await render(<WorkEditorSheet data={data} edit={{ command: "create" }} onClose={onClose} onSaved={onSaved} />);

  const prerequisitesButton = await screen.findByRole("button", { name: "Prerequisite subtasks" });
  expect(screen.queryByRole("button", { name: "Choose explicit prerequisites" })).toBeNull();
  expect(screen.queryByLabelText("Can start independently")).toBeNull();
  expect(screen.queryByText(/Can start independently/)).toBeNull();
  expect(screen.queryByText(/Choose explicit prerequisites after creating/)).toBeNull();
  expect(screen.queryByLabelText("Work note")).toBeNull();

  await fireEvent.changeText(screen.getByLabelText("Subtask name"), "Second step");
  await fireEvent.press(prerequisitesButton);
  await fireEvent.press(await screen.findByRole("checkbox", { name: "First step" }));
  const closeDialog = screen.getAllByLabelText("Close dialog").at(-1);
  if (closeDialog) await fireEvent.press(closeDialog);
  await fireEvent.press(screen.getByRole("button", { name: "Add subtask" }));

  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledTimes(2));
  expect(jest.mocked(saveWorkTree).mock.calls[0]?.[1]).toEqual(expect.objectContaining({
    command: "create",
    payload: expect.objectContaining({
      id: createdId,
      title: "Second step",
      standalone: false,
    }),
  }));
  expect((jest.mocked(saveWorkTree).mock.calls[0]?.[1] as { payload: Record<string, unknown> }).payload.dependency_ids).toBeUndefined();
  expect(jest.mocked(saveWorkTree).mock.calls[1]?.[1]).toEqual(expect.objectContaining({
    command: "edit",
    revision: 4,
    payload: expect.objectContaining({
      id: createdId,
      dependency_ids: ["a"],
    }),
  }));
  expect(finalSnapshot).toBeDefined();
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(finalSnapshot));
  expect(onClose).toHaveBeenCalled();
});

test("Subtask creation without prerequisites sends standalone true and persists empty explicit list", async () => {
  const data = {
    root: { status: "in_progress",
      id: "task-create-empty-deps",
      kind: "office",
      office: "office",
      project: "project",
      open: true,
      can_edit_dependencies: true,
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    supportsSubtaskDependencies: true,
    revision: 3,
    nodes: [
      { id: "a", task_id: "task-create-empty-deps", parent_subtask_id: null, title: "First step", sibling_order: 0, status: "todo", capabilities: {} },
    ],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  let createdId = "";
  jest.mocked(saveWorkTree)
    .mockImplementationOnce(async (_taskId, req) => {
      createdId = String((req.payload as Record<string, unknown>).id);
      return {
        ...data,
        revision: 4,
        nodes: [
          ...data.nodes,
          {
            id: createdId,
            task_id: "task-create-empty-deps",
            parent_subtask_id: null,
            title: "Independent step",
            sibling_order: 1,
            status: "todo",
            standalone: true,
            dependency_ids: null,
            can_edit_dependencies: true,
            assigned_to_ids: [],
            capabilities: { edit_details: { allowed: true, reason_code: null } },
          },
        ],
      } as unknown as WorkTreeSnapshot;
    })
    .mockResolvedValueOnce({ ...data, revision: 5 } as unknown as WorkTreeSnapshot);

  await render(<WorkEditorSheet data={data} edit={{ command: "create" }} onClose={jest.fn()} onSaved={async () => {}} />);

  await fireEvent.changeText(await screen.findByLabelText("Subtask name"), "Independent step");
  await fireEvent.press(screen.getByRole("button", { name: "Add subtask" }));

  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledTimes(2));
  expect(jest.mocked(saveWorkTree).mock.calls[0]?.[1]).toEqual(expect.objectContaining({
    command: "create",
    payload: expect.objectContaining({ standalone: true }),
  }));
  expect(jest.mocked(saveWorkTree).mock.calls[1]?.[1]).toEqual(expect.objectContaining({
    command: "edit",
    revision: 4,
    payload: expect.objectContaining({ id: createdId, dependency_ids: [] }),
  }));
});

test("Subtask creation avoids duplicate create if step 2 prerequisite write fails", async () => {
  const data = {
    root: { status: "in_progress",
      id: "task-step2-fail",
      kind: "office",
      office: "office",
      project: "project",
      open: true,
      can_edit_dependencies: true,
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    supportsSubtaskDependencies: true,
    revision: 3,
    nodes: [
      { id: "a", task_id: "task-step2-fail", parent_subtask_id: null, title: "First step", sibling_order: 0, status: "todo", capabilities: {} },
    ],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  let createdSnapshot: WorkTreeSnapshot | undefined;
  jest.mocked(saveWorkTree)
    .mockImplementationOnce(async (_taskId, req) => {
      const createdId = String((req.payload as Record<string, unknown>).id);
      createdSnapshot = {
        ...data,
        revision: 4,
        nodes: [
          ...data.nodes,
          {
            id: createdId,
            task_id: "task-step2-fail",
            parent_subtask_id: null,
            title: "Follow-up step",
            sibling_order: 1,
            status: "todo",
            standalone: false,
            dependency_ids: null,
            can_edit_dependencies: true,
            assigned_to_ids: [],
            capabilities: { edit_details: { allowed: true, reason_code: null } },
          },
        ],
      } as unknown as WorkTreeSnapshot;
      return createdSnapshot;
    })
    .mockRejectedValueOnce(new Error("Could not attach prerequisites"));
  const onSaved = jest.fn(async (_snapshot?: WorkTreeSnapshot) => {});
  const onClose = jest.fn();

  await render(<WorkEditorSheet data={data} edit={{ command: "create" }} onClose={onClose} onSaved={onSaved} />);

  await fireEvent.changeText(await screen.findByLabelText("Subtask name"), "Follow-up step");
  await fireEvent.press(screen.getByRole("button", { name: "Prerequisite subtasks" }));
  await fireEvent.press(await screen.findByRole("checkbox", { name: "First step" }));
  const closeDialog = screen.getAllByLabelText("Close dialog").at(-1);
  if (closeDialog) await fireEvent.press(closeDialog);
  await fireEvent.press(screen.getByRole("button", { name: "Add subtask" }));

  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledTimes(2));
  expect(createdSnapshot).toBeDefined();
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(createdSnapshot));
  expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  const doneButton = await screen.findByRole("button", { name: "Close work form" });
  await fireEvent.press(doneButton);
  expect(saveWorkTree).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalled();
});

test("Subtask editor rejects dependency cycles but permits an overlapping prerequisite", async () => {
  const data = {
    root: { status: "in_progress",
      id: "task-cycle",
      scheduleBounds: { projectStart: "2026-11-01", projectDue: "2026-11-30", taskStart: "2026-11-01", taskDue: "2026-11-30" },
      kind: "office",
      office: "office",
      project: "project",
      open: true,
      can_edit_dependencies: true,
      people: [],
    },
    supportsSubtaskDependencies: true,
    revision: 3,
    nodes: [
      {
        id: "a",
        task_id: "task-cycle",
        parent_subtask_id: null,
        title: "First step",
        sibling_order: 0,
        status: "todo",
        dependency_ids: [],
        start_date: "2026-11-10",
        due_date: "2026-11-20",
        can_edit_dependencies: true,
        assigned_to_ids: [],
        capabilities: { edit_details: { allowed: true, reason_code: null } },
      },
      {
        id: "b",
        task_id: "task-cycle",
        parent_subtask_id: null,
        title: "Second step",
        sibling_order: 1,
        status: "todo",
        dependency_ids: ["a"],
        start_date: "2026-11-22",
        due_date: "2026-11-25",
        can_edit_dependencies: true,
        assigned_to_ids: [],
        capabilities: { edit_details: { allowed: true, reason_code: null } },
      },
      {
        id: "c",
        task_id: "task-cycle",
        parent_subtask_id: null,
        title: "Later step",
        sibling_order: 2,
        status: "todo",
        dependency_ids: [],
        start_date: "2026-11-26",
        due_date: "2026-11-28",
        can_edit_dependencies: true,
        assigned_to_ids: [],
        capabilities: { edit_details: { allowed: true, reason_code: null } },
      },
    ],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);

  await render(<WorkEditorSheet data={data} edit={{ command: "edit", node: data.nodes[0] }} onClose={jest.fn()} onSaved={async () => {}} />);

  await fireEvent.press(await screen.findByRole("button", { name: "Prerequisite subtasks" }));
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Second step" }));
  expect(await screen.findByText("These prerequisites would create a circular dependency.")).toBeOnTheScreen();
  const closeDialog1 = screen.getAllByLabelText("Close dialog").at(-1);
  if (closeDialog1) await fireEvent.press(closeDialog1);
  await fireEvent.press(screen.getByRole("button", { name: "Save subtask" }));

  expect((await screen.findAllByText("These prerequisites would create a circular dependency.")).length).toBeGreaterThan(0);
  expect(saveWorkTree).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "Prerequisite subtasks" }));
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Second step" }));
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Later step" }));
  expect(screen.queryByText("The subtask starts before a selected prerequisite is due. Adjust the schedule first.")).toBeNull();
  const closeDialog2 = screen.getAllByLabelText("Close dialog").at(-1);
  if (closeDialog2) await fireEvent.press(closeDialog2);
  await fireEvent.press(screen.getByRole("button", { name: "Save subtask" }));

  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledWith("task-cycle", expect.objectContaining({
    payload: expect.objectContaining({ id: "a", dependency_ids: ["c"] }),
  })));
});

test("Personal tasks show honest prerequisite notice without Can start independently", async () => {
  const data = {
    root: {
      id: "task-personal-deps",
      kind: "personal",
      office: null,
      project: null,
      open: true,
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    supportsSubtaskDependencies: true,
    revision: 1,
    nodes: [],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);

  await render(<WorkEditorSheet data={data} edit={{ command: "create" }} onClose={jest.fn()} onSaved={async () => {}} />);

  expect(await screen.findByText("Prerequisite selection is only available on project tasks.")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Can start independently")).toBeNull();
  expect(screen.queryByRole("button", { name: "Choose explicit prerequisites" })).toBeNull();
});

test("WorkEditorSheet omits Appointed Lead and Contributors on create in both active and planning projects", async () => {
  const data = {
    root: { status: "in_progress",
      id: "task-staffing-gate",
      kind: "office",
      office: "office",
      project: "project",
      lead: "other-task-lead",
      open: true,
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    revision: 1,
    nodes: [],
    people: [{ id: "actor", name: "Project Lead" }, { id: "worker-1", name: "Worker One" }],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);

  const activeView = await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "create" }}
      projectStatus="active"
      projectLeadId="actor"
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  expect(await activeView.findByText("Subtask name *")).toBeOnTheScreen();
  expect(activeView.queryByRole("button", { name: "Appointed Lead" })).toBeNull();
  expect(activeView.queryByRole("button", { name: "Contributors" })).toBeNull();
  await activeView.unmount();

  const planningView = await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "create" }}
      projectStatus="planning"
      projectLeadId="actor"
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  expect(await planningView.findByText("Subtask name *")).toBeOnTheScreen();
  expect(planningView.queryByRole("button", { name: "Appointed Lead" })).toBeNull();
  expect(planningView.queryByRole("button", { name: "Contributors" })).toBeNull();
  await planningView.unmount();
});

test("WorkEditorSheet keeps Search options on Appointed Lead with fewer than six people while omitting it on static Priority", async () => {
  const data = {
    root: { status: "in_progress",
      id: "task-search-options",
      kind: "office",
      office: "office",
      project: "project",
      lead: "actor",
      open: true,
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    supportsSubtaskDependencies: true,
    revision: 1,
    nodes: [
      {
        id: "node-search-options",
        task_id: "task-search-options",
        parent_subtask_id: null,
        title: "Staffable item",
        sibling_order: 0,
        status: "todo",
        lead_id: null,
        assigned_to_ids: [],
        capabilities: {
          appoint_lead: { allowed: true, reason_code: null },
          edit_details: { allowed: true, reason_code: null },
        },
      },
    ],
    people: [
      { id: "actor", name: "Andres Manili" },
      { id: "worker-1", name: "Cheryl Gallo" },
    ],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(draftStore.get).mockResolvedValue(null);
  jest.mocked(fetchWorkTree).mockResolvedValue(data);

  const staffView = await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "staff", node: data.nodes[0] }}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );

  await fireEvent.press(await staffView.findByRole("button", { name: "Appointed Lead" }));
  expect(staffView.getByLabelText("Search options")).toBeOnTheScreen();
  await fireEvent.changeText(staffView.getByLabelText("Search options"), "Cheryl");
  expect(staffView.queryByRole("radio", { name: "Andres Manili" })).toBeNull();
  expect(staffView.getByRole("radio", { name: "Cheryl Gallo" })).toBeOnTheScreen();
  await fireEvent.press(staffView.getByRole("radio", { name: "Cheryl Gallo" }));
  await staffView.unmount();

  const createView = await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "create" }}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  await fireEvent.press(await createView.findByRole("button", { name: "Priority" }));
  expect(createView.queryByLabelText("Search options")).toBeNull();
  expect(createView.getByRole("radio", { name: "High" })).toBeOnTheScreen();
  await createView.unmount();
});
