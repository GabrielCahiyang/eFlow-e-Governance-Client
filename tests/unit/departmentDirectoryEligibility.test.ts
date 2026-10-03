import { describe, expect, it } from "vitest";
import type { Employee } from "../../src/app/services/employeeService";
import type { UserProfile } from "../../src/app/types";
import { isEligibleDepartmentDirectoryEmployee } from "../../src/app/features/members/services/departmentDirectoryEligibility";

const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: "head-1",
  name: "Head",
  email: "head@example.gov.ph",
  jobTitle: "Head",
  jobDescription: "Head",
  currentWorkload: 0,
  department: "ledipo",
  ...overrides,
});

const profile = (overrides: Partial<UserProfile> = {}): Partial<UserProfile> => ({
  id: "head-1",
  email: "head@example.gov.ph",
  role: "head",
  is_active: true,
  status: "active",
  ...overrides,
});

const assignmentOptions = {
  scopedOrgIds: new Set(["ledipo"]),
  currentUserId: "head-1",
  currentUserEmail: "head@example.gov.ph",
  headUserIds: new Set(["head-1"]),
  headUserEmails: new Set(["head@example.gov.ph"]),
  includeCurrentUser: true,
  includeDepartmentHeads: true,
  activeOnly: true,
  excludeAdmins: true,
};

describe("office assignment eligibility", () => {
  it("allows the signed-in Head to lead work", () => {
    expect(
      isEligibleDepartmentDirectoryEmployee(employee(), profile(), assignmentOptions),
    ).toBe(true);
  });

  it("allows an active Member from the same office", () => {
    expect(
      isEligibleDepartmentDirectoryEmployee(
        employee({ id: "assistant-1", name: "Member", email: "assistant@example.gov.ph" }),
        profile({ id: "assistant-1", email: "assistant@example.gov.ph", role: "member" }),
        assignmentOptions,
      ),
    ).toBe(true);
  });

  it("rejects inactive, Admin, and outside-office candidates", () => {
    expect(
      isEligibleDepartmentDirectoryEmployee(employee(), profile({ is_active: false }), assignmentOptions),
    ).toBe(false);
    expect(
      isEligibleDepartmentDirectoryEmployee(employee(), profile({ role: "super_admin" }), assignmentOptions),
    ).toBe(false);
    expect(
      isEligibleDepartmentDirectoryEmployee(
        employee({ department: "ociib" }),
        profile({ org_id: "ociib" }),
        assignmentOptions,
      ),
    ).toBe(false);
  });
});
