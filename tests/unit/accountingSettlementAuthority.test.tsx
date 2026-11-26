// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountingSettlementQueue } from "../../src/app/features/budget/components/AccountingSettlementQueue";
import type { DepartmentBudgetBundle } from "../../src/app/features/budget/types";
import { cashData, cashRequest } from "./taskCashClearance.fixtures";

const auth = vi.hoisted(() => ({
  role: "accounting_staff",
  id: "accounting-1",
  allowed: true,
}));
const settle = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const returnClearance = vi.hoisted(() =>
  vi.fn(async (id: string) => ({
    version: 1 as const,
    liquidationId: id,
    packageVersion: 2,
    amount: 1500,
    received: true,
    approved: true,
    receivedBy: "accounting-1",
    approvedBy: "head-1",
    reference: "OR-100",
    canAcknowledge: false,
    canApprove: false,
  })),
);
vi.mock('../../src/app/features/budget/services/workFinancialClearanceService', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/app/features/budget/services/workFinancialClearanceService')>();
  return { ...original, fetchCashReturnClearance: returnClearance };
});
vi.mock('../../src/app/features/budget/services/independentReviewService', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/app/features/budget/services/independentReviewService')>();
  return { ...original, getIndependentReview: vi.fn(async (id: string) => ({ liquidationId: id, version: 2, required: false, current: false, canReview: false, canSettle: true, review: null, candidates: [], eligibleSettlers: 1, escalationRequired: false })) };
});
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { id: auth.id, role: auth.role },
    can: () => auth.allowed,
  }),
}));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  decidePettyCashLiquidation: settle,
  createReceiptSignedUrl: vi.fn(),
}));

function bundle(authorized = false) {
  const data = cashData([cashRequest({ liquidationDueAt: 1 })]);
  data.liquidations[0].departmentDecidedAt = authorized ? 3 : undefined;
  data.liquidations[0].departmentDecidedBy = authorized ? "head-1" : undefined;
  return data as DepartmentBudgetBundle;
}

describe("Accounting settlement authority", () => {
  afterEach(cleanup);
  beforeEach(() => {
    sessionStorage.clear();
    auth.role = "accounting_staff";
    auth.id = "accounting-1";
    auth.allowed = true;
    settle.mockClear();
    returnClearance.mockReset().mockImplementation(async (id: string) => ({
      version: 1 as const,
      liquidationId: id,
      packageVersion: 2,
      amount: 1500,
      received: true,
      approved: true,
      receivedBy: "accounting-1",
      approvedBy: "head-1",
      reference: "OR-100",
      canAcknowledge: false,
      canApprove: false,
    }));
  });
  it("asks Accounting to confirm receipt of returned cash in one step before settling", async () => {
    const data = bundle(true);
    data.liquidations[0].id = "liquidation-one-step-return";
    const changed = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountingSettlementQueue data={data} onChanged={changed} />,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /Confirm return & settle/ })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm return & settle/ }),
    );
    expect(settle).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Yes, I received the cash — settle",
        exact: true,
      }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(settle).toHaveBeenCalledWith(
      "liquidation-one-step-return",
      true,
      expect.any(String),
      expect.any(String),
    );
  });
  it("waits for Head authorization before settling a late package and explains it in the red Stop blockers modal", () => {
    render(<AccountingSettlementQueue data={bundle()} onChanged={vi.fn()} />);
    expect(
      screen
        .getByRole("button", { name: /Confirm return & settle/ })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    const stopBtn = screen.getByRole("button", {
      name: /View \d+ blockers?/i,
    });
    fireEvent.click(stopBtn);
    expect(screen.getByRole("dialog").textContent).toContain(
      "Waiting for Office Head approval",
    );
    expect(settle).not.toHaveBeenCalled();
  });
  it("enables Accounting settlement after Head authorizes the late package", async () => {
    const changed = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountingSettlementQueue data={bundle(true)} onChanged={changed} />,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /Confirm return & settle/ })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm return & settle/ }),
    );
    expect(settle).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Yes, I received the cash — settle",
        exact: true,
      }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(settle).toHaveBeenCalledWith(
      "liquidation-2",
      true,
      expect.any(String),
      expect.any(String),
    );
  });
  it.each(["head", "admin", "member"])(
    "prevents %s from executing accounting settlement even with a permission override",
    (role) => {
      auth.role = role;
      render(
        <AccountingSettlementQueue data={bundle(true)} onChanged={vi.fn()} />,
      );
      expect(
        screen
          .getByRole("button", { name: /Confirm return & settle/ })
          .getAttribute("aria-disabled"),
      ).toBe("true");
      expect(
        screen.getByRole("button", {
          name: /View \d+ blockers?/i,
        }),
      ).toBeTruthy();
    },
  );
  it("preserves independent settlement and explicit permission denial", () => {
    auth.id = "employee-1";
    const view = render(
      <AccountingSettlementQueue data={bundle(true)} onChanged={vi.fn()} />,
    );
    expect(
      screen
        .getByRole("button", { name: /Confirm return & settle/ })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    fireEvent.click(
      screen.getByRole("button", {
        name: /View \d+ blockers?/i,
      }),
    );
    expect(screen.getByRole("dialog").textContent).toContain(
      "Independent Financial Officer required",
    );
    fireEvent.keyDown(window, { key: "Escape" });

    auth.id = "accounting-1";
    auth.allowed = false;
    view.rerender(
      <AccountingSettlementQueue data={bundle(true)} onChanged={vi.fn()} />,
    );
    expect(
      screen
        .getByRole("button", { name: /Confirm return & settle/ })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });
  it("allows a corrected mapping rejection to retry without an uncertain-outcome lock", async () => {
    const data = bundle(true);
    data.liquidations[0].id = 'mapping-rejection-package';
    const changed = vi.fn().mockResolvedValue(undefined);
    const message = 'Map every purchased-item source to an active journal expense account before settlement';
    settle.mockRejectedValueOnce(new Error(message));
    render(<AccountingSettlementQueue data={data} onChanged={changed} />);
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: /Confirm return & settle/ })
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    fireEvent.click(screen.getByRole('button', { name: /Confirm return & settle/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I received the cash — settle', exact: true }));
    await screen.findByText('The settlement was not saved. ' + message + '.');
    expect(screen.queryByRole('button', { name: 'Verify settlement outcome' })).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /Confirm return & settle/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I received the cash — settle', exact: true }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(settle).toHaveBeenCalledTimes(2);
  });
});
