// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountingSettlementQueue } from "../../src/app/features/budget/components/AccountingSettlementQueue";
import type { DepartmentBudgetBundle } from "../../src/app/features/budget/types";
import { cashData, cashRequest } from "./taskCashClearance.fixtures";

const auth = vi.hoisted(() => ({ role: "accounting_staff", id: "accounting-1", allowed: true }));
const settle = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../../src/app/contexts/AuthContext", () => ({ useAuth: () => ({ userProfile: { id: auth.id, role: auth.role }, can: () => auth.allowed }) }));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({ decidePettyCashLiquidation: settle, createReceiptSignedUrl: vi.fn() }));

function bundle(authorized = false) {
  const data = cashData([cashRequest({ liquidationDueAt: 1 })]);
  data.liquidations[0].departmentDecidedAt = authorized ? 3 : undefined;
  data.liquidations[0].departmentDecidedBy = authorized ? "head-1" : undefined;
  return data as DepartmentBudgetBundle;
}

describe("Accounting settlement authority", () => {
  afterEach(cleanup);
  beforeEach(() => { auth.role = "accounting_staff"; auth.id = "accounting-1"; auth.allowed = true; settle.mockClear(); });
  it("waits for Head authorization before settling a late package", () => {
    render(<AccountingSettlementQueue data={bundle()} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Awaiting Head/ }).getAttribute("aria-disabled")).toBe("true");
    expect(settle).not.toHaveBeenCalled();
  });
  it("enables Accounting settlement after Head authorizes the late package", async () => {
    const changed = vi.fn().mockResolvedValue(undefined);
    render(<AccountingSettlementQueue data={bundle(true)} onChanged={changed} />);
    fireEvent.click(screen.getByRole("button", { name: /Settle & post/ }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(settle).toHaveBeenCalledWith("liquidation-2", true, expect.any(String));
  });
  it.each(["head", "admin", "member"])("prevents %s from executing accounting settlement even with a permission override", (role) => {
    auth.role = role;
    render(<AccountingSettlementQueue data={bundle(true)} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Settle & post/ }).getAttribute("aria-disabled")).toBe("true");
  });
  it("preserves independent settlement and explicit permission denial", () => {
    auth.id = "employee-1";
    const view = render(<AccountingSettlementQueue data={bundle(true)} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Settle & post/ }).getAttribute("aria-disabled")).toBe("true");
    auth.id = "accounting-1"; auth.allowed = false;
    view.rerender(<AccountingSettlementQueue data={bundle(true)} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Settle & post/ }).getAttribute("aria-disabled")).toBe("true");
  });
});
