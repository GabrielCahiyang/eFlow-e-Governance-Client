import { describe, expect, it } from "vitest";
import { getLeadershipSlotConflict } from "../../src/app/features/administration/services/leadershipConstraints";
import type { Organization, UserProfile } from "../../src/app/types";

const organization = {
  id: "ledipo",
  name: "LEDIPO",
  slug: "ledipo",
  parent_id: null,
  path: "lgu.ledipo",
  org_type: "department",
  description: "",
  head_user_id: "head-1",
  assistant_head_user_id: "assistant-1",
  is_active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
} satisfies Organization;

function profile(id: string, fullName: string, role: UserProfile["role"]): UserProfile {
  return {
    id,
    full_name: fullName,
    avatar_path: null,
    email: `${id}@example.gov.ph`,
    email_notifications_enabled: true,
    employee_id: id,
    org_id: "ledipo",
    role,
    skills: {},
    workload: 0,
    burnout_level: "low",
    is_active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    uid: id,
    employeeId: id,
    fullName,
    avatarPath: null,
    emailNotificationsEnabled: true,
    departmentId: "ledipo",
    burnoutLevel: "low",
    status: "active",
    createdAt: 1,
    lastActive: 1,
  };
}

describe("organization leadership uniqueness", () => {
  const profiles = [
    profile("head-1", "Existing Head", "head"),
    profile("assistant-1", "Existing Assistant", "member"),
    profile("employee-1", "New Member", "member"),
  ];

  it("rejects a second Head and names the existing occupant", () => {
    expect(getLeadershipSlotConflict({
      role: "head",
      orgId: "ledipo",
      currentUserId: "employee-1",
      organizations: [organization],
      profiles,
    })).toContain("Existing Head");
  });

  it("does not create leadership slots for Members", () => {
    expect(getLeadershipSlotConflict({
      role: "member",
      orgId: "ledipo",
      currentUserId: "employee-1",
      organizations: [organization],
      profiles,
    })).toBeNull();
  });

  it("allows the current official occupant to keep their position", () => {
    expect(getLeadershipSlotConflict({
      role: "head",
      orgId: "ledipo",
      currentUserId: "head-1",
      organizations: [organization],
      profiles,
    })).toBeNull();
  });
});
