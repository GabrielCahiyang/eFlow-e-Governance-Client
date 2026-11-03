// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "head",
  intel: true,
  hook: vi.fn(),
  notes: vi.fn(),
  options: undefined as unknown,
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "head" },
    userProfile: { id: "head", role: state.role, org_id: "office" },
    can: (key: string) =>
      key === "navigation.team_supervision" ||
      (state.intel && key === "navigation.team_intelligence"),
  }),
}));
vi.mock(
  "../../src/app/features/team-management/hooks/useDepartmentTeamAnalytics",
  () => ({
    useDepartmentTeamAnalytics: (options: unknown) => {
      state.options = options;
      return state.hook();
    },
  }),
);
vi.mock("../../src/app/hooks/useFirebaseData", () => ({
  useEmployeeNotes: () => {
    state.notes();
    return { notes: { worker: { tags: ["Writing"] } }, loading: false };
  },
}));
vi.mock("../../src/app/features/analytics", () => ({
  DeliveryAnalytics: ({ onSelectPerson }: any) => (
    <button onClick={() => onSelectPerson("worker")}>
      Inspect employee analytics
    </button>
  ),
}));
vi.mock("../../src/app/features/task-inspector", () => ({
  TaskDetailDrawer: () => null,
}));
vi.mock("../../src/app/features/productivity", () => ({
  MonthlyLeaderboard: () => <div>Preserved monthly contributions</div>,
}));
vi.mock("../../src/app/features/office-team", () => ({
  OfficeTeamWorkspace: () => <div>Preserved account invitations</div>,
}));
vi.mock(
  "../../src/app/features/team-management/components/supervision/TeamMemberBoard",
  () => ({ TeamMemberBoard: () => <div>People roster</div> }),
);
vi.mock(
  "../../src/app/features/team-management/components/supervision/TeamMemberWorkPanel",
  () => ({ TeamMemberWorkPanel: () => <div>Preserved work assignments</div> }),
);
vi.mock(
  "../../src/app/features/team-management/components/supervision/TeamMemberOperationsPanel",
  () => ({
    TeamMemberOperationsPanel: () => <div>Preserved safe reassignment</div>,
  }),
);
vi.mock(
  "../../src/app/features/team-management/components/supervision/OfficeIdentityAccessPanel",
  () => ({
    OfficeIdentityAccessPanel: () => <div>Preserved identity controls</div>,
  }),
);
vi.mock(
  "../../src/app/features/team-management/components/intelligence/EmployeeIntelligencePanel",
  () => ({
    EmployeeIntelligencePanel: ({ employee, storedSkills }: any) => (
      <div>
        360: {employee.name} · {storedSkills.join(", ")}
      </div>
    ),
  }),
);
import { EmployeeAnalyticsWorkspace } from "../../src/app/features/team-management/components/analytics/EmployeeAnalyticsWorkspace";
beforeEach(() => {
  state.role = "head";
  state.intel = true;
  vi.clearAllMocks();
  state.hook.mockReturnValue({
    deptEmployees: [
      {
        id: "worker",
        name: "Crisostomo",
        jobTitle: "Member",
        jobDescription: "Writing",
        department: "office",
      },
    ],
    memberMetrics: [{ employeeId: "worker" }],
    tasks: [],
    projects: [],
    facts: {
      subtasks: [],
      progress: [],
      submissions: [],
      statusHistory: [],
      evidence: [],
    },
    profilesById: new Map([["worker", { skills: { Writing: true } }]]),
    health: {},
    attention: [],
    loading: false,
    error: "",
    refresh: vi.fn(),
  });
});
afterEach(cleanup);
it("brings employee delivery, assignments and 360 into one selected-person workspace", () => {
  render(<EmployeeAnalyticsWorkspace />);
  expect(state.options).toMatchObject({ includeCurrentUser: true });
  fireEvent.click(
    screen.getByRole("button", { name: "Employee analytics", exact: true }),
  );
  expect(screen.getByText("Preserved safe reassignment")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Employee 360", exact: true }),
  );
  expect(screen.getByText(/360: Crisostomo/)).toBeTruthy();
  expect(state.notes).toHaveBeenCalled();
});
it("does not load coaching notes or intelligence-only views when that permission is absent", () => {
  state.intel = false;
  render(<EmployeeAnalyticsWorkspace />);
  fireEvent.click(
    screen.getByRole("button", { name: "Employee analytics", exact: true }),
  );
  expect(screen.queryByRole("button", { name: "Employee 360" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Workload & health" }),
  ).toBeNull();
  expect(state.notes).not.toHaveBeenCalled();
});
it("keeps account invitations and identity controls accessible inside the merged workspace", () => {
  render(<EmployeeAnalyticsWorkspace />);
  fireEvent.click(screen.getByRole("button", { name: "Team access" }));
  expect(screen.getByText("Preserved account invitations")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Identity & access", exact: true }),
  );
  expect(screen.getByText("Preserved identity controls")).toBeTruthy();
});
it("rejects Member entry before loading department analytics", () => {
  state.role = "member";
  render(<EmployeeAnalyticsWorkspace />);
  expect(screen.getByRole("alert").textContent).toContain("not available");
  expect(state.hook).not.toHaveBeenCalled();
});
