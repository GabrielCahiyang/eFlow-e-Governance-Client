import { describe, expect, it } from "vitest";

import { getRoleNavigation } from "../../src/app/features/navigation/roleNavigation";
import { superadminSidebar } from "../../src/app/features/navigation/sidebarRoles/superadminSidebar";

describe("Admin Data Tools compatibility", () => {
  it("keeps the migration section id while presenting Backup & Export", () => {
    const navigation = getRoleNavigation("admin");
    expect(navigation.navItems.map(item=>item.id)).toEqual(["users"]);
    expect(superadminSidebar.migration.title).toBe("Data Tools");
    expect(superadminSidebar.migration.sections[0].items[0].label).toBe("Backup & Export");
  });
});
