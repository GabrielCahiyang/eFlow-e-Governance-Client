import { describe, expect, it } from "vitest";
import { getCoreRoleNavigation } from "../../src/app/components/Layout/coreWorkflowNavigation";
import { mapRoleToPanel } from "../../src/app/features/app-shell/role";
import { getNavigationPermission } from "../../src/app/features/navigation/navigationPermissions";
import { ACCOUNTING_VIEWS } from "../../src/app/features/budget/accountingNavigation";
import { FALLBACK_DEFAULTS } from "../../src/app/features/permissions/constants";

describe("accounting staff role contract", () => {
  it("maps the persisted role to its dedicated presentation workspace", () => {
    expect(mapRoleToPanel("accounting_staff")).toBe("accounting_staff");
  });

  it("adds the five accounting destinations to the employee workspace", () => {
    const navigation = getCoreRoleNavigation("accounting_staff");
    const employeeNavigation = getCoreRoleNavigation("member");
    expect(navigation?.defaultSection).toBe("accounting_overview");
    expect(navigation?.navItems.map((item) => item.id)).toEqual([
      ...(employeeNavigation?.navItems.map((item) => item.id) ?? []),
      "accounting_overview",
      "accounting_releases",
      "accounting_journal",
      "accounting_audit",
      "accounting_budgets",
    ]);
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
