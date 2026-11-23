// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildShellNavigation,
  getSidebarContent,
} from "../../src/app/features/navigation";
import {
  FALLBACK_DEFAULTS,
  resolvePermissions,
} from "../../src/app/features/permissions";
import {
  canCreateOfficeProject,
  canManageSpecificProject,
  resolveProjectWorkspaceAccess,
} from "../../src/app/features/projects/components/model";
import { ProductivitySidebar } from "../../src/app/features/app-shell/components/ProductivitySidebar";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";
import { buildVisibleTourSections } from "../../src/app/features/app-shell/tourNavigationOrder";
import type { Organization, UserProfile } from "../../src/app/types";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }),
});

const ojtRoleRows = [
  { role: "ojt", permission: "navigation.projects", allowed: true },
  { role: "ojt", permission: "projects.create", allowed: true },
  { role: "ojt", permission: "projects.archive", allowed: false },
  { role: "ojt", permission: "projects.delete", allowed: false },
  { role: "ojt", permission: "navigation.tasks", allowed: true },
  { role: "ojt", permission: "tasks.assign", allowed: true },
  { role: "ojt", permission: "navigation.reviews", allowed: true },
  { role: "ojt", permission: "navigation.team_supervision", allowed: true },
  { role: "ojt", permission: "navigation.team_intelligence", allowed: true },
  { role: "ojt", permission: "navigation.department_budgets", allowed: true },
  { role: "ojt", permission: "navigation.reports", allowed: true },
  { role: "ojt", permission: "reports.export", allowed: true },
  { role: "ojt", permission: "navigation.announcements", allowed: true },
];

const ledipo: Organization = {
  id: "ledipo",
  name: "LEDIPO",
  slug: "ledipo",
  org_type: "department",
  is_active: true,
  head_user_id: "head-1",
  parent_id: null,
  path: "ledipo",
  description: "",
  created_at: "",
  updated_at: "",
};

const ojtProfile = {
  id: "ojt-1",
  uid: "ojt-1",
  full_name: "Andres Manili",
  fullName: "Andres Manili",
  email: "ojt@ledipo.test",
  role: "member",
  custom_role_key: "ojt",
  org_id: "ledipo",
  departmentId: "ledipo",
  is_active: true,
} as UserProfile;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
});

describe("delegated RBAC permissions for custom member roles (OJT parity)", () => {
  it("never hardcodes readOnly on EmployeeProjectsWorkspace so RBAC controls project creation", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/features/projects/components/EmployeeProjectsWorkspace.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\breadOnly\b/);

    const ojtPerms = resolvePermissions("member", ojtRoleRows, [], {
      key: "ojt",
      baseRole: "member",
    });
    const ojtAccess = resolveProjectWorkspaceAccess(false, (perm) =>
      ojtPerms.has(perm),
    );
    expect(ojtAccess.canCreate).toBe(true);
    expect(ojtAccess.canArchive).toBe(false);
    expect(ojtAccess.canDelete).toBe(false);
    expect(ojtAccess.canReviewTasks).toBe(false);
    expect(canCreateOfficeProject(ojtProfile, [ledipo], ojtAccess.canCreate, "ledipo")).toBe(true);
    expect(
      canManageSpecificProject(
        { orgId: "ledipo", createdBy: "ojt-1", ownerId: "ojt-1" },
        ojtProfile,
        [ledipo],
        ojtAccess.canManage,
      ),
    ).toBe(true);
    // Cannot manage another user's project in the same office
    expect(
      canManageSpecificProject(
        { orgId: "ledipo", createdBy: "head-1", ownerId: "head-1" },
        ojtProfile,
        [ledipo],
        ojtAccess.canManage,
      ),
    ).toBe(false);

    // Default Member (without projects.create) stays blocked from creating projects
    const defaultMemberPerms = new Set(FALLBACK_DEFAULTS.member);
    const defaultAccess = resolveProjectWorkspaceAccess(false, (perm) =>
      defaultMemberPerms.has(perm),
    );
    expect(defaultAccess.canCreate).toBe(false);
    expect(canCreateOfficeProject(ojtProfile, [ledipo], defaultAccess.canCreate, "ledipo")).toBe(false);
  });

  it("exposes granted Office Budget, Analytics, and Office Team in Workspace sidebar for OJT while keeping default Member clean", () => {
    const ojtPerms = resolvePermissions("member", ojtRoleRows, [], {
      key: "ojt",
      baseRole: "member",
    });
    const ojtNav = buildShellNavigation({
      role: "member",
      can: (perm) => ojtPerms.has(perm),
      hasLeadingWork: false,
    });
    expect(ojtNav.some((item) => item.id === "budget")).toBe(true);
    expect(ojtNav.some((item) => item.id === "team")).toBe(true);
    expect(ojtNav.some((item) => item.id === "reviews")).toBe(true);
    expect(getSidebarContent("member", "budget").sections[0]?.items[0]?.label).toBe("Office Budget");
    expect(getSidebarContent("member", "team").sections[0]?.items.map((item) => item.label)).toEqual([
      "Analytics",
      "Office Team",
    ]);

    const ojtView = render(
      <EflowVibeThemeProvider preference="light">
        <ProductivitySidebar
          role="member"
          activeSection="projects"
          activePage="Projects"
          navigationItems={ojtNav}
          onPageSelect={vi.fn()}
          userId="ojt-1"
          workspaceId="ledipo"
          workspaceName="LEDIPO"
          projects={[{ id: "p1", title: "BAGONG PROJECT", status: "active" }]}
        />
      </EflowVibeThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "Office tools", exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Office Budget", exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analytics", exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Office Team", exact: true })).toBeTruthy();
    expect(
      buildVisibleTourSections({ items: ojtNav, role: "member", workspaceKind: "office" }).map(
        (entry) => entry.label,
      ),
    ).toContain("Office Budget");
    ojtView.unmount();

    // Default Member without delegated office tools does NOT get an Office tools section
    const defaultMemberPerms = new Set(FALLBACK_DEFAULTS.member);
    const memberNav = buildShellNavigation({
      role: "member",
      can: (perm) => defaultMemberPerms.has(perm),
      hasLeadingWork: false,
    });
    expect(memberNav.some((item) => item.id === "budget")).toBe(false);
    expect(memberNav.some((item) => item.id === "team")).toBe(false);
    render(
      <EflowVibeThemeProvider preference="light">
        <ProductivitySidebar
          role="member"
          activeSection="projects"
          activePage="Projects"
          navigationItems={memberNav}
          onPageSelect={vi.fn()}
          userId="member-1"
          workspaceId="ledipo"
          workspaceName="LEDIPO"
          projects={[{ id: "p1", title: "BAGONG PROJECT", status: "active" }]}
        />
      </EflowVibeThemeProvider>,
    );
    expect(screen.queryByRole("button", { name: "Office tools", exact: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Office Budget", exact: true })).toBeNull();
  });
});
