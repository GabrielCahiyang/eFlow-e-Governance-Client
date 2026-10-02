import { describe, expect, it } from "vitest";
import { isLastActiveAdmin } from "../../src/app/features/administration/selectors/adminAccountProtection";
import { getRoleLabel, normalizeUserRole } from "../../src/app/shared/roles";

describe("unified Admin identity", () => {
  it("keeps the legacy identity readable while presenting a single Admin role", () => {
    expect(normalizeUserRole("super_admin")).toBe("admin");
    expect(getRoleLabel("super_admin")).toBe("Admin");
    expect(normalizeUserRole("dept_head")).toBe("dept_head");
  });

  it("protects the last active Admin regardless of the legacy role key", () => {
    const current = { id: "a", role: "admin", is_active: true };
    const legacy = { id: "b", role: "super_admin", is_active: true };
    expect(isLastActiveAdmin(current, [current])).toBe(true);
    expect(isLastActiveAdmin(legacy, [legacy])).toBe(true);
    expect(isLastActiveAdmin(current, [current, legacy])).toBe(false);
    expect(isLastActiveAdmin(current, [current, { ...legacy, is_active: false }])).toBe(true);
    expect(isLastActiveAdmin({ ...current, is_active: false }, [current])).toBe(false);
    expect(isLastActiveAdmin({ ...current, role: "employee" }, [])).toBe(false);
  });
});
