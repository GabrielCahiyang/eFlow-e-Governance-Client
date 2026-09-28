import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Organization, UserProfile } from "../../src/app/types";

const updateProfile = vi.hoisted(() => vi.fn());
const assignOrganizationLeadership = vi.hoisted(() => vi.fn());

vi.mock("../../src/lib/supabaseService", () => ({ updateProfile }));
vi.mock("../../src/app/features/organization/services/leadershipService", () => ({ assignOrganizationLeadership }));

import { updateManagedUserWithLeadership } from "../../src/app/features/administration/services/managedUserLeadershipService";

beforeEach(() => vi.clearAllMocks());

describe("managed leadership profile updates", () => {
  it("updates Head profile details without rewriting an unchanged leadership assignment", async () => {
    const user = { id: "head-1", role: "dept_head", org_id: "org-1", full_name: "Old Name" } as UserProfile;
    const organizations = [{ id: "org-1", head_user_id: "head-1", assistant_head_user_id: null, is_active: true }] as Organization[];
    const changes = { full_name: "New Name", role: "dept_head" as const, org_id: "org-1", skills: { planning: true } };

    await updateManagedUserWithLeadership({ user, changes, organizations, profiles: [user] });

    expect(assignOrganizationLeadership).not.toHaveBeenCalled();
    expect(updateProfile).toHaveBeenCalledWith("head-1", changes);
  });
});
