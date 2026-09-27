import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveProjectWorkspaceAccess } from "../../src/app/features/projects/components/model";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260819000006_super_admin_project_read_only.sql", import.meta.url),
  "utf8",
);
const superAdminContent = readFileSync(
  new URL("../../src/app/components/SuperAdmin/SuperAdminContent.tsx", import.meta.url),
  "utf8",
);

describe("Super Admin project oversight", () => {
  const allPermissions = () => true;

  it("removes every project mutation while retaining read and export access", () => {
    expect(resolveProjectWorkspaceAccess(true, allPermissions)).toEqual({
      canCreate: false,
      canManage: false,
      canArchive: false,
      canDelete: false,
      canReviewTasks: false,
      canExport: true,
    });
  });

  it("does not change Head and Assistant Head project capabilities", () => {
    expect(resolveProjectWorkspaceAccess(false, allPermissions)).toMatchObject({
      canCreate: true,
      canManage: true,
      canArchive: true,
      canDelete: true,
      canReviewTasks: true,
    });
  });

  it("enforces read-only project oversight in the database", () => {
    expect(sql).toContain("public.is_super_admin(auth.uid())");
    expect(sql).toContain("before insert or update or delete on public.projects");
    expect(sql).toContain("Super Admin project access is read-only");
  });

  it("mounts the Super Admin portfolio in read-only mode", () => {
    expect(superAdminContent).toContain("<ProjectsWorkspace scope={ADMIN_SCOPE}");
    expect(superAdminContent).toContain("readOnly");
  });
});
