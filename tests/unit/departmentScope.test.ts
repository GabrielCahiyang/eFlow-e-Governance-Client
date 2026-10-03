import { describe, expect, it } from "vitest";
import type { Organization } from "../../src/app/types";
import { getDepartmentEmployeeScopeIds } from "../../src/app/features/members/services/departmentScope";

const organizations: Organization[] = [
  {
    id: "ledipo",
    name: "LEDIPO",
    slug: "ledipo",
    parent_id: null,
    path: "ledipo",
    org_type: "department",
    description: "",
    head_user_id: null,
    assistant_head_user_id: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "ociib",
    name: "OCIIB",
    slug: "ociib",
    parent_id: "ledipo",
    path: "ledipo.ociib",
    org_type: "unit",
    description: "",
    head_user_id: null,
    assistant_head_user_id: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("office employee scope", () => {
  it("keeps exact assignment scope to the user's office", () => {
    expect(
      Array.from(getDepartmentEmployeeScopeIds(organizations, "ledipo", "exact")),
    ).toEqual(["ledipo"]);
  });

  it("only includes child units when that scope is explicitly requested", () => {
    expect(
      Array.from(getDepartmentEmployeeScopeIds(organizations, "ledipo", "with_children")),
    ).toEqual(["ledipo", "ociib"]);
  });
});
