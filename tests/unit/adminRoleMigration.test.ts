import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260928000004_revocable_admin_role.sql", import.meta.url),
  "utf8",
);
const leadershipEditMigration = readFileSync(
  new URL("../../supabase/migrations/20260928000005_admin_leadership_profile_edits.sql", import.meta.url),
  "utf8",
);

describe("revocable Admin role migration", () => {
  it("adds Admin without weakening the protected Super Admin account", () => {
    expect(migration).toContain("'super_admin', 'admin'");
    expect(migration).toContain("('admin', 'users.manage', true)");
    expect(migration).toContain("guard_administrative_role_management");
    expect(migration).toContain("guard_administrative_leadership_assignment");
    expect(migration).toContain("public.has_permission(auth.uid(), 'users.manage')");
  });

  it("allows leader profile maintenance without allowing leadership changes", () => {
    expect(leadershipEditMigration).toContain("new.role is distinct from old.role");
    expect(leadershipEditMigration).toContain("new.org_id is distinct from old.org_id");
    expect(leadershipEditMigration).toContain("new.is_active is distinct from old.is_active");
    expect(leadershipEditMigration).toContain("profiles_update_user_managers");
  });
});
