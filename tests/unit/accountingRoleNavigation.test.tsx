import { describe, expect, it } from "vitest";
import { getCoreRoleNavigation } from "../../src/app/components/Layout/coreWorkflowNavigation";
import { mapRoleToPanel } from "../../src/app/features/app-shell/role";
import { buildShellNavigation, getPersonalWorkTools, getRoleNavigationCandidates } from "../../src/app/features/navigation";
import { canOpenNavigationSection, getNavigationPermission, isAdministrativeNavigationSection } from "../../src/app/features/navigation/navigationPermissions";
import { ACCOUNTING_VIEWS } from "../../src/app/features/budget/accountingNavigation";
import { FALLBACK_DEFAULTS } from "../../src/app/features/permissions/constants";

describe("accounting staff role contract", () => {
  it("maps the persisted role to its dedicated presentation workspace", () => {
    expect(mapRoleToPanel("accounting_staff")).toBe("accounting_staff");
  });

  it("adds the five accounting destinations to retained employee work without unused legacy tools", () => {
    const navigation = getCoreRoleNavigation("accounting_staff");
    const employeeNavigation = getCoreRoleNavigation("member");
    const expectedEmployeeIds = (employeeNavigation?.navItems.map((item) => item.id) ?? []).filter(
      (id) => !["deadlines", "performance", "reports"].includes(id),
    );
    expect(navigation?.defaultSection).toBe("accounting_overview");
    expect(navigation?.navItems.map((item) => item.id)).toEqual([
      ...expectedEmployeeIds,
      "accounting_overview",
      "accounting_releases",
      "accounting_journal",
      "accounting_audit",
      "accounting_budgets",
    ]);
  });

  it("blocks Admin Center and administrative destinations for accounting_staff even under permissive grants", () => {
    const candidates = getRoleNavigationCandidates("accounting_staff");
    expect(candidates.some((item) => isAdministrativeNavigationSection(item.id))).toBe(false);
    expect(canOpenNavigationSection("accounting_staff", "users", () => true)).toBe(false);
    expect(canOpenNavigationSection("accounting_staff", "audit", () => true)).toBe(false);
    expect(canOpenNavigationSection("accounting_staff", "administration", () => true)).toBe(false);
    expect(canOpenNavigationSection("accounting_staff", "migration", () => true)).toBe(false);
    expect(canOpenNavigationSection("accounting_staff", "permissions", () => true)).toBe(false);
    const items = buildShellNavigation({ role: "accounting_staff", can: () => true, hasLeadingWork: false });
    expect(items.some((item) => item.group === "admin-center")).toBe(false);
    expect(getPersonalWorkTools(items, "Assigned work").some((tool) => ["deadlines", "performance", "reports"].includes(tool.section))).toBe(false);
  });

  it("keeps the budget ledger and settlement tabs on their existing permission keys", () => {
    for (const item of ACCOUNTING_VIEWS) { const key = getNavigationPermission("accounting_staff",item.section); expect(key).toBeTruthy(); expect(FALLBACK_DEFAULTS.accounting_staff).toContain(key); }
    expect(getNavigationPermission("accounting_staff","accounting_budgets")).toBe("navigation.department_budgets");
  });

  it("binds each accounting section to an explicit permission", () => {
    expect(getNavigationPermission("accounting_staff", "accounting_releases")).toBe("navigation.accounting_releases");
    expect(FALLBACK_DEFAULTS.accounting_staff).toContain("accounting.settle_liquidation");
    expect(FALLBACK_DEFAULTS.accounting_staff).not.toContain("navigation.user_management");
  });
});
