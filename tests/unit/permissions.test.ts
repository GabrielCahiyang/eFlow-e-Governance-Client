import { describe, expect, it } from "vitest";
import { resolvePermissions } from "../../src/app/services/permissionService";

describe("permission resolution compatibility", () => {
  it("uses persisted role permissions and applies user overrides last", () => {
    const result = resolvePermissions(
      "dept_head",
      [
        { role: "dept_head", permission: "tasks.assign", allowed: true },
        { role: "dept_head", permission: "reports.export", allowed: false },
      ],
      [
        { userId: "user-1", permission: "tasks.assign", allowed: false },
        { userId: "user-1", permission: "reports.export", allowed: true },
      ],
    );
    expect(result.has("tasks.assign")).toBe(false);
    expect(result.has("reports.export")).toBe(true);
    expect(result.has("navigation.projects")).toBe(true);
    expect(result.has("navigation.team_intelligence")).toBe(true);
  });

  it("gives Assistant Head the same default workspace capabilities as Head", () => {
    const permissions = resolvePermissions("assistant_head", [], []);
    expect(permissions.has("projects.create")).toBe(true);
    expect(permissions.has("tasks.verify")).toBe(true);
    expect(permissions.has("navigation.reviews")).toBe(true);
    expect(permissions.has("navigation.user_management")).toBe(false);
  });

  it("keeps Super Admin access immutable even if an override says deny", () => {
    const permissions = resolvePermissions("super_admin", [], [
      { userId: "admin", permission: "database.backup", allowed: false },
    ]);
    expect(permissions.has("database.backup")).toBe(true);
    expect(permissions.has("navigation.user_management")).toBe(true);
  });

  it("gives Admin the former root authority despite legacy revocation overrides", () => {
    const permissions = resolvePermissions("admin", [], [
      { userId: "admin-1", permission: "navigation.audit", allowed: false },
    ]);
    expect(permissions.has("navigation.user_management")).toBe(true);
    expect(permissions.has("users.manage")).toBe(true);
    expect(permissions.has("navigation.audit")).toBe(true);
    expect(permissions.has("database.backup")).toBe(true);
  });
});
