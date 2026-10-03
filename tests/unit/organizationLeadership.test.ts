import { describe, expect, it } from "vitest";
import {
  filterLeadershipCandidates,
  getLeadershipCandidates,
  resolveOrganizationLeadershipReviewer,
} from "../../src/app/features/organization/selectors";
import type { Organization, UserProfile } from "../../src/app/types";

const organization: Organization = {
  id: "org-1",
  name: "Engineering Office",
  slug: "engineering",
  parent_id: null,
  path: "engineering",
  org_type: "department",
  description: "",
  head_user_id: "head-1",
  assistant_head_user_id: "assistant-1",
  is_active: true,
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
};

describe("organization leadership review routing", () => {
  it("routes Head-led work to the accountable Head", () => {
    expect(resolveOrganizationLeadershipReviewer(organization, "head-1")).toEqual({
      reviewerId: "head-1",
      reviewerRole: "head",
    });
  });

  it("routes Assistant-Head-led work to the Head", () => {
    expect(resolveOrganizationLeadershipReviewer(organization, "assistant-1")).toEqual({
      reviewerId: "head-1",
      reviewerRole: "head",
    });
  });

  it("routes Member and Task Lead work to the office Head", () => {
    expect(resolveOrganizationLeadershipReviewer(organization, "employee-1")).toEqual({reviewerId:"head-1",reviewerRole:"head"});
  });

  it("finds leadership candidates by person details or organization", () => {
    const candidates = [
      {
        id: "candidate-1",
        full_name: "Cheryl Gallo",
        email: "cheryl@ormoc.gov.ph",
        employee_id: "EMP-104",
        role: "member",
        org_id: "org-1",
      },
      {
        id: "candidate-2",
        full_name: "Raul Cam",
        email: "raul@ormoc.gov.ph",
        employee_id: "EMP-222",
        role: "member",
        org_id: null,
      },
    ] as UserProfile[];

    expect(filterLeadershipCandidates(candidates, "engineering", [organization]))
      .toMatchObject([{ id: "candidate-1" }]);
    expect(filterLeadershipCandidates(candidates, "EMP-222", [organization]))
      .toMatchObject([{ id: "candidate-2" }]);
  });

  it("offers normal organization leadership only to active people from that exact organization", () => {
    const candidates = [
      { id: "own-active", full_name: "Own office", org_id: "org-1", role: "member", is_active: true },
      { id: "other-office", full_name: "Other office", org_id: "org-2", role: "member", is_active: true },
      { id: "own-inactive", full_name: "Inactive", org_id: "org-1", role: "member", is_active: false },
      { id: "admin", full_name: "Admin", org_id: "org-1", role: "admin", is_active: true },
      { id: "super-admin", full_name: "Admin", org_id: "org-1", role: "super_admin", is_active: true },
    ] as UserProfile[];

    expect(getLeadershipCandidates(candidates, [organization], "org-1"))
      .toMatchObject([{ id: "own-active" }]);
  });
});
