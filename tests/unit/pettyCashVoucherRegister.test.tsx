// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DepartmentBudgetBundle } from "../../src/app/features/budget/types";

vi.mock("@vibe/core", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

import { PettyCashVoucherRegister } from "../../src/app/features/budget/components/PettyCashVoucherRegister";

afterEach(cleanup);

const bundle: DepartmentBudgetBundle = {
  summary: {
    id: "b1",
    orgId: "org1",
    fiscalYear: 2026,
    status: "locked",
  } as DepartmentBudgetBundle["summary"],
  sections: [],
  lines: [],
  commitments: [],
  allocations: [],
  allocationLines: [],
  requests: [
    {
      id: "req-1",
      requestNumber: 9,
      pcvNumber: 3,
      pcvDate: "2026-11-15",
      status: "settled",
      purpose: "Stakeholder survey supplies",
      cashRecipientName: "Andres Manili",
      requestedAmount: 600,
    } as DepartmentBudgetBundle["requests"][number],
  ],
  requestAttachments: [],
  releases: [],
  liquidations: [
    {
      id: "liq-1",
      requestId: "req-1",
      version: 1,
      status: "approved",
      declaredSpent: 500,
      returnedAmount: 100,
      receipts: [
        {
          id: "rec-1",
          liquidationId: "liq-1",
          vendor: "National Book Store",
          receiptNumber: "OR-2026-1115-FR9",
          receiptDate: "2026-11-15",
          description: "Supplies",
          amount: 500,
          fileName: "r.jpg",
          filePath: "r.jpg",
          mimeType: "image/jpeg",
          fileSize: 100,
          items: [
            {
              id: "item-1",
              quantity: 1,
              unit: "pcs.",
              particular: "Printed questionnaires",
              amount: 500,
              purpose: "Survey supplies",
              accountName: "Maintenance",
              accountLabel: "23-1343-5",
            } as NonNullable<DepartmentBudgetBundle["liquidations"][number]["receipts"][number]["items"]>[number],
          ],
        },
      ],
    } as DepartmentBudgetBundle["liquidations"][number],
  ],
  ledger: [],
  adjustments: [],
};

describe("PettyCashVoucherRegister", () => {
  it("renders structured voucher cards with formatted returned cash instead of blank spreadsheet rows", () => {
    render(<PettyCashVoucherRegister data={bundle} />);
    expect(screen.getByText("PCV 03")).toBeVisible();
    expect(screen.getByText("Stakeholder survey supplies")).toBeVisible();
    expect(screen.getByText("National Book Store")).toBeVisible();
    expect(screen.getByText("OR-2026-1115-FR9")).toBeVisible();
    expect(screen.getByText("₱100.00")).toBeVisible();
    expect(screen.queryByText(/TOTAL PCV/)).toBeNull();
  });
});
