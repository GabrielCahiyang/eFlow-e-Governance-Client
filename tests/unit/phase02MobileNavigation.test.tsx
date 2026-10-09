// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    can: () => true,
    user: { id: "user-1" },
    userProfile: { role: "head" },
  }),
}));

vi.mock("../../src/app/hooks/useSupabaseData", () => ({
  useTasksData: () => ({ tasks: [] }),
  useProjectsData: () => ({ projects: [] }),
  useOrgs: () => ({ orgs: [], loading: false }),
}));
vi.mock('../../src/app/features/workspaces/services/workspaceService', async () => {
  const actual = await vi.importActual<typeof import('../../src/app/features/workspaces/services/workspaceService')>('../../src/app/features/workspaces/services/workspaceService');
  return { ...actual, listWorkspaces: async () => { throw new actual.WorkspaceApiUnavailable('R3 migration pending'); } };
});

vi.mock("../../src/app/features/guided-tours", () => ({
  GuidedTourProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../src/app/features/app-shell/components/EflowTopBar", () => ({
  EflowTopBar: ({ onOpenMobileNavigation }: { onOpenMobileNavigation: () => void }) => (
    <button type="button" onClick={onOpenMobileNavigation}>Open mobile navigation</button>
  ),
}));

vi.mock("../../src/app/features/navigation", async () => {
  const React = await import("react");
  const content = {
    dashboard: { title: "Overview", sections: [{ title: "Workspace", items: [{ label: "Dashboard" }] }] },
    tasks: { title: "Tasks", sections: [{ title: "Workspace", items: [{ label: "My Tasks" }] }] },
  };

  const actual = await vi.importActual<typeof import('../../src/app/features/navigation')>('../../src/app/features/navigation');
  return {
    ...actual,
    buildShellNavigation: () => [
      { id: 'dashboard', label: 'Overview', group: 'home', pages: [{label:'Dashboard'}] },
      { id: 'tasks', label: 'Tasks', group: 'workspaces', pages: [{label:'My Tasks'}] },
    ],
    canOpenNavigationSection: () => true,
    getRoleNavigationCandidates: () => [
      { id: "dashboard", icon: null, label: "Overview" },
      { id: "tasks", icon: null, label: "Tasks" },
    ],
    getSidebarContent: (_role: string, section: keyof typeof content) => content[section] || content.dashboard,
    isRoleNavigationItemVisible: () => true,
    RoleContent: ({ activePage, activeSection }: { activePage?: string; activeSection: string }) => (
      <div data-testid="workspace-state">{activeSection}:{activePage}</div>
    ),
    useRoleNavigationState: (_role: string, getInitialPage: (section: string) => string | undefined) => {
      const [activeSection, setActiveSection] = React.useState("dashboard");
      const [activePage, setActivePage] = React.useState(() => getInitialPage("dashboard"));
      return {
        activePage,
        activeSection,
        selectPageAsync: (section: string, page: string) => {
          setActiveSection(section);
          setActivePage(page);
          return Promise.resolve(true);
        },
      };
    },
  };
});

import { EflowAppShell } from "../../src/app/features/app-shell/EflowAppShell";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
}

if (!globalThis.ResizeObserver) {
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: class { observe() {} unobserve() {} disconnect() {} },
  });
}

describe("Phase 02 mobile navigation", () => {
  it("opens the accessible navigation drawer and closes it after a destination is selected", async () => {
    render(
      <EflowVibeThemeProvider preference="light">
        <EflowAppShell role="head" />
      </EflowVibeThemeProvider>,
    );

    expect(screen.queryAllByLabelText("Primary navigation")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Open mobile navigation" }));
    await waitFor(() => expect(screen.getAllByLabelText("Primary navigation")).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Workspaces" }));
    await waitFor(() => expect(screen.getByTestId("workspace-state").textContent).toBe("tasks:My Tasks"));
    await waitFor(() => expect(screen.queryAllByLabelText("Primary navigation")).toHaveLength(0));
  });
});
