import { describe, expect, it } from "vitest";
import {
  canCreateOfficeProject,
  canManageSpecificProject,
} from "../../src/app/features/projects/components/model";
import { readinessResolution } from "../../src/app/features/project-readiness/resolution";
import type { Organization, UserProfile } from "../../src/app/types";

const ledipo: Organization = {
  id: "org-ledipo",
  name: "LEDIPO",
  slug: "ledipo",
  org_type: "department",
  is_active: true,
  head_user_id: "user-head",
  parent_id: null,
  path: "ledipo",
  description: "",
  created_at: "",
  updated_at: "",
};

const makeUser = (overrides: Partial<UserProfile>): UserProfile => ({
  id: "user-member",
  full_name: "Delegated Creator",
  avatar_path: null,
  email: "creator@ledipo.gov.ph",
  email_notifications_enabled: true,
  employee_id: "E-1",
  org_id: "org-ledipo",
  role: "member",
  custom_role_key: "bagong_role",
  skills: {},
  workload: 0,
  burnout_level: "low",
  is_active: true,
  created_at: "",
  updated_at: "",
  uid: "user-member",
  employeeId: "E-1",
  fullName: "Delegated Creator",
  avatarPath: null,
  emailNotificationsEnabled: true,
  departmentId: "org-ledipo",
  burnoutLevel: "low",
  status: "active",
  createdAt: 0,
  lastLogin: 0,
  ...overrides,
});

describe("delegated project creation & owned project management (Slice 2)", () => {
  it("allows active non-admin staff with projects.create in their own office to create projects", () => {
    const delegatedMember = makeUser({ id: "user-member", role: "member", custom_role_key: "bagong_role" });
    const head = makeUser({ id: "user-head", role: "head", custom_role_key: null });
    const admin = makeUser({ id: "user-admin", role: "admin", org_id: null, departmentId: "" });

    expect(canCreateOfficeProject(delegatedMember, [ledipo], true, "org-ledipo")).toBe(true);
    expect(canCreateOfficeProject(delegatedMember, [ledipo], false, "org-ledipo")).toBe(false);
    expect(canCreateOfficeProject(delegatedMember, [ledipo], true, "org-other")).toBe(false);
    expect(canCreateOfficeProject(head, [ledipo], true, "org-ledipo")).toBe(true);
    expect(canCreateOfficeProject(admin, [ledipo], true, "org-ledipo")).toBe(false);
  });

  it("scopes non-Head project management strictly to projects they created or lead", () => {
    const delegated = makeUser({ id: "user-member", role: "member", custom_role_key: "bagong_role" });
    const head = makeUser({ id: "user-head", role: "head", custom_role_key: null });

    const ownProject = { orgId: "org-ledipo", createdBy: "user-member", ownerId: "user-member", projectLeadId: "user-member" };
    const headProject = { orgId: "org-ledipo", createdBy: "user-head", ownerId: "user-head", projectLeadId: "user-head" };
    const ledProject = { orgId: "org-ledipo", createdBy: "user-head", ownerId: "user-head", projectLeadId: "user-member" };
    const collabProject = { ...ownProject, sourceCollaborationDraftId: "draft-1" };

    expect(canManageSpecificProject(ownProject, delegated, [ledipo], true)).toBe(true);
    expect(canManageSpecificProject(ledProject, delegated, [ledipo], true)).toBe(true);
    expect(canManageSpecificProject(headProject, delegated, [ledipo], true)).toBe(false);
    expect(canManageSpecificProject(collabProject, delegated, [ledipo], true)).toBe(false);
    expect(canManageSpecificProject(ownProject, delegated, [ledipo], false)).toBe(false);

    // Office Head retains office-wide project management.
    expect(canManageSpecificProject(ownProject, head, [ledipo], true)).toBe(true);
    expect(canManageSpecificProject(headProject, head, [ledipo], true)).toBe(true);
    expect(canManageSpecificProject(collabProject, head, [ledipo], true)).toBe(true);
  });

  it("routes funding_certification readiness checks to the Project budget view", () => {
    expect(readinessResolution("funding_certification", false)).toEqual({
      view: "budget",
      label: "Open Project budget",
    });
  });
});
