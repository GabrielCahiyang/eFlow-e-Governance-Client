import { expect, jest, test, describe, afterEach } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { TaskDetailsScreen } from "../TaskDetailsScreen";
import { getPhilippineCalendarDate } from "../../../../core/web/app/shared/calendarDates";
jest.mock("../WorkProposalSheet", () => ({ WorkProposalReview: () => null, WorkProposalSheet: () => null }));

let mockStructureAccess: "head" | "delegated" | null = "head";
let mockStructureLoading = false;
jest.mock("../../projects/ProjectTaskEditor", () => {
  const actual = jest.requireActual("../../projects/ProjectTaskEditor") as Record<string, unknown>;
  return {
    ...actual,
    useTaskStructure: () => ({
      data: mockStructureAccess,
      loading: mockStructureLoading,
      error: null,
      refresh: jest.fn(async () => {}),
    }),
  };
});

let mockProfile = { id: "lead-1", role: "head", name: "Andres Manili", org_id: "office-1" };
jest.mock("../../authentication", () => ({
  useAuth: () => ({
    profile: mockProfile,
    organization: { id: "office-1", name: "LEDIPO" },
  }),
}));

const mockRun = jest.fn();
jest.mock("../../../shared/useAction", () => ({
  useAction: () => ({ run: mockRun, loading: false }),
}));

const mockSubscribedTables: string[] = [];
jest.mock("../../../shared/postgresChannel", () => ({
  createPostgresChannel: () => {
    const channel = {
      on: (_event: string, filter: { table?: string }) => {
        if (filter?.table) mockSubscribedTables.push(filter.table);
        return channel;
      },
      subscribe: () => ({ unsubscribe: jest.fn() }),
    };
    return channel;
  },
}));

let mockTreeBlocker: string | null = null;
let mockStaffCapabilities = {};
jest.mock("../../../../core/web/app/features/nested-work/services/workTreeService", () => ({
  fetchWorkTree: jest.fn(async (id: string) => {
    const snapshot = {
      revision: 1,
      root: {
        id,
        kind: "office",
        lead: mockTreeLead,
        status: "in_progress",
        blocker: mockTreeBlocker,
        open: true,
        project: "proj-1",
        office: "office-1",
        project_status: mockProjectStatus,
        people: [],
        capabilities: {
          ...(mockTreeRootCreateAllowed ? { create_child: { allowed: true, reason_code: null } } : {}),
          ...mockStaffCapabilities,
        },
      },
      nodes: [],
      people: [{ id: "lead-1", name: "Andres Manili" }],
    };
    const {
      rememberWorkCapabilityContext,
    } = require("../../../../core/web/app/features/nested-work/selectors/capabilities") as typeof import("../../../../core/web/app/features/nested-work/selectors/capabilities");
    rememberWorkCapabilityContext(snapshot as never, "lead-1");
    return snapshot;
  }),
  WorkTreeUnavailable: class WorkTreeUnavailable extends Error {},
}));

jest.mock("../../../../platform/draftStore", () => ({
  draftStore: {
    get: jest.fn(async () => null),
  },
}));

let mockProjectStatus = "on_hold";
let mockProjectLeadId: string | null = null;
let mockTreeLead = "lead-1";
let mockTreeRootCreateAllowed = false;
let mockDependencyRows: Array<{
  id: string;
  title: string;
  status: string;
  linked_project_id?: string | null;
}> = [];
let mockTaskRow: Record<string, unknown> = {
  id: "task-1",
  title: "Prepare invitations",
  linked_project_id: "proj-1",
  assigned_to: "lead-1",
  created_by: "lead-1",
  status: "in_progress",
  priority: "high",
  start_date: "2026-11-11",
  due_date: "2026-11-12",
  dependency_ids: [] as string[],
  completed_at: null,
  archived_at: null,
  deleted_at: null,
  org_id: "office-1",
};

jest.mock("../../../../platform/supabase", () => ({
  supabase: {
    removeChannel: jest.fn(),
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => ({
          is: () => ({
            single: async () => ({ data: mockTaskRow, error: null }),
          }),
          maybeSingle: async () => {
            if (table === "projects") {
              return {
                data: {
                  status: mockProjectStatus,
                  project_lead_id: mockProjectLeadId,
                  title: "Test Project",
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
        }),
        in: () => ({
          is: async () => ({ data: mockDependencyRows, error: null }),
        }),
      }),
    }),
  },
}));

describe("Task staffing permissions", () => {
  afterEach(() => {
    mockStructureLoading = false;
    mockProfile = { id: "lead-1", role: "head", name: "Andres Manili", org_id: "office-1" };
    mockStaffCapabilities = {};
    mockProjectLeadId = null;
    mockTaskRow.status = "in_progress";
  });
  test.each(["todo", "in_progress"])("Task visibility remains available and Delete follows its %s state", async (status) => {
    mockProjectStatus = "active";
    mockProjectLeadId = "lead-1";
    mockTaskRow.status = status;
    const view = await render(<TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />);
    expect(await view.findByText("Prepare invitations")).toBeOnTheScreen();
    if (status === "todo") expect(view.getByRole("button", { name: "Delete task" })).toBeOnTheScreen();
    else expect(view.queryByRole("button", { name: "Delete task" })).toBeNull();
  });
  test("Edit and Delete stay together and become disabled during permission revalidation", async () => {
    mockProjectStatus="active";mockProjectLeadId="lead-1";mockTaskRow.status="todo";
    const props={id:"task-1",projectId:"proj-1",navigate:jest.fn()};
    const view=await render(<TaskDetailsScreen {...props} />);
    await view.findByText("Prepare invitations");
    const {within}=require("@testing-library/react-native");
    const actions=within(view.getByTestId("task-detail-actions"));
    expect(actions.getByRole("button",{name:"Edit task"})).toBeOnTheScreen();
    expect(actions.getByRole("button",{name:"Delete task"})).toBeOnTheScreen();
    mockStructureLoading=true;await view.rerender(<TaskDetailsScreen {...props} />);
    expect(actions.getByRole("button",{name:"Edit task"})).toBeDisabled();
    expect(actions.getByRole("button",{name:"Delete task"})).toBeDisabled();
    mockStructureLoading=false;await view.rerender(<TaskDetailsScreen {...props} />);
    expect(actions.getByRole("button",{name:"Edit task"})).toBeEnabled();
  });
  test.each([
    ["member", false, true, true],
    ["member", false, false, false],
    ["member", true, true, true],
    ["head", false, true, true],
    ["head", true, true, true],
  ] as const)("%s sees Task people controls with either scoped staffing capability (%s, %s)", async (role, appoint, contributors, visible) => {
    mockProfile = { ...mockProfile, role };
    mockProjectStatus = "active";
    mockStaffCapabilities = {
      appoint_lead: appoint ? { allowed: true, reason_code: null } : { allowed: false, reason_code: "appointment_denied" },
      manage_contributors: contributors ? { allowed: true, reason_code: null } : { allowed: false, reason_code: "branch_denied" },
    };
    const view = await render(<TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />);
    await view.findByText("Prepare invitations");
    const button = view.queryByRole("button", { name: "Choose people for this task" });
    if (visible) expect(button).toBeOnTheScreen();
    else expect(button).toBeNull();
  });
});

describe("TaskDetailsScreen with on-hold projects", () => {
  test("renders BentoProjectOnHoldCard and hides work action buttons when project is on hold", async () => {
    mockProjectStatus = "on_hold";

    const view = await render(
      <TaskDetailsScreen
        id="task-1"
        projectId="proj-1"
        navigate={jest.fn()}
      />,
    );

    // Expect Project on hold warning banner
    expect(await view.findByText("Project on hold")).toBeOnTheScreen();
    expect(view.getByText("Work actions unavailable")).toBeOnTheScreen();
    expect(
      view.getByText("Work updates are paused while the project is under review."),
    ).toBeOnTheScreen();

    // Expect work action buttons NOT to be rendered
    expect(view.queryByText("Update progress")).toBeNull();
    expect(view.queryByText("Mark as complete")).toBeNull();
  });

  test("renders action buttons when project is active", async () => {
    mockProjectStatus = "active";
    mockTaskRow.status = "in_progress";

    const view = await render(
      <TaskDetailsScreen
        id="task-1"
        projectId="proj-1"
        navigate={jest.fn()}
      />,
    );

    // Expect work action buttons to be rendered for active project
    expect(await view.findByText("Update progress")).toBeOnTheScreen();
    expect(view.getByText("Mark as complete")).toBeOnTheScreen();

    // Expect Project on hold banner NOT to be rendered
    expect(view.queryByText("Project on hold")).toBeNull();
  });

  test.each([
    ["todo", "Start work"],
    ["changes_requested", "Resume work"],
  ])("shows only %s's opening action before execution", async (status, label) => {
    mockProjectStatus = "active";
    mockTaskRow.status = status;
    mockTaskRow.start_date = getPhilippineCalendarDate();
    const view = await render(<TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />);
    expect(await view.findByText(label)).toBeOnTheScreen();
    expect(view.queryByText("Update progress")).toBeNull();
    expect(view.queryByText("Mark as complete")).toBeNull();
  });

  test("places compact Edit button beside title when authorized, even on hold, and omits Planning on eFlow Web and bottom Edit task", async () => {
    mockStructureAccess = "head";
    mockProjectStatus = "on_hold";
    mockTaskRow.status = "in_progress";
    mockTaskRow.dependency_ids = [];
    mockTreeBlocker = null;

    const view = await render(
      <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
    );

    const editBtn = await view.findByRole("button", { name: "Edit task" });
    expect(editBtn).toBeOnTheScreen();
    expect(view.getByText("Edit")).toBeOnTheScreen();
    expect(view.queryByText("Planning on eFlow Web")).toBeNull();
    expect(view.queryByText("Edit task")).toBeNull();
    expect(view.queryByText("DEPENDENCIES")).toBeNull();
    expect(view.queryByText("WORK BLOCKED")).toBeNull();

    // Tapping Edit opens ProjectTaskEditor with context-specific Save task button
    await fireEvent.press(editBtn);
    expect(await view.findByRole("button", { name: "Save task" })).toBeOnTheScreen();
  });

  test("hides Edit button when user is not authorized to edit task", async () => {
    mockStructureAccess = null;
    mockProjectStatus = "active";
    mockTaskRow.status = "in_progress";

    const view = await render(
      <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
    );

    expect(await view.findByText("Prepare invitations")).toBeOnTheScreen();
    expect(view.queryByRole("button", { name: "Edit task" })).toBeNull();
    expect(view.queryByText("Planning on eFlow Web")).toBeNull();
  });

  test("renders conditional Dependencies and Work blocked cards when present", async () => {
    mockStructureAccess = "head";
    mockProjectStatus = "active";
    mockTaskRow.status = "in_progress";
    mockTaskRow.dependency_ids = ["dep-1"];
    mockDependencyRows = [
      { id: "dep-1", title: "Secure permit", status: "completed", linked_project_id: "proj-1" },
    ];
    mockTreeBlocker = "Waiting for venue clearance";

    const view = await render(
      <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
    );

    expect(await view.findByText("DEPENDENCIES")).toBeOnTheScreen();
    expect(view.getByText("1 of 1 complete")).toBeOnTheScreen();
    expect(view.getByText("Secure permit")).toBeOnTheScreen();
    expect(view.getByText("WORK BLOCKED")).toBeOnTheScreen();
    expect(view.getByText("Waiting for venue clearance")).toBeOnTheScreen();
  });

  test("gates Mark as complete and shows a readiness notice when a task prerequisite is incomplete", async () => {
    mockStructureAccess = "head";
    mockProjectStatus = "active";
    mockTaskRow.status = "in_progress";
    mockTaskRow.dependency_ids = ["dep-pending"];
    mockDependencyRows = [
      {
        id: "dep-pending",
        title: "Approve site plan",
        status: "in_progress",
        linked_project_id: "proj-1",
      },
    ];
    mockTreeBlocker = null;

    const view = await render(
      <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
    );

    expect(await view.findByText("Update progress")).toBeOnTheScreen();
    expect(view.queryByText("Mark as complete")).toBeNull();
    expect(
      view.getByText(
        "Complete all task prerequisites before marking this task complete.",
      ),
    ).toBeOnTheScreen();
    mockTaskRow.dependency_ids = [];
    mockDependencyRows = [];
  });

  test("displays Stuck in the task status strip when an active task has a blocker, and In progress when cleared", async () => {
    mockStructureAccess = "head";
    mockProjectStatus = "active";
    mockTaskRow.status = "in_progress";
    mockTaskRow.dependency_ids = [];
    mockDependencyRows = [];
    mockTreeBlocker = "Awaiting engineering sign-off";

    const view = await render(
      <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
    );

    expect(await view.findByText("Stuck")).toBeOnTheScreen();
    expect(view.queryByText("In progress")).toBeNull();
    await view.unmount();

    mockTreeBlocker = null;
    const clearedView = await render(
      <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
    );
    expect(await clearedView.findByText("In progress")).toBeOnTheScreen();
    expect(clearedView.queryByText("Stuck")).toBeNull();
    await clearedView.unmount();
  });

  test("blocks non-Task-Lead Project Lead from adding subtasks or executing work in active projects while allowing planning subtask creation", async () => {
    const prevAssignee = mockTaskRow.assigned_to;
    try {
      mockStructureAccess = null;
      mockProjectStatus = "active";
      mockProjectLeadId = "lead-1";
      mockTreeLead = "other-task-lead";
      mockTreeRootCreateAllowed = true;
      mockTaskRow.status = "in_progress";
      mockTaskRow.assigned_to = "other-task-lead";
      mockTaskRow.team_member_ids = [];
      mockTaskRow.dependency_ids = [];
      mockDependencyRows = [];
      mockTreeBlocker = null;

      const activeView = await render(
        <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
      );
      expect(await activeView.findByText("Prepare invitations")).toBeOnTheScreen();
      expect(activeView.queryByText("Update progress")).toBeNull();
      expect(activeView.queryByText("Mark as complete")).toBeNull();
      expect(activeView.queryByText("Submit for review")).toBeNull();
      expect(activeView.queryByRole("button", { name: "Add subtask" })).toBeNull();
      await activeView.unmount();

      mockProjectStatus = "planning";
      const planningView = await render(
        <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
      );
      expect(await planningView.findByRole("button", { name: "Add subtask" })).toBeOnTheScreen();
      expect(planningView.queryByText("Update progress")).toBeNull();
      expect(planningView.queryByText("Mark as complete")).toBeNull();
      expect(planningView.queryByText("Submit for review")).toBeNull();
      await planningView.unmount();
    } finally {
      mockTaskRow.assigned_to = prevAssignee;
      mockProjectLeadId = null;
      mockTreeLead = "lead-1";
      mockTreeRootCreateAllowed = false;
    }
  });

  test("explains why Start work is restricted for future start dates, incomplete prerequisites, and non-lead contributors, and subscribes to progress update tables", async () => {
    const prevStartDate = mockTaskRow.start_date;
    const prevAssignedTo = mockTaskRow.assigned_to;
    try {
      mockSubscribedTables.length = 0;
      mockStructureAccess = "head";
      mockProjectStatus = "active";
      mockTaskRow.status = "todo";
      mockTaskRow.assigned_to = "lead-1";
      mockTaskRow.dependency_ids = ["dep-pending"];
      mockDependencyRows = [
        {
          id: "dep-pending",
          title: "Complete preliminary review",
          status: "in_progress",
          linked_project_id: "proj-1",
        },
      ];
      mockTaskRow.start_date = getPhilippineCalendarDate();
      mockTreeBlocker = null;

      const prereqView = await render(
        <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
      );
      expect(
        await prereqView.findByText("This task cannot start because its prerequisites are incomplete."),
      ).toBeOnTheScreen();
      expect(prereqView.queryByText("Start work")).toBeNull();
      expect(mockSubscribedTables).toEqual(
        expect.arrayContaining([
          "tasks",
          "subtasks",
          "task_progress_updates",
          "subtask_progress_updates",
        ]),
      );
      await prereqView.unmount();

      // Future start date notice
      mockTaskRow.dependency_ids = [];
      mockDependencyRows = [];
      mockTaskRow.start_date = "2099-01-01";
      const futureView = await render(
        <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
      );
      expect(
        await futureView.findByText("Start work is available on or after the planned start date."),
      ).toBeOnTheScreen();
      await futureView.unmount();

      // Contributor on todo task sees lead start notice
      mockTaskRow.assigned_to = "other-lead";
      mockTaskRow.team_member_ids = ["lead-1"];
      mockTaskRow.start_date = getPhilippineCalendarDate();
      const contributorView = await render(
        <TaskDetailsScreen id="task-1" projectId="proj-1" navigate={jest.fn()} />,
      );
      expect(
        await contributorView.findByText(
          "The Task Lead must start work before you can post progress or submit completion.",
        ),
      ).toBeOnTheScreen();
      await contributorView.unmount();
    } finally {
      mockTaskRow.start_date = prevStartDate;
      mockTaskRow.assigned_to = prevAssignedTo;
      mockTaskRow.team_member_ids = [];
      mockTaskRow.dependency_ids = [];
      mockDependencyRows = [];
    }
  });
});
