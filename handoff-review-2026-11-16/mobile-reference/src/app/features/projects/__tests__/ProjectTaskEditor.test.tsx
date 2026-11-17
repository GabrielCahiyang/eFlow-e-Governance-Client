import { beforeEach, expect, jest, test } from "@jest/globals";
import { clearFormDraft, formDraftKey } from "../../../shared/formDraftMemory";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return function MockDateTimePicker(props: Record<string, unknown>) {
    return <View testID="date-time-picker" {...props} />;
  };
});
import { rowToTask } from "../../../../core/web/app/features/tasks/services/taskMapper";
import { ProjectTaskEditor } from "../ProjectTaskEditor";
import type { ProjectGroup } from "../../../../core/web/app/features/project-table/types";
import { fetchDetailEditState } from "../../tasks/workDetailEditing";

jest.mock("../../tasks/workDetailEditing", () => ({
  ...jest.requireActual<typeof import("../../tasks/workDetailEditing")>("../../tasks/workDetailEditing"),
  fetchDetailEditState: jest.fn(),
}));

const mockProjectOfficeMembers = jest.fn<
  () => Promise<{
    offices: {
      id: string;
      office_id: string;
      invitation_status: string;
      relationship_type: string;
    }[];
    members: {
      project_office_id: string;
      user_id: string;
      can_edit: boolean;
    }[];
  }>
>();
const mockTaskRead =
  jest.fn<() => Promise<{ data: Record<string, unknown>; error: null }>>();

function offsetPhilippineDate(days: number) {
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  return new Date(Date.parse(today + "T00:00:00Z") + days * 86400_000)
    .toISOString()
    .slice(0, 10);
}
const todayDate = () => offsetPhilippineDate(0);
const pastProjectStart = () => offsetPhilippineDate(-13);
const futureProjectDue = () => offsetPhilippineDate(16);
let mockProject = {
  status: "active",
  startDate: pastProjectStart(),
  targetDate: futureProjectDue(),
};
let mockAnalysisTasks: Record<string, unknown>[] = [];
beforeEach(() => {
  jest.mocked(fetchDetailEditState).mockImplementation(async taskId => ({
    version: 1, task_id: taskId, node_id: null, updated_at: null,
    started: false, details: true, due: true, planning: true,
  }));
  clearFormDraft(formDraftKey("head", "project-task-editor:project:new"));
  mockProject = {
    status: "active",
    startDate: pastProjectStart(),
    targetDate: futureProjectDue(),
  };
  mockAnalysisTasks = [
    {
      id: "prerequisite",
      linkedProjectId: "project",
      title: "Prepare permit",
      status: "todo",
      startDate: offsetPhilippineDate(-5),
      dueDate: todayDate(),
    },
  ];
});
jest.mock(
  "../../../../core/web/app/features/project-offices/services/projectOfficeService",
  () => ({
    fetchProjectOffices: () => mockProjectOfficeMembers(),
  }),
);

const mockRpc =
  jest.fn<
    (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: null }>
  >();
jest.mock("../../../../platform/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ maybeSingle: mockTaskRead }) }),
      }),
    }),
    rpc: (name: string, args: Record<string, unknown>) => mockRpc(name, args),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "head" } } } }),
    },
  },
}));
jest.mock("../services", () => ({
  fetchProject: async () => mockProject,
  fetchProjectAnalysisTasks: async () => mockAnalysisTasks,
}));
jest.mock(
  "../../../../core/web/app/features/project-table/services/workspaceService",
  () => ({
    fetchProjectGroups: async () => mockGroups,
  }),
);
const mockGroups: ProjectGroup[] = [
  {
    id: "group",
    projectId: "project",
    title: "Field work",
    color: "#123456",
    position: 0,
    isDefault: true,
  },
];

test("started Task editing permits title corrections while planning and unsupervised due dates stay locked", async () => {
  const row = { id: "started-task", title: "Original agenda", priority: "medium", status: "in_progress",
    org_id: "office", linked_project_id: "project", start_date: todayDate(), deadline: offsetPhilippineDate(5),
    updated_at: "2026-11-15T00:00:00Z", dependency_ids: [] };
  mockTaskRead.mockResolvedValue({ data: row, error: null });
  jest.mocked(fetchDetailEditState).mockResolvedValue({ version: 1, task_id: row.id, node_id: null,
    updated_at: row.updated_at, started: true, details: true, due: false, planning: false });
  mockRpc.mockReset().mockImplementation(async (name, args) => ({ error: null,
    data: name === "phase3_patch_task" ? { ...row, ...(args.p_patch as object) } :
      name === "project_flow_snapshot" ? { project: { id: "project" }, ready: true } : true }));
  const saved = jest.fn(async () => {});
  const view = await render(<ProjectTaskEditor scope={{ actor: "head", project: "project", office: "office", task: rowToTask(row) }}
    groups={mockGroups} onClose={jest.fn()} onSaved={saved} />);
  await waitFor(() => expect(view.getByRole("button", { name: "Save task" })).toBeEnabled());
  expect(view.getByRole("button", { name: "Start date" })).toBeDisabled();
  expect(view.getByRole("button", { name: "Due date" })).toBeDisabled();
  await fireEvent.changeText(view.getByLabelText("Task name"), "Corrected agenda");
  await fireEvent.press(view.getByRole("button", { name: "Save task" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(mockRpc).toHaveBeenLastCalledWith("phase3_patch_task", { p_task_id: row.id, p_patch: { title: "Corrected agenda" } });
});

test("task creation rechecks both Web permissions and never writes when one is denied", async () => {
  mockRpc.mockReset().mockImplementation(async (name) => ({
    data: name === "can_create_scoped_work",
    error: null,
  }));
  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  expect(view.getByText("Task name *")).toBeOnTheScreen();
  expect(view.getByText("Group *")).toBeOnTheScreen();
  await fireEvent.changeText(view.getByLabelText("Task name"), "Survey site");
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));
  expect(
    await view.findByText("Current project access does not allow this change."),
  ).toBeOnTheScreen();
  expect(mockRpc.mock.calls.map(([name]) => name)).toEqual([
    "can_create_scoped_work",
    "can_manage_project",
  ]);
});

test("an unconfirmed Web create receipt locks submission instead of creating a duplicate", async () => {
  mockRpc.mockReset().mockImplementation(async (name) => ({
    data:
      name === "m7_create_scheduled_task"
        ? null
        : name === "project_flow_snapshot"
          ? { project: { id: "project" }, ready: true }
          : true,
    error: null,
  }));
  const saved = jest.fn(async () => {});
  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={saved}
    />,
  );
  await fireEvent.changeText(
    view.getByLabelText("Task name"),
    " Survey site ",
  );
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Add task" })).toBeDisabled(),
  );
  expect(
    await view.findByText(/The save could not be confirmed/),
  ).toBeOnTheScreen();
  expect(mockRpc).toHaveBeenLastCalledWith("m7_create_scheduled_task", {
    p_project: "project",
    p_group: "group",
    p_title: "Survey site",
    p_start: todayDate(),
    p_due: futureProjectDue(),
  });
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));
  expect(
    mockRpc.mock.calls.filter(([name]) => name === "m7_create_scheduled_task"),
  ).toHaveLength(1);
  expect(saved).not.toHaveBeenCalled();
});

test("a saved project editor uses the delegated task command and a revoked editor cannot write", async () => {
  const row = {
    id: "task",
    title: "Survey",
    status: "todo",
    org_id: "office",
    linked_project_id: "project",
    updated_at: "2026-11-13T00:00:00Z",
  };
  mockTaskRead.mockResolvedValue({ data: row, error: null });
  mockRpc.mockReset().mockImplementation(async (name) => ({
    error: null,
    data:
      name === "project_flow_snapshot"
        ? { project: { id: "project" }, ready: true }
        : name === "edit_selected_project_task"
          ? row
          : false,
  }));
  const offices = [
    {
      id: "team",
      office_id: "office",
      invitation_status: "joined",
      relationship_type: "lead",
    },
  ];
  const scope = {
    actor: "head",
    project: "project",
    office: "office",
    task: rowToTask(row),
    canDelegateEdit: true,
  };
  for (const can_edit of [true, false]) {
    mockProjectOfficeMembers.mockResolvedValue({
      offices,
      members: [{ project_office_id: "team", user_id: "head", can_edit }],
    });
    const saved = jest.fn(async () => {});
    const view = await render(
      <ProjectTaskEditor
        scope={scope}
        groups={mockGroups}
        onClose={jest.fn()}
        onSaved={saved}
      />,
    );
    await fireEvent.changeText(
      view.getByLabelText("Task name"),
      "Updated survey",
    );
    await fireEvent.press(view.getByRole("button", { name: "Save task" }));
    if (can_edit) await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    else
      expect(
        await view.findByText(
          "Current project access does not allow this change.",
        ),
      ).toBeOnTheScreen();
    await view.unmount();
  }
  expect(
    mockRpc.mock.calls.filter(
      ([name]) => name === "edit_selected_project_task",
    ),
  ).toEqual([
    [
      "edit_selected_project_task",
      { p_task_id: "task", p_patch: { title: "Updated survey" } },
    ],
  ]);
  expect(
    mockRpc.mock.calls.some(([name]) => name === "phase3_patch_task"),
  ).toBe(false);
});

test("unfinished project setup blocks native task creation", async () => {
  mockRpc.mockReset().mockImplementation(async (name) => ({
    error: null,
    data:
      name === "project_flow_snapshot"
        ? { project: { id: "project" }, ready: false }
        : true,
  }));
  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("Task name"), "Survey site");
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));
  expect(
    await view.findByText(/Finish project setup before adding or editing work/),
  ).toBeOnTheScreen();
  expect(
    mockRpc.mock.calls.some(([name]) => name === "m7_create_scheduled_task"),
  ).toBe(false);
});

test("task creation saves optional priority and prerequisites against the confirmed task ID", async () => {
  mockRpc.mockReset().mockImplementation(async (name) => ({
    error: null,
    data: name === "project_flow_snapshot" ? { project: { id: "project" }, ready: true }
      : name === "m7_create_scheduled_task" ? { id: "new-task", linked_project_id: "project" }
      : name === "phase3_patch_task" ? { id: "new-task", priority: "high", dependency_ids: ["prerequisite"] }
      : true,
  }));
  const saved = jest.fn(async () => {});
  const view = await render(<ProjectTaskEditor scope={{ actor: "head", project: "project", office: "office" }}
    groups={mockGroups} onClose={jest.fn()} onSaved={saved} />);
  await fireEvent.changeText(view.getByLabelText("Task name"), "Survey site");
  await fireEvent.press(view.getByRole("button", { name: "Priority" }));
  await fireEvent.press(await view.findByRole("radio", { name: "High" }));
  await fireEvent.press(view.getByRole("button", { name: "Prerequisite tasks" }));
  await fireEvent.press(await view.findByRole("checkbox", { name: "Prepare permit" }));
  const prerequisiteClose = view.getAllByLabelText("Close dialog").at(-1);
  if (prerequisiteClose) await fireEvent.press(prerequisiteClose);
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(mockRpc.mock.calls.filter(([name]) => name === "m7_create_scheduled_task")).toHaveLength(1);
  expect(mockRpc).toHaveBeenLastCalledWith("phase3_patch_task", {
    p_task_id: "new-task", p_patch: { priority: "high", dependency_ids: ["prerequisite"] },
  });
});

test("defaults task start date to today when project already started and surfaces SQL 22023 schedule errors cleanly", async () => {
  mockRpc.mockReset().mockImplementation(async (name) => {
    if (name === "m7_create_scheduled_task")
      return {
        data: null,
        error: { code: "22023", message: "Choose today or a future start date." },
      } as unknown as { data: unknown; error: null };
    return {
      error: null,
      data:
        name === "project_flow_snapshot"
          ? { project: { id: "project" }, ready: true }
          : true,
    };
  });
  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("Task name"), "Field check");
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));
  expect(
    await view.findByText("Choose today or a future start date."),
  ).toBeOnTheScreen();
  expect(view.queryByText(/Check before retrying/)).toBeNull();
  expect(mockRpc).toHaveBeenLastCalledWith("m7_create_scheduled_task", {
    p_project: "project",
    p_group: "group",
    p_title: "Field check",
    p_start: todayDate(),
    p_due: futureProjectDue(),
  });
  expect(view.getByRole("button", { name: "Add task" })).not.toBeDisabled();
});

test("blocks past project schedules with exact start date reason instead of falling back to Check before retrying", async () => {
  mockProject = {
    status: "active",
    startDate: offsetPhilippineDate(-10),
    targetDate: offsetPhilippineDate(-1),
  };
  mockRpc.mockReset().mockImplementation(async (name) => ({
    error: null,
    data:
      name === "project_flow_snapshot"
        ? { project: { id: "project" }, ready: true }
        : true,
  }));
  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("Task name"), "Late task");
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));
  expect(
    await view.findByText("Choose today or a future start date."),
  ).toBeOnTheScreen();
  expect(view.queryByText(/Check before retrying/)).toBeNull();
  expect(
    mockRpc.mock.calls.some(([name]) => name === "m7_create_scheduled_task"),
  ).toBe(false);
});

test("permits undated and overlapping prerequisites without changing task schedule bounds", async () => {
  mockAnalysisTasks = [
    {
      id: "no-dates",
      linkedProjectId: "project",
      title: "Undated draft",
      status: "todo",
    },
    {
      id: "start-only",
      linkedProjectId: "project",
      title: "Missing due date",
      status: "todo",
      startDate: todayDate(),
    },
    {
      id: "late-prereq",
      linkedProjectId: "project",
      title: "Later clearance",
      status: "todo",
      startDate: todayDate(),
      dueDate: offsetPhilippineDate(5),
    },
  ];
  mockRpc.mockReset().mockImplementation(async (name) => ({
    error: null,
    data:
      name === "project_flow_snapshot"
        ? { project: { id: "project" }, ready: true }
        : true,
  }));

  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );

  await fireEvent.changeText(view.getByLabelText("Task name"), "Dependent build");
  await fireEvent.press(view.getByRole("button", { name: "Prerequisite tasks" }));

  expect(await view.findByRole("checkbox", {name:"Undated draft"})).toBeEnabled();
  expect(view.getByRole("checkbox", {name:"Missing due date"})).toBeEnabled();
  expect(view.getByText("No dates set")).toBeOnTheScreen();
  await fireEvent.press(view.getByRole("checkbox", {name:"Undated draft"}));
  await fireEvent.press(view.getByRole("checkbox", {name:"Later clearance"}));
  expect(view.queryByText(/is earlier than prerequisite/)).toBeNull();
  const close=view.getAllByLabelText("Close dialog").at(-1);if(close)await fireEvent.press(close);
  await fireEvent.press(view.getByRole("button",{name:"Add task"}));
  await waitFor(()=>expect(mockRpc.mock.calls.some(([name])=>name==="m7_create_scheduled_task")).toBe(true));
});

test("keeps entered task fields and shows Close task form instead of Done if step 2 patch fails", async () => {
  mockRpc.mockReset().mockImplementation((async (name: string) => {
    if (name === "phase3_patch_task") {
      return { data: null, error: { code: "22023", message: "Patch rejected" } };
    }
    return {
      error: null,
      data:
        name === "project_flow_snapshot"
          ? { project: { id: "project" }, ready: true }
          : name === "m7_create_scheduled_task"
            ? { id: "new-task", linked_project_id: "project" }
            : true,
    };
  }) as never);

  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );

  await fireEvent.changeText(view.getByLabelText("Task name"), "Keep this title");
  await fireEvent.press(view.getByRole("button", { name: "Priority" }));
  await fireEvent.press(await view.findByRole("radio", { name: "High" }));
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));

  expect(
    await view.findByText("The task was created. Open Edit task to check its priority and prerequisites."),
  ).toBeOnTheScreen();
  expect(view.queryByRole("button", { name: "Done" })).toBeNull();
  expect(view.getByRole("button", { name: "Close task form" })).toBeOnTheScreen();
  expect(view.getByDisplayValue("Keep this title")).toBeOnTheScreen();
});

test("Edit task uses project timeline bounds identically to Add task and blocks out-of-range dates while allowing undated prerequisites", async () => {
  const row = {
    id: "task-edit-1",
    title: "Existing road task",
    priority: "medium",
    status: "todo",
    org_id: "office",
    linked_project_id: "project",
    start_date: todayDate(),
    due_date: offsetPhilippineDate(5),
    updated_at: "2026-11-15T00:00:00Z",
  };
  mockAnalysisTasks = [
    {
      id: "no-dates",
      linkedProjectId: "project",
      title: "Unscheduled blocker",
      status: "todo",
    },
    {
      id: "scheduled-ok",
      linkedProjectId: "project",
      title: "Early check",
      status: "todo",
      startDate: offsetPhilippineDate(-2),
      dueDate: todayDate(),
    },
  ];
  mockTaskRead.mockResolvedValue({ data: row, error: null });
  mockRpc.mockReset().mockImplementation(async (name) => ({
    error: null,
    data:
      name === "project_flow_snapshot"
        ? { project: { id: "project" }, ready: true }
        : true,
  }));

  const view = await render(
    <ProjectTaskEditor
      scope={{
        actor: "head",
        project: "project",
        office: "office",
        task: rowToTask(row),
      }}
      groups={mockGroups}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );

  await waitFor(() => expect(view.getByRole("button", { name: "Start date" })).toBeOnTheScreen());
  await fireEvent.press(view.getByRole("button", { name: "Due date" }));
  const picker = await view.findByTestId("date-time-picker");
  await waitFor(() => {
    expect(picker.props.minimumDate?.toISOString().slice(0, 10)).toBe(todayDate());
    expect(picker.props.maximumDate?.toISOString().slice(0, 10)).toBe(futureProjectDue());
  });

  // Attempt to set Due date past project targetDate via DateTimePicker change
  await fireEvent(
    picker,
    "change",
    { type: "set" },
    new Date(Date.parse(offsetPhilippineDate(25) + "T12:00:00Z")),
  );
  await fireEvent.press(view.getByRole("button", { name: "Confirm date" }));
  await waitFor(() =>
    expect(view.queryByRole("button", { name: "Confirm date" })).toBeNull(),
  );

  // Verify unscheduled prerequisite is disabled inside Edit task too
  await fireEvent.press(view.getByRole("button", { name: "Prerequisite tasks" }));
  expect(await view.findByRole("checkbox", { name: "Unscheduled blocker" })).toBeEnabled();
  const closePrereqs = view.getAllByLabelText("Close dialog").at(-1);
  if (closePrereqs) await fireEvent.press(closePrereqs);

  await fireEvent.press(view.getByRole("button", { name: "Save task" }));
  expect(
    await view.findByText("Choose Task dates within the project schedule."),
  ).toBeOnTheScreen();
  expect(mockRpc.mock.calls.some(([name]) => name === "phase3_patch_task")).toBe(false);
});

test("ProjectTaskEditor triggers onCreated only after clean task creation", async () => {
  clearFormDraft(formDraftKey("head", "project-task-editor:project:new"));
  mockRpc.mockReset().mockImplementation(async (name) => ({
    data:
      name === "m7_create_scheduled_task"
        ? { id: "created-task-id", linked_project_id: "project" }
        : name === "project_flow_snapshot"
          ? { project: { id: "project" }, ready: true }
          : true,
    error: null,
  }));
  const onCreated = jest.fn();
  const onClose = jest.fn();
  const onSaved = jest.fn(async () => {});

  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={onClose}
      onCreated={onCreated}
      onSaved={onSaved}
    />,
  );
  await waitFor(() => expect(view.getByLabelText("Task name")).toBeOnTheScreen());
  expect(view.queryByRole("button", { name: "Appointed Lead" })).toBeNull();
  expect(view.queryByRole("button", { name: "Contributors" })).toBeNull();

  await fireEvent.changeText(view.getByLabelText("Task name"), "Site inspection");
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onCreated).toHaveBeenCalledWith({
    id: "created-task-id",
    title: "Site inspection",
  });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test("ProjectTaskEditor does not fire onCreated when step-2 planning fields fail after create", async () => {
  clearFormDraft(formDraftKey("head", "project-task-editor:project:new"));
  mockRpc.mockReset().mockImplementation(async (name) => {
    if (name === "phase3_patch_task") throw new Error("patch rejected");
    return {
      data:
        name === "m7_create_scheduled_task"
          ? { id: "created-partial-id", linked_project_id: "project" }
          : name === "project_flow_snapshot"
            ? { project: { id: "project" }, ready: true }
            : true,
      error: null,
    };
  });
  const onCreated = jest.fn();
  const onSaved = jest.fn(async () => {});

  const view = await render(
    <ProjectTaskEditor
      scope={{ actor: "head", project: "project", office: "office" }}
      groups={mockGroups}
      onClose={jest.fn()}
      onCreated={onCreated}
      onSaved={onSaved}
    />,
  );
  await fireEvent.press(await view.findByRole("button", { name: "Priority" }));
  await fireEvent.press(await view.findByRole("radio", { name: "High" }));
  await fireEvent.changeText(view.getByLabelText("Task name"), "Site inspection");
  await fireEvent.press(view.getByRole("button", { name: "Add task" }));

  expect(
    await view.findByText(
      "The task was created. Open Edit task to check its priority and prerequisites.",
    ),
  ).toBeOnTheScreen();
  expect(onCreated).not.toHaveBeenCalled();
  expect(onSaved).toHaveBeenCalledTimes(1);
});
