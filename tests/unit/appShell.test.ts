import { describe, expect, it } from "vitest";
import { mapRoleToPanel } from "../../src/app/features/app-shell/role";

describe("role panel compatibility", () => {
  it("preserves persisted role mappings", () => {
    expect(mapRoleToPanel("super_admin")).toBe("admin");
    expect(mapRoleToPanel("admin")).toBe("admin");
    expect(mapRoleToPanel("dept_head")).toBe("head");
    expect(mapRoleToPanel("assistant_head")).toBe("member");
    expect(mapRoleToPanel("department_head")).toBe("head");
    expect(mapRoleToPanel("team_leader")).toBe("unsupported");
    expect(mapRoleToPanel("teamleader")).toBe("unsupported");
    expect(mapRoleToPanel("employee")).toBe("member");
    expect(mapRoleToPanel("unknown-role")).toBe("unsupported");
  });
});
