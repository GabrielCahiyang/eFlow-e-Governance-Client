// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BudgetLedgerEntry, DepartmentBudgetBundle } from "../../src/app/features/budget/types";

vi.mock("@vibe/core", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
  }) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { AuditEventDetails } from "../../src/app/features/budget/components/AuditEventDetails";

afterEach(cleanup);

describe("AuditEventDetails", () => {
  it("resolves project and budget account names and omits UUID/placeholder noise", () => {
    const projectId = "8cbeb9a5-48b8-48db-876c-e90da136bdd8";
    const partitionId = "fa594b3b-1592-43b6-9a16-75c7e0590152";
    const bundle = {
      commitments: [
        {
          id: "c1",
          proposalDraftId: "prop-1",
          title: "Project: Barangay Digital Records Management Initiative",
          amount: 40000,
          status: "active",
        },
      ],
      sections: [
        {
          id: partitionId,
          name: "MOOE",
          accountCode: "5-02-532",
          amount: 100000,
          heldAmount: 0,
          position: 0,
        },
      ],
      requests: [],
      allocations: [],
      releases: [],
      liquidations: [],
      lines: [],
      allocationLines: [],
      requestAttachments: [],
      ledger: [],
      adjustments: [],
      summary: null,
    } as unknown as DepartmentBudgetBundle;

    const entry: BudgetLedgerEntry = {
      id: "e1",
      entryType: "proposal_committed",
      description: "Project funding reserved: Barangay Digital Records Management Initiative",
      amount: 40000,
      reason: "Approved FY 2026 plan",
      actorId: "4526a77a-1111-2222-3333-444455556666",
      createdAt: Date.now(),
      metadata: { projectId, partitionId },
    };

    render(
      <AuditEventDetails
        entry={entry}
        bundle={bundle}
        projectNames={{ [projectId]: "Barangay Digital Records Management Initiative" }}
        linkedJournal={[]}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Barangay Digital Records Management Initiative")).toBeVisible();
    expect(screen.getByText("MOOE (5-02-532)")).toBeVisible();
    expect(screen.getByText("₱40,000.00")).toBeVisible();
    expect(screen.queryByText(/8cbeb9a5/)).toBeNull();
    expect(screen.queryByText(/fa594b3b/)).toBeNull();
    expect(screen.queryByText(/4526a77a/)).toBeNull();
    expect(screen.queryByText("No state transition")).toBeNull();
    expect(screen.queryByText("Not supplied")).toBeNull();
  });
});
