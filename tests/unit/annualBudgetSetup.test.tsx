// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnualBudgetSetup } from "../../src/app/features/budget/components/AnnualBudgetSetup";
import type { DepartmentBudgetBundle } from "../../src/app/features/budget/types";

vi.mock("../../src/app/features/budget/components/LockedBudgetControls", () => ({ LockedBudgetControls: () => null }));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({ lockDepartmentFiscalBudget: vi.fn() }));
vi.mock("../../src/app/features/budget/services/budgetSectionService", () => ({ saveBudgetSections: vi.fn() }));
vi.mock("../../src/app/components/ui/useConfirmation", () => ({ useConfirmation: () => ({ dialog: null, confirm: vi.fn() }) }));
vi.mock("../../src/app/shared/useExplicitDraft", () => ({ useExplicitDraft: () => ({ pendingRef: { current: false }, markClean: vi.fn() }) }));

const empty: DepartmentBudgetBundle = { summary: null, sections: [], sectionsAvailable: false, lines: [], commitments: [], allocations: [], allocationLines: [], requests: [], requestAttachments: [], releases: [], liquidations: [], ledger: [], adjustments: [] };
const saved = { ...empty, summary: {
  id: "budget", orgId: "office", fiscalYear: 2026, status: "locked", approvedAmount: 123456.78,
  dailyPettyCashReleaseLimit: 30000, perReceiptLimit: 5000, liquidationDueDays: 15,
  allowReceiptLimitOverride: false, underutilizationThreshold: 75,
} } as DepartmentBudgetBundle;
afterEach(cleanup);

describe("annual section availability", () => {
  it("shows the actual saved amount, never an empty editor, when section support is missing", () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={empty} canEdit onChanged={refresh} />);
    view.rerender(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={saved} canEdit onChanged={refresh} />);
    expect(screen.getAllByText("₱123,456.78")).toHaveLength(2);
    expect(screen.queryByText(/No sections yet/)).toBeNull();
    expect(screen.queryByText("₱0.00")).toBeNull();
    expect(screen.queryByRole("button", { name: /Reclassify/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Save draft/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh budget" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("loads preserved opening sections when support becomes available", () => {
    const view = render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={saved} canEdit onChanged={vi.fn()} />);
    view.rerender(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{ ...saved, sectionsAvailable: true, sections: [{ id: "opening", name: "Existing budget", amount: 123456.78, heldAmount: 0, position: 0 }] }} canEdit onChanged={vi.fn()} />);
    expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    expect(screen.getByDisplayValue("Existing budget")).toBeTruthy();
    expect(screen.getByText("₱123,456.78")).toBeTruthy();
    expect(screen.queryByText(/No sections yet/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Reclassify/ }));
    expect(screen.getByRole("button", { name: "Add section" })).toBeTruthy();
  });

  it("shows an empty editable draft only for a genuinely empty supported budget", () => {
    render(<AnnualBudgetSetup orgId="office" fiscalYear={2027} data={{ ...empty, sectionsAvailable: true }} canEdit onChanged={vi.fn()} />);
    expect(screen.getByText("₱0.00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add section" })).toBeTruthy();
    expect(screen.getByText(/Add your first section/)).toBeTruthy();
  });
});
