// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateCashLiquidation } from "../../src/app/features/budget/validation/liquidationValidation";
import { liquidationInputError } from "../../src/app/features/budget/validation/financialValidation";
import { cashRequest } from "./taskCashClearance.fixtures";

const mocks = vi.hoisted(() => ({
  submitLiquidation: vi.fn(),
  findLiquidation: vi.fn(),
  clearance: vi.fn(),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "employee-1" },
    userProfile: { id: "employee-1", role: "member", org_id: "org-1" },
  }),
}));

vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  submitPettyCashLiquidation: mocks.submitLiquidation,
  findSavedLiquidation: mocks.findLiquidation,
}));

vi.mock("../../src/app/features/budget/services/workFinancialClearanceService", () => ({
  fetchReceiptSubmissionClearance: mocks.clearance,
  isDeterministicClearanceRejection: () => false,
}));

import { CashLiquidationDialog } from "../../src/app/features/budget/components/CashLiquidationDialog";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clearance.mockResolvedValue({
    version: 1,
    requestId: "request-1",
    workAccepted: true,
    canSubmit: true,
  });
});

afterEach(() => {
  cleanup();
});

describe("Cash liquidation validation and UX", () => {
  it("blocks spending that exceeds released cash or approved funding source limits", () => {
    const file = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" });
    const sources = [{ allocationLineId: "line-1", amount: 500, sourceName: "Food Budget" }];
    const result = validateCashLiquidation({
      approved: 500,
      itemized: true,
      sources,
      spent: 2121,
      receipts: [
        {
          id: "r1",
          vendor: "dree",
          receiptNumber: "OR-123",
          receiptDate: "2026-11-19",
          description: "Meals",
          amount: 2121,
          file,
          items: [
            {
              id: "item-1",
              allocationLineId: "line-1",
              quantity: 12,
              unit: "pcs.",
              particular: "Lunch packs",
              purpose: "Workshop meals",
              amount: 2121,
            },
          ],
        },
      ],
      refundReceiptNumber: "",
      refundDate: "2026-11-19",
      note: "Food receipts",
    });

    expect(result.exceedsReleased).toBe(true);
    expect(result.overLimitBlocked).toBe(true);
    expect(result.isValid).toBe(false);
    expect(result.releasedError).toMatch(/exceeds the released cash \(₱500\.00\) by ₱1,621\.00/i);
    expect(result.exceededSources).toHaveLength(1);
    expect(result.exceededSources[0].overByAmount).toBe(1621);

    const serverGuard = liquidationInputError({
      spent: 2121,
      note: "Food receipts",
      receipts: [
        {
          id: "r1",
          vendor: "dree",
          receiptNumber: "OR-123",
          receiptDate: "2026-11-19",
          description: "Meals",
          amount: 2121,
          file,
        },
      ],
      releasedAmount: 500,
      sources,
    });
    expect(serverGuard).toMatch(/exceeds the released cash/i);
  });

  it("immediately warns and blocks submission in CashLiquidationDialog when itemized actual cost exceeds released cash", async () => {
    const request = cashRequest({
      status: "released",
      releasedAmount: 500,
      approvedAmount: 500,
      requestedAmount: 500,
      fundingLines: [{ allocationLineId: "line-1", amount: 500, sourceName: "Food Budget" }],
    });

    render(
      <CashLiquidationDialog
        request={request}
        orgId="org-1"
        perReceiptLimit={5000}
        liquidationDueDays={15}
        allowReceiptOverride={false}
        onClose={vi.fn()}
        onSaved={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const addItemBtn = await screen.findByRole("button", { name: /Add purchased item/i });
    expect(addItemBtn).not.toBeDisabled();
    fireEvent.click(addItemBtn);

    const actualCostInput = screen.getByRole("spinbutton", { name: /Actual cost/i });
    fireEvent.change(actualCostInput, { target: { value: "2121" } });

    expect(screen.getByText(/Amount exceeds available cash — submission blocked/i)).toBeVisible();
    expect(screen.getAllByText(/Over by ₱1,621\.00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Exceeds source limit by ₱1,621\.00/i)).toBeVisible();

    const submitBtn = screen.getByRole("button", { name: /Submit liquidation/i }) as HTMLButtonElement;
    expect(submitBtn.disabled || submitBtn.getAttribute("aria-disabled") === "true").toBe(true);
    expect(mocks.submitLiquidation).not.toHaveBeenCalled();
  });

  it("explains missing required fields inline when Submit liquidation is clicked before completion", async () => {
    const request = cashRequest({
      status: "released",
      releasedAmount: 500,
      approvedAmount: 500,
      requestedAmount: 500,
      fundingLines: [{ allocationLineId: "line-1", amount: 500, sourceName: "Food Budget" }],
    });

    render(
      <CashLiquidationDialog
        request={request}
        orgId="org-1"
        perReceiptLimit={5000}
        liquidationDueDays={15}
        allowReceiptOverride={false}
        onClose={vi.fn()}
        onSaved={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const submitBtn = await screen.findByRole("button", { name: /Submit liquidation/i });
    await screen.findByText(/required items remaining/i);
    fireEvent.click(submitBtn);

    expect(screen.getAllByText("Enter the vendor or payee name.")[0]).toBeVisible();
    expect(screen.getAllByText(/Attach a receipt image \(JPG, PNG, WEBP\) or PDF\./i)[0]).toBeVisible();
    expect(screen.getAllByText(/Add a short liquidation note/i)[0]).toBeVisible();
    expect(mocks.submitLiquidation).not.toHaveBeenCalled();
  });

  it("clearly tells the user to complete the task and get Project Lead approval before liquidating", async () => {
    mocks.clearance.mockResolvedValueOnce({
      version: 1,
      requestId: "request-1",
      workAccepted: false,
      canSubmit: false,
    });
    const request = cashRequest({
      subtaskId: undefined,
      subtaskTitle: undefined,
      status: "released",
      releasedAmount: 500,
    });

    render(
      <CashLiquidationDialog
        request={request}
        orgId="org-1"
        perReceiptLimit={5000}
        liquidationDueDays={15}
        allowReceiptOverride={false}
        onClose={vi.fn()}
        onSaved={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      await screen.findByText(/To start liquidating, first complete this task and have it approved by the Project Lead\./i),
    ).toBeVisible();
    expect(
      screen.getByText(/Complete the task and get Project Lead approval to start liquidating/i),
    ).toBeVisible();
  });
});
