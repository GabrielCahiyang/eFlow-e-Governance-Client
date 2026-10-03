// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cashData } from "./taskCashClearance.fixtures";

const mocked = vi.hoisted(() => ({ budget: vi.fn() }));
vi.mock("../../src/app/contexts/AuthContext", () => ({ useAuth: () => ({ userProfile: { id: "head-1", org_id: "home-org", role: "head" } }) }));
vi.mock("../../src/app/features/budget/hooks/useDepartmentBudget", () => ({ useDepartmentBudget: mocked.budget }));
vi.mock("../../src/app/features/budget/components/BudgetApprovalQueue", () => ({ BudgetApprovalQueue: ({ focusRecordId }: { focusRecordId?: string }) => <div>Focused record: {focusRecordId}</div> }));
vi.mock("../../src/app/features/budget/components/FiscalYearControl", () => ({ FiscalYearControl: ({ value }: { value: number }) => <div>Fiscal year: {value}</div> }));
vi.mock("../../src/app/components/workflow/primitives", () => ({ PageHeader: ({ actions }: { actions: ReactNode }) => <header>Financial approvals{actions}</header>, LoadingState: () => <div>Loading</div> }));
import { BudgetReviewInbox } from "../../src/app/features/budget/components/BudgetReviewInbox";

afterEach(cleanup);
describe("cash blocker financial review destination", () => {
  it("loads the blocked request's office and fiscal year and focuses its liquidation ID", () => {
    mocked.budget.mockReturnValue({ ...cashData(), summary: { id: "budget-1" }, allocations: [], loading: false, error: "", refresh: vi.fn() });
    render(<BudgetReviewInbox cashReviewFocus={{ orgId: "request-org", fiscalYear: 2025, recordId: "liquidation-2" }} />);
    expect(mocked.budget).toHaveBeenCalledWith("request-org", 2025);
    expect(screen.getByText("Focused record: liquidation-2")).toBeTruthy();
    expect(screen.getByText("Fiscal year: 2025")).toBeTruthy();
  });
});
