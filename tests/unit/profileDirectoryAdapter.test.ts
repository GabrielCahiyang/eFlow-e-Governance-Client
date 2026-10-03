import { describe, expect, it } from "vitest";
import {
  getDirectoryProfileId,
  profileToDirectoryEmployee,
} from "../../src/app/features/members/services/profileDirectoryAdapter";

describe("Supabase profile directory adapter", () => {
  it("uses the raw Supabase id and full_name fields", () => {
    const employee = profileToDirectoryEmployee(
      {
        id: "profile-1",
        full_name: "Planning Staff One",
        email: "planning.staff1@gmail.com",
        org_id: "planning-section",
        role: "member",
        workload: 0,
      },
      new Map([["planning-section", "Planning & Programming Section"]]),
    );

    expect(employee).toMatchObject({
      id: "profile-1",
      name: "Planning Staff One",
      department: "planning-section",
      departmentName: "Planning & Programming Section",
    });
  });

  it("keeps compatibility with legacy uid profiles", () => {
    expect(getDirectoryProfileId({ uid: "legacy-profile" })).toBe("legacy-profile");
  });
});
