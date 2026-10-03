import { describe, expect, it } from "vitest";
import {
  getRoleNavigation,
  getRoleNavigationCandidates,
  isRoleNavigationItemVisible,
} from "../../src/app/features/navigation/roleNavigation";
import { canOpenNavigationSection, getNavigationPermission } from "../../src/app/features/navigation/navigationPermissions";

describe("role navigation compatibility", () => {
  it("keeps active workflow section identifiers and defaults stable", () => {
    const departmentHead = getRoleNavigation("head");
    expect(departmentHead.defaultSection).toBe("dashboard");
    expect(departmentHead.navItems.map((item) => item.id)).toEqual([
      "dashboard", "projects", "tasks", "budget", "leading", "subtasks", "reviews",
      "team", "identity", "intelligence", "reports", "announcements",
    ]);
    expect(departmentHead.navItems.find((item) => item.id === "leading")?.requiresLeadership).toBe(true);

    const employee = getRoleNavigation("member");
    expect(employee.defaultSection).toBe("tasks");
    expect(employee.navItems.map((item) => item.id)).toEqual([
      "tasks", "projects", "leading", "subtasks", "reviews", "deadlines", "history",
      "performance", "reports", "announcements",
    ]);
    expect(employee.navItems.some((item) => item.id === "budget")).toBe(false);
    expect(employee.navItems.find((item) => item.id === "reviews")?.requiresLeadership).toBe(true);
  });

  it("offers only account administration to Admin and blocks prototype roles", () => {
    expect(getRoleNavigation("admin").defaultSection).toBe("users");
    expect(getRoleNavigation("admin").navItems.map(item=>item.id)).toEqual(["users"]);
    for(const role of ["executive","legislative","hrmo","finance","councilor_pad","missing"]){
      expect(getRoleNavigation(role)).toEqual({navItems:[],defaultSection:"unavailable"});
    }
  });

  it("applies the same entitlement to sidebar and direct page resolution", () => {
    const allowed = new Set(["navigation.projects"]);
    const can = (permission: string) => allowed.has(permission);
    expect(canOpenNavigationSection("head", "projects", can)).toBe(true);
    expect(canOpenNavigationSection("head", "reports", can)).toBe(false);
    expect(getNavigationPermission("head", "reports")).toBe("navigation.reports");
    expect(getNavigationPermission("head", "budget")).toBe("navigation.projects");
    expect(canOpenNavigationSection("head", "dashboard", can)).toBe(true);
    expect(canOpenNavigationSection("executive", "portfolio", () => false)).toBe(false);
  });

  it("moves permissions into User Management without changing the legacy route contract", () => {
    const superAdmin = getRoleNavigation("admin");
    expect(superAdmin.navItems.some((item) => item.id === "permissions")).toBe(false);
    expect(superAdmin.navItems.some((item) => item.id === "users")).toBe(true);
    expect(getNavigationPermission("admin", "permissions")).toBe("navigation.user_management");
  });

  it("offers administrative destinations to permission-managed roles", () => {
    const candidates = getRoleNavigationCandidates("head");
    expect(candidates.some((item) => item.id === "users")).toBe(true);
    expect(candidates.some((item) => item.id === "org_tree")).toBe(true);
    expect(candidates.some((item) => item.id === "migration")).toBe(true);
    expect(candidates.filter((item) => canOpenNavigationSection(
      "head",
      item.id,
      (permission) => permission === "navigation.user_management",
    )).map((item) => item.id)).toContain("users");
    expect(getRoleNavigationCandidates("executive")).toEqual(getRoleNavigation("executive").navItems);
  });

  it("only exposes contextual leadership destinations when the user leads work", () => {
    const headLeading = getRoleNavigation("head").navItems.find((item) => item.id === "leading")!;
    const employeeLeading = getRoleNavigation("member").navItems.find((item) => item.id === "leading")!;
    const employeeReviews = getRoleNavigation("member").navItems.find((item) => item.id === "reviews")!;
    const headProjects = getRoleNavigation("head").navItems.find((item) => item.id === "projects")!;

    expect(isRoleNavigationItemVisible(headLeading, false)).toBe(false);
    expect(isRoleNavigationItemVisible(employeeLeading, false)).toBe(false);
    expect(isRoleNavigationItemVisible(employeeReviews, false)).toBe(false);
    expect(isRoleNavigationItemVisible(headProjects, false)).toBe(true);
    expect(isRoleNavigationItemVisible(headLeading, true)).toBe(true);
    expect(isRoleNavigationItemVisible(employeeLeading, true)).toBe(true);
    expect(isRoleNavigationItemVisible(employeeReviews, true)).toBe(true);
  });

  it("keeps both contextual leadership pages available to an assigned Task Lead", () => {
    const denied = () => false;

    expect(canOpenNavigationSection("member", "leading", denied, true)).toBe(true);
    expect(canOpenNavigationSection("member", "reviews", denied, true)).toBe(true);
    expect(canOpenNavigationSection("member", "reviews", denied)).toBe(false);
  });
});
