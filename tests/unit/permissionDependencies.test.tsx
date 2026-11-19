// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ACTION_PERMISSION_KEYS,
  VISIBLE_PAGE_PERMISSION_KEYS,
  type PermissionKey,
} from "../../src/app/features/permissions/constants";
import {
  detectModulePreset,
  enforcePermissionDependencies,
  getModuleAllKeys,
  getPermissionDependents,
  getPermissionPrerequisites,
  normalizeRolePermissionMap,
  PERMISSION_MODULES,
  planModulePresetChange,
  planRolePermissionToggle,
  planUserOverrideChange,
} from "../../src/app/features/permissions/dependencies";
import { resolvePermissions } from "../../src/app/features/permissions/selectors";
import { CustomRoleModal } from "../../src/app/features/permissions/components/CustomRoleModal";
import { canOpenNavigationSection } from "../../src/app/features/navigation/navigationPermissions";

afterEach(cleanup);

describe("RBAC Slices 3-5: Permission dependency engine & module catalog", () => {
  it("groups 100% of visible page and action permissions into modules with zero duplicates", () => {
    const allManaged = new Set<string>([
      ...VISIBLE_PAGE_PERMISSION_KEYS,
      ...ACTION_PERMISSION_KEYS,
    ]);
    const seen = new Set<string>();
    for (const mod of PERMISSION_MODULES) {
      for (const key of getModuleAllKeys(mod)) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen).toEqual(allManaged);
  });

  it("enforces prerequisites and blocks Admin-only & non-Accounting-Staff leaks in resolvePermissions", () => {
    // Head role normally has navigation.projects + projects.create; denying navigation.projects must block projects.create
    const headDeniedNav = resolvePermissions(
      "head",
      [],
      [{ userId: "h1", permission: "navigation.projects", allowed: false }],
    );
    expect(headDeniedNav.has("navigation.projects")).toBe(false);
    expect(headDeniedNav.has("projects.create")).toBe(false);
    expect(headDeniedNav.has("projects.archive")).toBe(false);
    expect(headDeniedNav.has("projects.delete")).toBe(false);

    // Member with stale override granting projects.create without navigation.projects
    const memberOrphan = resolvePermissions(
      "member",
      [{ role: "member", permission: "navigation.projects", allowed: false }],
      [
        { userId: "m1", permission: "projects.create", allowed: true },
        { userId: "m1", permission: "users.manage", allowed: true },
        { userId: "m1", permission: "accounting.release_cash", allowed: true },
      ],
    );
    expect(memberOrphan.has("projects.create")).toBe(false);
    expect(memberOrphan.has("users.manage")).toBe(false);
    expect(memberOrphan.has("accounting.release_cash")).toBe(false);

    // Accounting Staff retains accounting actions when prerequisites are allowed
    const accounting = resolvePermissions("accounting_staff", [], []);
    expect(accounting.has("accounting.release_cash")).toBe(true);
    expect(accounting.has("accounting.post_journal")).toBe(true);
    expect(accounting.has("navigation.user_management")).toBe(false);

    // Navigation guard blocks all non-admins from admin sections
    expect(canOpenNavigationSection("member", "users", () => true)).toBe(false);
    expect(canOpenNavigationSection("head", "audit", () => true)).toBe(false);
    expect(canOpenNavigationSection("admin", "users", () => true)).toBe(true);
  });

  it("auto-enables prerequisites and cascades disabling dependents for role toggles", () => {
    expect(getPermissionPrerequisites("projects.create")).toEqual(["navigation.projects"]);
    expect(getPermissionDependents("navigation.projects").sort()).toEqual([
      "projects.archive",
      "projects.create",
      "projects.delete",
    ]);

    // Enabling projects.create on an empty map auto-enables navigation.projects
    const enablePlan = planRolePermissionToggle({}, "projects.create", true, "member");
    expect(enablePlan.allowed).toBe(true);
    expect(enablePlan.changes).toEqual({
      "projects.create": true,
      "navigation.projects": true,
    });
    expect(enablePlan.autoEnabled).toEqual(["navigation.projects"]);
    expect(enablePlan.summary).toContain("Open Projects");

    // Enabling navigation.projects alone does NOT auto-enable actions
    const viewOnlyPlan = planRolePermissionToggle({}, "navigation.projects", true, "member");
    expect(viewOnlyPlan.changes).toEqual({ "navigation.projects": true });
    expect(viewOnlyPlan.autoEnabled).toEqual([]);

    // Disabling navigation.projects cascades active project actions
    const disablePlan = planRolePermissionToggle(
      {
        "navigation.projects": true,
        "projects.create": true,
        "projects.archive": true,
        "projects.delete": false,
      },
      "navigation.projects",
      false,
      "head",
    );
    expect(disablePlan.allowed).toBe(true);
    expect(disablePlan.changes).toEqual({
      "navigation.projects": false,
      "projects.create": false,
      "projects.archive": false,
    });
    expect(disablePlan.cascadeDisabled.sort()).toEqual([
      "projects.archive",
      "projects.create",
    ]);

    // Admin-only & accounting-only role restrictions
    expect(planRolePermissionToggle({}, "users.manage", true, "head").allowed).toBe(false);
    expect(planRolePermissionToggle({}, "accounting.release_cash", true, "member").allowed).toBe(false);
    expect(planRolePermissionToggle({}, "accounting.release_cash", true, "accounting_staff").allowed).toBe(true);
  });

  it("supports module quick access presets and custom mix detection", () => {
    const projectsModule = PERMISSION_MODULES.find((m) => m.id === "projects")!;
    expect(detectModulePreset(projectsModule, { "navigation.projects": true })).toBe("view");
    expect(
      detectModulePreset(projectsModule, {
        "navigation.projects": true,
        "projects.create": true,
      }),
    ).toBe("manage");
    expect(
      detectModulePreset(projectsModule, {
        "navigation.projects": true,
        "projects.create": true,
        "projects.archive": true,
      }),
    ).toBe("custom");

    const toManage = planModulePresetChange({}, projectsModule, "manage", "member");
    expect(toManage.allowed).toBe(true);
    expect(toManage.changes).toEqual({
      "navigation.projects": true,
      "projects.create": true,
    });

    const toNone = planModulePresetChange(
      { "navigation.projects": true, "projects.create": true, "projects.archive": true },
      projectsModule,
      "none",
      "head",
    );
    expect(toNone.changes).toEqual({
      "navigation.projects": false,
      "projects.create": false,
      "projects.archive": false,
    });
  });

  it("enforces dependency consistency across individual user overrides", () => {
    const headBaseline: Record<string, boolean> = {
      "navigation.projects": true,
      "projects.create": true,
      "projects.archive": true,
      "projects.delete": true,
    };
    // Denying navigation.projects for a Head cascades denying all 3 inherited project actions
    const denyNav = planUserOverrideChange(
      headBaseline,
      {},
      "navigation.projects",
      false,
      "head",
    );
    expect(denyNav.allowed).toBe(true);
    expect(denyNav.changes).toEqual({
      "navigation.projects": false,
      "projects.create": false,
      "projects.archive": false,
      "projects.delete": false,
    });

    // Allowing projects.create for a Member whose navigation.projects is denied auto-enables navigation.projects
    const allowAction = planUserOverrideChange(
      { "navigation.projects": false, "projects.create": false },
      {},
      "projects.create",
      true,
      "member",
    );
    expect(allowAction.allowed).toBe(true);
    expect(allowAction.changes).toEqual({
      "projects.create": true,
      "navigation.projects": true,
    });
    expect(allowAction.autoEnabled).toEqual(["navigation.projects"]);

    // Normalize strips invalid grants & ensures prerequisites
    const normalized = normalizeRolePermissionMap(
      {
        "tasks.verify": true,
        "users.manage": true,
        "accounting.post_journal": true,
      },
      "member",
    );
    expect(normalized["tasks.verify"]).toBe(true);
    expect(normalized["navigation.reviews"]).toBe(true);
    expect(normalized["users.manage"]).toBe(false);
    expect(normalized["accounting.post_journal"]).toBe(false);
    expect(enforcePermissionDependencies(["tasks.verify"], { isAdmin: false, baseRole: "member" }).has("tasks.verify")).toBe(false);
  });

  it("auto-enables prerequisite navigation and submits clean permissions in CustomRoleModal", () => {
    const onSubmit = vi.fn();
    render(
      <CustomRoleModal
        open
        mode="create"
        saving={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Role name/i), {
      target: { value: "Project Coordinator" },
    });

    // Click "Create & manage" quick preset on Projects module
    const projectsPresetGroup = screen.getByRole("group", { name: "Projects access level" });
    fireEvent.click(projectsPresetGroup.querySelectorAll("button")[2]); // Create & manage

    // Also enable Review and verify submissions directly -> should auto-enable Open Review Queues
    const verifyGroup = screen.getByRole("group", { name: "Review and verify submissions" });
    fireEvent.click(verifyGroup.querySelector("button")!);
    expect(screen.getByRole("status")).toHaveTextContent(/Open Review Queues/i);

    fireEvent.click(screen.getByRole("button", { name: "Create role" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    const submitted = onSubmit.mock.calls[0][0] as {
      label: string;
      permissions: Record<PermissionKey, boolean>;
    };
    expect(submitted.label).toBe("Project Coordinator");
    expect(submitted.permissions["navigation.projects"]).toBe(true);
    expect(submitted.permissions["projects.create"]).toBe(true);
    expect(submitted.permissions["navigation.reviews"]).toBe(true);
    expect(submitted.permissions["tasks.verify"]).toBe(true);
    expect(submitted.permissions["users.manage"]).toBe(false);
  });
});
