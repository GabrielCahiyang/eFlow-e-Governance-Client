import { describe, expect, it } from "vitest";

import { getRoleNavigation } from "../../src/app/features/navigation/roleNavigation";
import { superadminSidebar } from "../../src/app/features/navigation/sidebarRoles/superadminSidebar";
import { buildShellNavigation, searchNavigation } from "../../src/app/features/navigation/presentationNavigation";
import { resolveSupportPage } from "../../src/app/features/navigation/administrativePages";

describe("Admin Data Tools compatibility", () => {
  it("keeps the legacy page key for migration links", () => {
    const navigation = getRoleNavigation("admin");
    expect(navigation.navItems.map(item=>item.id)).toEqual(["users"]);
    expect(superadminSidebar.migration.title).toBe("Data Tools");
    expect(superadminSidebar.migration.sections[0].items[0].label).toBe("Backup & Export");
    expect(resolveSupportPage("users", "Backup")).toBe("Backup & Export");
  });

  it("presents Backup and Account Audit as separately authorized destinations", () => {
    const withAccess = buildShellNavigation({ role: "admin", can: () => true });
    expect(searchNavigation("Backup", withAccess, [])).toMatchObject([
      { title: "Backup", section: "users", page: "Backup & Export" },
    ]);
    expect(searchNavigation("Account Audit", withAccess, [])).toHaveLength(1);

    const withoutBackup = buildShellNavigation({
      role: "admin",
      can: (permission) => permission !== "navigation.data_tools",
    });
    expect(searchNavigation("Backup", withoutBackup, [])).toEqual([]);
    expect(searchNavigation("Account Audit", withoutBackup, [])).toHaveLength(1);
  });
});
