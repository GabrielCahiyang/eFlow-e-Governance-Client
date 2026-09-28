import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260928000004_revocable_admin_role.sql", import.meta.url),
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
});
