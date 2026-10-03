// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskCashBlockers } from "../../src/app/features/budget/selectors/taskCashClearance";
import { cashData } from "./taskCashClearance.fixtures";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), verify: vi.fn(), toast: vi.fn(), topics: [] as string[] }));
vi.mock("../../src/app/features/budget/services/taskCashClearanceService", () => ({ fetchTaskCashBlockers: mocks.fetch }));
vi.mock("../../src/app/services/taskService", () => ({ verifyTask: mocks.verify }));
vi.mock("../../src/app/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "accounting-1" }, userProfile: { id: "accounting-1", full_name: "Cheryl Gallo", role: "accounting_staff" } }) }));
vi.mock("../../src/app/components/ui/Toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../../src/lib/supabase", () => ({ supabase: {
  channel: (topic: string) => {
    if (mocks.topics.includes(topic)) throw new Error("Cannot reuse subscribed channel");
    mocks.topics.push(topic);
    const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
    return channel;
  },
  removeChannel: vi.fn(() => new Promise(() => undefined)),
} }));
vi.mock("../../src/app/features/budget", async () => ({
  ...await import("../../src/app/features/budget/hooks/useTaskCashClearance"),
  ...await import("../../src/app/features/budget/components/TaskCashClearancePanel"),
  ...await import("../../src/app/features/budget/selectors/taskCashClearance"),
}));
import { ReviewDecisionForm } from "../../src/app/features/reviews/components/ReviewDecisionForm";

const blockers = () => getTaskCashBlockers("task-1", cashData(), new Map([["budget-1", 2025]]));
const approvalError = new Error("Settle all task and subtask cash before approving this task");
const button = (name: string) => screen.getByRole("button", { name, exact: true }) as HTMLButtonElement;
const startApproval = async () => {
  await waitFor(() => expect(button("Approve").disabled).toBe(false));
  fireEvent.click(button("Approve"));
  fireEvent.click(button("Confirm approval"));
};

beforeEach(() => { vi.clearAllMocks(); mocks.topics.length = 0; mocks.fetch.mockReset().mockResolvedValue([]); mocks.verify.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

describe("cash-aware review decision", () => {
  it("shows the exact blocker before approval and opens its receipt package in the correct fiscal year", async () => {
    mocks.fetch.mockResolvedValue(blockers());
    const open = vi.fn();
    render(<ReviewDecisionForm taskId="task-1" onOpenFinancialReview={open} />);
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    expect(screen.getByText("Task: New Tasks → Subtask: Order Food")).toBeTruthy();
    expect(screen.getByText("Accounting Staff")).toBeTruthy();
    expect(screen.getByText(/₱8,500.00 declared spent · ₱1,500.00 declared return/)).toBeTruthy();
    expect(screen.getByText(/Reviews → Budget → Receipt liquidations → FR-00002/)).toBeTruthy();
    expect(button("Approve").disabled).toBe(true);
    expect(button("Request changes").disabled).toBe(false);
    fireEvent.click(button("Open financial review for FR-00002"));
    expect(open).toHaveBeenCalledWith({ recordId: "liquidation-2", orgId: "org-1", fiscalYear: 2025 });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("refreshes after settlement and permits the existing approval RPC", async () => {
    mocks.fetch.mockResolvedValueOnce(blockers()).mockResolvedValue([]);
    const done = vi.fn();
    render(<ReviewDecisionForm taskId="task-1" onDone={done} />);
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    fireEvent.click(button("Refresh cash status"));
    await startApproval();
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(mocks.verify).toHaveBeenCalledWith("task-1", true, undefined, { id: "accounting-1", name: "Cheryl Gallo" });
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });

  it("keeps requesting work changes available while cash remains open", async () => {
    mocks.fetch.mockResolvedValue(blockers());
    render(<ReviewDecisionForm taskId="task-1" />);
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    fireEvent.click(button("Request changes"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Please clarify the final evidence" } });
    fireEvent.click(button("Send back for changes"));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith("task-1", false, "Please clarify the final evidence", expect.anything()));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("catches a new request at confirmation before calling approval", async () => {
    mocks.fetch.mockResolvedValueOnce([]).mockResolvedValue(blockers());
    render(<ReviewDecisionForm taskId="task-1" />);
    await startApproval();
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(button("Confirm approval").disabled).toBe(true);
  });

  it("refreshes actionable details when the database catches a race after the preflight", async () => {
    mocks.fetch.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValue(blockers());
    mocks.verify.mockRejectedValue(approvalError);
    const done = vi.fn();
    render(<ReviewDecisionForm taskId="task-1" onDone={done} />);
    await startApproval();
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(done).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalledWith(approvalError.message, "error");
  });

  it("does not claim clearance when RLS hides the server-reported blocker", async () => {
    mocks.verify.mockRejectedValue(approvalError);
    render(<ReviewDecisionForm taskId="task-1" />);
    await startApproval();
    await screen.findByText(/last approval attempt reported unresolved cash/);
    await waitFor(() => expect(button("Refresh cash status").disabled).toBe(false));
    fireEvent.click(button("Refresh cash status"));
    await screen.findByText(/last approval attempt reported unresolved cash/);
    expect(screen.queryByText(/No open cash requests found/)).toBeNull();
  });

  it("shows a loading failure explicitly without inventing financial clearance or blocking rejection", async () => {
    mocks.fetch.mockRejectedValue(new Error("Budget read denied"));
    render(<ReviewDecisionForm taskId="task-1" />);
    await screen.findByText(/Budget read denied/);
    expect(screen.queryByText(/No open cash requests found/)).toBeNull();
    expect(button("Request changes").disabled).toBe(false);
    // The database still gets the final say if diagnostic reads are unavailable.
    await startApproval();
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledOnce());
  });

  it("discards stale task responses when switching review selection", async () => {
    let resolveOld!: (value: ReturnType<typeof blockers>) => void;
    mocks.fetch.mockImplementation((id: string) => id === "task-1" ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve([]));
    const view = render(<ReviewDecisionForm taskId="task-1" />);
    view.rerender(<ReviewDecisionForm taskId="task-2" />);
    await screen.findByText(/No open cash requests found/);
    await act(async () => { resolveOld(blockers()); });
    expect(screen.queryByText("FR-00002 · Awaiting final cash settlement")).toBeNull();
    expect(button("Approve").disabled).toBe(false);
  });

  it("gives Strict Mode remounts independent realtime subscriptions", async () => {
    render(<StrictMode><ReviewDecisionForm taskId="task-1" /></StrictMode>);
    await screen.findByText(/No open cash requests found/);
    expect(mocks.topics).toHaveLength(2);
    expect(new Set(mocks.topics).size).toBe(2);
  });
});
