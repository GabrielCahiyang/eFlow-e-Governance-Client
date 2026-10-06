// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ showPicker: vi.fn() }));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({ userProfile: { id: "accountant-1", org_id: "org-1", role: "accounting_staff" }, can: () => true }),
}));
vi.mock("../../src/app/features/budget/hooks/useGeneralJournal", () => ({
  useGeneralJournal: () => ({
    entries: [],
    accounts: [
      { code: "101", title: "Cash", classification: "asset", normalBalance: "debit" },
      { code: "201", title: "Payable", classification: "liability", normalBalance: "credit" },
    ],
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  postGeneralJournalAdjustment: vi.fn(),
}));

import { GeneralJournalWorkspace } from "../../src/app/features/budget/components/GeneralJournalWorkspace";

beforeEach(() => {
  mocks.showPicker.mockReset();
  Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
    configurable: true,
    value: mocks.showPicker,
  });
});
afterEach(cleanup);

describe("General Journal calendar controls", () => {
  it("opens the native picker from both the header and adjustment view", () => {
    render(<GeneralJournalWorkspace orgId="org-1" fiscalYear={2026} fiscalBudgetId="budget-1" />);
    fireEvent.click(screen.getByLabelText("Journal start date"));
    fireEvent.click(screen.getByRole("button", { name: /Post adjustment/i }));
    fireEvent.click(screen.getByLabelText("Entry date"));
    expect(mocks.showPicker).toHaveBeenCalledTimes(2);
  });
});
