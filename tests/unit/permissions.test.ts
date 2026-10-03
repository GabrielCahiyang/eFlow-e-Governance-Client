import { describe, expect, it } from "vitest";
import { resolvePermissions } from "../../src/app/services/permissionService";

describe("permission resolution compatibility", () => {
  it("uses persisted role permissions and applies user overrides last", () => {
    const result = resolvePermissions(
      "head",
      [
        { role: "head", permission: "tasks.assign", allowed: true },
        { role: "head", permission: "reports.export", allowed: false },
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

  it("keeps Member participation separate from Head authority", () => {
    const permissions = resolvePermissions("member", [], []);
    expect(permissions.has("projects.create")).toBe(false);
    expect(permissions.has("tasks.verify")).toBe(false);
    expect(permissions.has("navigation.reviews")).toBe(false);
    expect(permissions.has("navigation.user_management")).toBe(false);
  });

  it("keeps Admin access immutable even if an override says deny", () => {
    const permissions = resolvePermissions("super_admin", [], [
      { userId: "admin", permission: "database.backup", allowed: false },
    ]);
    expect(permissions.has("database.backup")).toBe(true);
    expect(permissions.has("navigation.user_management")).toBe(true);
  });

  it("keeps Admin administrative defaults fixed", () => {
    const permissions = resolvePermissions("admin", [], [
      { userId: "admin-1", permission: "navigation.audit", allowed: false },
    ]);
    expect(permissions.has("navigation.user_management")).toBe(true);
    expect(permissions.has("users.manage")).toBe(true);
    expect(permissions.has("projects.create")).toBe(false);
    expect(permissions.has("tasks.verify")).toBe(false);
    expect(permissions.has("projects.create")).toBe(false);
    expect(permissions.has("tasks.verify")).toBe(false);
    expect(permissions.has("navigation.audit")).toBe(true);
    expect(permissions.has("database.backup")).toBe(true);
  });
});
