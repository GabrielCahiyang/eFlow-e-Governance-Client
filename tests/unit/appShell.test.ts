import { describe, expect, it } from "vitest";
import { mapRoleToPanel } from "../../src/app/features/app-shell/role";

describe("role panel compatibility", () => {
  it("preserves persisted role mappings", () => {
    expect(mapRoleToPanel("super_admin")).toBe("superadmin");
    expect(mapRoleToPanel("admin")).toBe("superadmin");
    expect(mapRoleToPanel("dept_head")).toBe("depthead");
    expect(mapRoleToPanel("assistant_head")).toBe("depthead");
    expect(mapRoleToPanel("department_head")).toBe("depthead");
    expect(mapRoleToPanel("team_leader")).toBe("employee");
    expect(mapRoleToPanel("teamleader")).toBe("employee");
    expect(mapRoleToPanel("employee")).toBe("employee");
    expect(mapRoleToPanel("unknown-role")).toBe("employee");
  });
});
