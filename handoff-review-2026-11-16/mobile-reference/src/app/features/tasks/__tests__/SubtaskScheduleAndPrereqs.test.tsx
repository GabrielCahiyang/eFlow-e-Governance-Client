import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return function MockDateTimePicker(props: Record<string, unknown>) {
    return <View testID="date-time-picker" {...props} />;
  };
});
import { rememberWorkCapabilityContext } from "../../../../core/web/app/features/nested-work/selectors/capabilities";
import type { WorkTreeSnapshot } from "../../../../core/web/app/features/nested-work/types";
import { fetchWorkTree, saveWorkTree } from "../../../../core/web/app/features/nested-work/services/workTreeService";
import { fetchTaskById } from "../../../../core/web/app/features/tasks/services/taskRealtimeService";
import { draftStore } from "../../../../platform/draftStore";
import { fetchProject } from "../../projects/services";
import { WorkEditorSheet } from "../WorkEditorSheet";

jest.mock("../../../../core/web/app/features/nested-work/services/workTreeService", () => ({
  fetchWorkTree: jest.fn(),
  saveWorkTree: jest.fn(),
}));
jest.mock("../../../../core/web/app/features/tasks/services/taskRealtimeService", () => ({
  fetchTaskById: jest.fn(),
}));
jest.mock("../../projects/services", () => ({
  fetchProject: jest.fn(),
}));
jest.mock("../../authentication", () => ({
  useAuth: () => ({ profile: { id: "actor" } }),
}));
jest.mock("../../../../platform/supabase", () => ({ supabase: {} }));
jest.mock("../../../../platform/draftStore", () => ({
  draftStore: { get: jest.fn(), remove: jest.fn(), set: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(draftStore.get).mockResolvedValue(null);
});

test("a started Subtask permits a verified name correction while planning and worker rescheduling remain locked", async () => {
  const data = {
    revision: 8,
    root: { id: "started-root", project: "project", office: "office", kind: "office", status: "in_progress", open: true,
      lead: "actor", people: ["actor"], scheduling: { version: 1, today: "2026-11-16" },
      scheduleBounds: { projectStart: "2026-11-01", projectDue: "2026-12-31", taskStart: "2026-11-01", taskDue: "2026-12-15" } },
    supportsSubtaskDependencies: true,
    people: [], nodes: [{ id: "started-subtask", task_id: "started-root", parent_subtask_id: null,
      title: "Original venue checklist", lead_id: "actor", assigned_to_ids: ["actor"], sibling_order: 0,
      status: "in_progress", percent_complete: 20, start_date: "2026-11-16", due_date: "2026-12-01",
      started_at: "2026-11-16T00:00:00Z", priority: "medium", dependency_ids: [], is_standalone: true,
      capabilities: { edit_details: { allowed: true, reason_code: null } },
      detail_edit: { version: 1, task_id: "started-root", node_id: "started-subtask", started: true, details: true, due: false, planning: false },
    }],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  jest.mocked(saveWorkTree).mockResolvedValue(data);
  const view = await render(<WorkEditorSheet data={data} edit={{ command: "edit", node: data.nodes[0] }}
    onClose={jest.fn()} onSaved={async () => {}} />);
  expect(view.getByRole("button", { name: "Start date" })).toBeDisabled();
  expect(view.getByRole("button", { name: "Due date" })).toBeDisabled();
  expect(view.getByRole("button", { name: "Prerequisite subtasks" })).toBeDisabled();
  await fireEvent.changeText(view.getByLabelText("Subtask name"), "Corrected venue checklist");
  await fireEvent.press(view.getByRole("button", { name: "Save subtask" }));
  await waitFor(() => expect(saveWorkTree).toHaveBeenCalledWith("started-root", expect.objectContaining({
    command: "edit", payload: expect.objectContaining({ title: "Corrected venue checklist", start: "2026-11-16", due: "2026-12-01" }),
  })));
});

test("subtask creation permits undated and overlapping prerequisites while retaining parent date bounds", async () => {
  jest.mocked(fetchTaskById).mockResolvedValue({
    id: "task-1",
    linked_project_id: "project-1",
    start_date: "2026-11-10",
    due_date: "2026-11-28",
  } as never);
  jest.mocked(fetchProject).mockResolvedValue({
    id: "project-1",
    status: "active",
    startDate: "2026-11-12",
    targetDate: "2026-11-24",
  } as never);

  const data = {
    root: {
      id: "task-1",
      kind: "office",
      office: "office-1",
      project: "project-1",
      due: "2026-11-28",
      open: true,
      lead: "actor",
      can_edit_dependencies: true,
      scheduling: { version: 1, today: "2026-11-15" },
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    supportsSubtaskDependencies: true,
    revision: 3,
    nodes: [
      {
        id: "no-dates",
        task_id: "task-1",
        parent_subtask_id: null,
        title: "Unscheduled sibling",
        sibling_order: 0,
        status: "todo",
        capabilities: {},
      },
      {
        id: "start-only",
        task_id: "task-1",
        parent_subtask_id: null,
        title: "Missing due sibling",
        sibling_order: 1,
        status: "todo",
        start_date: "2026-11-14",
        capabilities: {},
      },
      {
        id: "late",
        task_id: "task-1",
        parent_subtask_id: null,
        title: "Later sibling",
        sibling_order: 2,
        status: "todo",
        start_date: "2026-11-14",
        due_date: "2026-11-22",
        capabilities: {},
      },
    ],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(fetchWorkTree).mockResolvedValue(data);

  const view = await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "create" }}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );

  // Fallback loaded both task and project timeline bounds (max(2026-11-12, 2026-11-10)=2026-11-12 .. min(2026-11-24, 2026-11-28)=2026-11-24).
  await fireEvent.press(await view.findByRole("button", { name: "Start date" }));
  const startPicker = await view.findByTestId("date-time-picker");
  expect(startPicker.props.minimumDate?.toISOString().slice(0, 10)).toBe("2026-11-12");
  expect(startPicker.props.maximumDate?.toISOString().slice(0, 10)).toBe("2026-11-24");
  await fireEvent.press(view.getByRole("button", { name: "Confirm date" }));
  await waitFor(() =>
    expect(view.queryByRole("button", { name: "Confirm date" })).toBeNull(),
  );

  await fireEvent.press(view.getByRole("button", { name: "Prerequisite subtasks" }));
  expect(await view.findByRole("checkbox", { name: "Unscheduled sibling" })).toBeEnabled();
  expect(view.getByRole("checkbox", { name: "Missing due sibling" })).toBeEnabled();

  await fireEvent.press(view.getByRole("checkbox", { name: "Later sibling" }));
  expect(
    view.queryByText("The subtask starts before a selected prerequisite is due. Adjust the schedule first."),
  ).toBeNull();

  const closeDialog = view.getAllByLabelText("Close dialog").at(-1);
  if (closeDialog) await fireEvent.press(closeDialog);
  await fireEvent.changeText(view.getByLabelText("Subtask name"), "Blocked create");
  await fireEvent.press(view.getByRole("button", { name: "Add subtask" }));

  await waitFor(()=>expect(saveWorkTree).toHaveBeenCalled());
});

test("subtask edit accepts an existing undated prerequisite and permits removing it", async () => {
  const data = {
    root: {
      id: "task-2",
      kind: "office",
      office: "office-1",
      project: "project-1",
      due: "2026-11-28",
      open: true,
      lead: "actor",
      scheduleBounds: {
        projectStart: "2026-11-10",
        projectDue: "2026-11-25",
        taskStart: "2026-11-10",
        taskDue: "2026-11-25",
      },
      scheduling: { version: 1, today: "2026-11-15" },
      people: [],
    },
    supportsSubtaskDependencies: true,
    revision: 4,
    nodes: [
      {
        id: "target",
        task_id: "task-2",
        parent_subtask_id: null,
        title: "Scheduled target",
        sibling_order: 1,
        status: "todo",
        start_date: "2026-11-16",
        due_date: "2026-11-20",
        dependency_ids: ["undated-req"],
        can_edit_dependencies: true,
        assigned_to_ids: [],
        capabilities: { edit_details: { allowed: true, reason_code: null } },
      },
      {
        id: "undated-req",
        task_id: "task-2",
        parent_subtask_id: null,
        title: "Undated prereq",
        sibling_order: 0,
        status: "todo",
        capabilities: {},
      },
    ],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor");
  jest.mocked(fetchWorkTree).mockResolvedValue(data);
  jest.mocked(saveWorkTree).mockResolvedValue(data);

  await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "edit", node: data.nodes[0] }}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );

  expect(screen.queryByText(/with a due date before linking/)).toBeNull();
  // Already-selected unscheduled item remains enabled so the user can unselect it and save.
  await fireEvent.press(screen.getByRole("button", { name: "Prerequisite subtasks" }));
  const reqCheckbox = await screen.findByRole("checkbox", { name: "Undated prereq" });
  expect(reqCheckbox).not.toBeDisabled();
  await fireEvent.press(reqCheckbox);
  expect(
    screen.queryByText('Schedule "Undated prereq" with a due date before linking it as a prerequisite, or unselect it.'),
  ).toBeNull();
  const closeDialog = screen.getAllByLabelText("Close dialog").at(-1);
  if (closeDialog) await fireEvent.press(closeDialog);

  await fireEvent.press(screen.getByRole("button", { name: "Save subtask" }));
  await waitFor(() =>
    expect(saveWorkTree).toHaveBeenCalledWith(
      "task-2",
      expect.objectContaining({
        command: "edit",
        payload: expect.objectContaining({ id: "target", dependency_ids: [] }),
      }),
    ),
  );
});
