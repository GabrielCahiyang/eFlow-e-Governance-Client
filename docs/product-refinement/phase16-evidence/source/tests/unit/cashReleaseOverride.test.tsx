// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DepartmentBudgetBundle, PettyCashRelease } from "../../src/app/features/budget/types";
import { cashData, cashRequest } from "./taskCashClearance.fixtures";

const mocks = vi.hoisted(() => ({ role: "accounting_staff", release: vi.fn(), override: vi.fn(), acknowledge: vi.fn() }));
vi.mock("../../src/app/contexts/AuthContext", () => ({ useAuth: () => ({ userProfile: { id: "accounting-1", role: mocks.role }, can: () => mocks.role === "accounting_staff" }) }));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({ markPettyCashReleased: mocks.release, overridePettyCashReleaseSchedule: mocks.override, acknowledgePettyCashRelease: mocks.acknowledge }));
import { BudgetReleasesPanel } from "../../src/app/features/budget/components/BudgetReleasesPanel";

const release: PettyCashRelease = { id: "release-6", requestId: "request-1", orgId: "org-1", scheduledDate: "2026-08-31", amount: 5000, status: "scheduled", recipientId: "employee-1", createdAt: 1 };
function bundle(): DepartmentBudgetBundle {
  return { ...cashData([cashRequest({ requestNumber: 6, cashRecipientName: "Gabriel Cahiyang", status: "scheduled_for_release", releasedAmount: 0 })]), releases: [release], summary: { dailyPettyCashReleaseLimit: 30000 } as DepartmentBudgetBundle["summary"], lines: [], commitments: [], allocations: [], ledger: [], adjustments: [], requestAttachments: [] };
}
const clickOverride = () => fireEvent.click(screen.getByRole("button", { name: "Override schedule" }));
const confirm = () => screen.getByRole("button", { name: "Confirm override & release" }) as HTMLButtonElement;
let testSequence = 0;
beforeEach(() => { release.id = `release-${++testSequence}`; vi.clearAllMocks(); mocks.role = "accounting_staff"; mocks.override.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

describe("schedule override confirmation", () => {
  it("opens details without making a financial call and cancels safely", () => {
    render(<BudgetReleasesPanel data={bundle()} onChanged={vi.fn()} />);
    clickOverride();
    const dialog = screen.getByRole("dialog", { name: "Confirm schedule override?" });
    expect(within(dialog).getByText("PC-00006 · ₱5,000.00")).toBeTruthy();
    expect(within(dialog).getByText("Recipient: Gabriel Cahiyang")).toBeTruthy();
    expect(within(dialog).getByText("Original schedule: 2026-08-31")).toBeTruthy();
    expect(confirm().disabled).toBe(true);
    expect(mocks.override).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.override).not.toHaveBeenCalled();
  });

  it("requires a reason and releases only the selected tranche after confirmation", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<BudgetReleasesPanel data={bundle()} onChanged={refresh} />);
    clickOverride();
    fireEvent.change(screen.getByLabelText("Override reason"), { target: { value: "urgent" } });
    expect(confirm().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Override reason"), { target: { value: "  Supplier requires payment today  " } });
    expect(mocks.override).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(mocks.override).toHaveBeenCalledExactlyOnceWith(release.id, "Supplier requires payment today");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the popup open with the server ceiling error and preserves the reason", async () => {
    mocks.override.mockRejectedValue(new Error("Daily release ceiling exceeded"));
    render(<BudgetReleasesPanel data={bundle()} onChanged={vi.fn()} />);
    clickOverride();
    fireEvent.change(screen.getByLabelText("Override reason"), { target: { value: "Supplier needs payment today" } });
    fireEvent.click(confirm());
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("Daily release ceiling exceeded");
    expect((screen.getByLabelText("Override reason") as HTMLTextAreaElement).value).toBe("Supplier needs payment today");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("prevents double confirmation and dismissal while the request is pending", async () => {
    let finish!: () => void;
    mocks.override.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<BudgetReleasesPanel data={bundle()} onChanged={vi.fn()} />);
    clickOverride();
    fireEvent.change(screen.getByLabelText("Override reason"), { target: { value: "Supplier needs payment today" } });
    fireEvent.click(confirm()); fireEvent.click(confirm());
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.override).toHaveBeenCalledOnce();
    await act(async () => finish());
  });

  it("does not retry a committed release when only the list refresh fails", async () => {
    render(<BudgetReleasesPanel data={bundle()} onChanged={vi.fn().mockRejectedValue(new Error("offline"))} />);
    clickOverride();
    fireEvent.change(screen.getByLabelText("Override reason"), { target: { value: "Supplier needs payment today" } });
    fireEvent.click(confirm());
    await screen.findByText(/Cash was recorded as released, but the list could not refresh/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.override).toHaveBeenCalledOnce();
  });

  it("retains the normal release path and hides release controls from employees", async () => {
    const view = render(<BudgetReleasesPanel data={bundle()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark released" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm & Record Release/i }));
    await waitFor(() => expect(mocks.release).toHaveBeenCalledWith(release.id, {method:"cash",chequeNumber:""}));
    expect(mocks.override).not.toHaveBeenCalled();
    mocks.role = "member";
    view.rerender(<BudgetReleasesPanel data={bundle()} onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Override schedule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark released" })).toBeNull();
  });

  it("lets Accounting Staff issue cheques and use audited schedule overrides", async () => {
    mocks.role = "accounting_staff";
    render(<BudgetReleasesPanel data={bundle()} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Override schedule" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark released" }));
    fireEvent.change(screen.getByLabelText("Release method"), { target: { value: "cheque" } });
    fireEvent.change(screen.getByLabelText("Cheque number"), { target: { value: "CHK-2026-0919" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm & Record Release/i }));
    await waitFor(() => expect(mocks.release).toHaveBeenCalledWith(release.id, { method: "cheque", chequeNumber: "CHK-2026-0919" }));
  });
});
