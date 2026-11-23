// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "head",
  supervision: true,
  intel: true,
  hook: vi.fn(),
  notes: vi.fn(),
  options: undefined as unknown,
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "head" },
    userProfile: { id: "head", role: state.role, org_id: "office", is_active: true },
    can: (key: string) =>
      (state.supervision && key === "navigation.team_supervision") ||
      key === "navigation.reports" ||
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
vi.mock("../../src/app/features/reports", () => ({
  HeadReportsWorkspace: ({ embedded }: { embedded?: boolean }) => (
    <div>Preserved reports {embedded ? "(embedded)" : ""}</div>
  ),
}));
vi.mock("../../src/app/features/process-mining", () => ({
  DeepAnalysisPanel: () => <div>Process mining deep analysis</div>,
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
  state.supervision = true;
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
it("brings employee delivery, assignments and 360 into a dedicated People & skills tab", () => {
  render(<EmployeeAnalyticsWorkspace />);
  expect(state.options).toMatchObject({ includeCurrentUser: true });
  expect(screen.getByRole("button", { name: "Inspect employee analytics" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "People & skills", exact: true }));
  expect(screen.getByText("Preserved work assignments")).toBeTruthy();
  expect(screen.queryByText(/Change an assignment/i)).toBeNull();
  expect(screen.queryByText(/No immediate risk/i)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Employee 360", exact: true }),
  );
  expect(screen.getByText(/360: Crisostomo/)).toBeTruthy();
  expect(state.notes).toHaveBeenCalled();
});
it("does not load coaching notes or intelligence-only views when that permission is absent", () => {
  state.intel = false;
  render(<EmployeeAnalyticsWorkspace />);
  expect(screen.queryByRole("button", { name: "Workload & health" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Deep Analysis" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "People & skills", exact: true }));
  expect(screen.queryByRole("button", { name: "Employee 360" })).toBeNull();
  expect(state.notes).not.toHaveBeenCalled();
});
it("consolidates redundant Overview and Team access tabs while embedding Reports and Deep Analysis", () => {
  render(<EmployeeAnalyticsWorkspace />);
  expect(screen.queryByRole("button", { name: "Team access" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Overview" })).toBeNull();
  const tabLabels = screen
    .getAllByRole("button")
    .filter((btn) =>
      ["Delivery", "Workload & health", "People & skills", "Contributions", "Reports", "Deep Analysis"].includes(
        btn.textContent?.trim() || "",
      ),
    )
    .map((btn) => btn.textContent?.trim());
  expect(tabLabels).toEqual([
    "Delivery",
    "Workload & health",
    "People & skills",
    "Contributions",
    "Reports",
    "Deep Analysis",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Reports", exact: true }));
  expect(screen.getByText(/Preserved reports \(embedded\)/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Deep Analysis", exact: true }));
  expect(screen.getByText("Process mining deep analysis")).toBeTruthy();
});
it("renders focused summary without the analytics tab bar in home mode", () => {
  render(<EmployeeAnalyticsWorkspace home />);
  expect(screen.queryByRole("button", { name: "Delivery", exact: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reports", exact: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Deep Analysis", exact: true })).toBeNull();
  expect(screen.getByRole("button", { name: /Open full analytics/ })).toBeTruthy();
});
it("rejects Member without analytics permissions and Admin before loading department analytics", () => {
  state.role = "member";
  state.supervision = false;
  state.intel = false;
  const view = render(<EmployeeAnalyticsWorkspace />);
  expect(screen.getByRole("alert").textContent).toContain("not available");
  expect(state.hook).not.toHaveBeenCalled();

  view.unmount();
  state.role = "admin";
  state.supervision = true;
  state.intel = true;
  render(<EmployeeAnalyticsWorkspace />);
  expect(screen.getByRole("alert").textContent).toContain("not available");
  expect(state.hook).not.toHaveBeenCalled();
});

it("allows a Member or custom role granted team analytics permissions to open Employee Analytics", () => {
  state.role = "member";
  state.supervision = true;
  state.intel = true;
  render(<EmployeeAnalyticsWorkspace />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(state.hook).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Deep Analysis", exact: true })).toBeTruthy();
});
