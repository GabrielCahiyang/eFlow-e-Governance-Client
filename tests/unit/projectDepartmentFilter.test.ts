import { describe, expect, it } from "vitest";
import {
  ALL_PROJECT_DEPARTMENTS,
  UNASSIGNED_PROJECT_DEPARTMENT,
  matchesProjectDepartment,
} from "../../src/app/features/projects/components/model";

describe("Super Admin Plans & Projects department filter", () => {
  it("shows all projects by default and narrows to the selected lead department", () => {
    expect(matchesProjectDepartment("ledipo", ALL_PROJECT_DEPARTMENTS)).toBe(true);
    expect(matchesProjectDepartment(undefined, ALL_PROJECT_DEPARTMENTS)).toBe(true);
    expect(matchesProjectDepartment("ledipo", "ledipo")).toBe(true);
    expect(matchesProjectDepartment("bplo", "ledipo")).toBe(false);
  });

  it("keeps projects without an assigned department available through an explicit filter", () => {
    expect(matchesProjectDepartment(undefined, UNASSIGNED_PROJECT_DEPARTMENT)).toBe(true);
    expect(matchesProjectDepartment(null, UNASSIGNED_PROJECT_DEPARTMENT)).toBe(true);
    expect(matchesProjectDepartment("ledipo", UNASSIGNED_PROJECT_DEPARTMENT)).toBe(false);
  });
});
