// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskCashBlockers } from "../../src/app/features/budget/selectors/taskCashClearance";
import { TaskCashClearancePanel } from "../../src/app/features/budget/components/TaskCashClearancePanel";
import { cashData } from "./taskCashClearance.fixtures";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  verify: vi.fn(),
  currentReview: vi.fn(),
  readDecision: vi.fn(),
  clearanceResult: vi.fn(),
  assertAcceptance: vi.fn(),
  toast: vi.fn(),
  topics: [] as string[],
}));
vi.mock("../../src/app/features/budget/services/taskCashClearanceService", () => ({ fetchTaskCashBlockers: mocks.fetch }));
vi.mock("../../src/app/services/taskService", () => ({ verifyTask: mocks.verify }));
vi.mock('../../src/app/features/reviews/services/taskReviewDecision', () => ({
  assertCurrentTaskReview: mocks.currentReview, readTaskReviewDecision: mocks.readDecision,
}));
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
  assertWorkAcceptanceAvailable: mocks.assertAcceptance,
  fetchWorkFinancialClearance: mocks.clearanceResult,
}));
import { ReviewDecisionForm } from "../../src/app/features/reviews/components/ReviewDecisionForm";

const reviewProps = (taskId: string) => ({
  task: { id: taskId, title: 'Task', status: 'for_review', createdAt: 1, updatedAt: 1 } as const,
  submission: { id: 'submission-' + taskId, taskId, version: 2, submitterId: 'worker',
    submitterName: 'Worker', note: 'Done', status: 'pending', submittedAt: 1 } as const,
});
const blockers = () => getTaskCashBlockers("task-1", cashData(), new Map([["budget-1", 2025]]));
const approvalError = new Error("Settle all task and subtask cash before approving this task");
const button = (name: string) => screen.getByRole("button", { name, exact: true }) as HTMLButtonElement;
const startApproval = async () => {
  await waitFor(() => expect(button("Approve work").disabled).toBe(false));
  fireEvent.click(button("Approve work"));
  fireEvent.click(button("Yes, approve"));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.topics.length = 0;
  mocks.fetch.mockReset().mockResolvedValue([]);
  mocks.verify.mockReset().mockResolvedValue(undefined);
  mocks.currentReview.mockReset().mockResolvedValue(undefined);
  mocks.readDecision.mockReset().mockResolvedValue('saved');
  mocks.clearanceResult.mockReset().mockResolvedValue({workAccepted:true,cashOutstanding:true,completed:false});
  mocks.assertAcceptance.mockReset().mockResolvedValue({
    version: 1,
    rootId: "task-1",
    nodeId: null,
    workAccepted: false,
    cashOutstanding: false,
    completed: false,
    canFinalize: false,
  });
});
afterEach(cleanup);

describe("cash-aware review decision", () => {
  it("explains why a Head-approved escalation is still open and links to that package", () => {
    const [blocker] = blockers();
    const open = vi.fn();
    render(<TaskCashClearancePanel blockers={[{ ...blocker, settlement: { eligibleSettlers: 0, headNotified: true, headApproved: true } }]}
      currentUserId="head-1" role="head" loading={false} error="" serverBlocked={false} onRefresh={vi.fn()} onOpenFinancialReview={open} />);
    expect(screen.getByText(/Head approved the escalation. No eligible independent Accounting Officer/)).toBeTruthy();
    expect(screen.getByText(/Accepting the work unlocks required receipts. Outstanding cash still blocks final completion./)).toBeTruthy();
    fireEvent.click(button("Open financial review for FR-00002"));
    expect(open).toHaveBeenCalledWith({ recordId: "liquidation-2", orgId: "org-1", fiscalYear: 2025, independentReview: true });
  });

  it("allows work acceptance while open cash remains, verifying the shared clearance contract first", async () => {
    const [blocker] = blockers();
    mocks.fetch.mockResolvedValue([{ ...blocker, settlement: { eligibleSettlers: 0, headNotified: true, headApproved: true } }]);
    const done = vi.fn();
    render(<ReviewDecisionForm {...reviewProps("task-1")} onDone={done} />);
    await screen.findByText(/Accepting the work unlocks required receipts/);
    await startApproval();
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(mocks.assertAcceptance).toHaveBeenCalledExactlyOnceWith("task-1");
    expect(mocks.verify).toHaveBeenCalledWith("task-1", true, undefined, expect.anything());
    expect(mocks.toast).toHaveBeenCalledWith(
      "Work accepted. Financial clearance pending.",
      "success",
    );
    expect(screen.getByText("FR-00002 · Awaiting final cash settlement")).toBeTruthy();
  });

  it('checks the exact selected submission and blocks a stale review before writing', async () => {
    mocks.currentReview.mockRejectedValueOnce(new Error('This submission or your review access changed.'));
    const props = reviewProps('task-1');
    render(<ReviewDecisionForm {...props} />);
    await startApproval();
    await screen.findByText(/This submission or your review access changed/);
    expect(mocks.currentReview).toHaveBeenCalledWith(props.task, props.submission, 'accounting-1', 'accounting_staff');
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('recognizes the selected decision after the original response is lost', async () => {
    mocks.verify.mockRejectedValueOnce(new Error('Connection lost'));
    mocks.readDecision.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue('saved');
    const done = vi.fn();
    render(<ReviewDecisionForm {...reviewProps('task-1')} onDone={done} />);
    await startApproval();
    fireEvent.click(await screen.findByRole('button', { name: 'Check current decision' }));
    await waitFor(() => expect(done).toHaveBeenCalledWith(true));
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.readDecision).toHaveBeenLastCalledWith('task-1', 'submission-task-1', 'accounting-1', true);
  });

  it("shows the exact blocker before approval and opens its receipt package in the correct fiscal year while permitting work acceptance", async () => {
    mocks.fetch.mockResolvedValue(blockers());
    const open = vi.fn();
    render(<ReviewDecisionForm {...reviewProps("task-1")} onOpenFinancialReview={open} />);
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    expect(screen.getByText("Task: New Tasks → Subtask: Order Food")).toBeTruthy();
    expect(screen.getByText("Accounting Staff")).toBeTruthy();
    expect(screen.getByText(/₱8,500.00 declared spent · ₱1,500.00 declared return/)).toBeTruthy();
    expect(screen.getByText(/Reviews → Budget → Receipt liquidations → FR-00002/)).toBeTruthy();
    expect(button("Approve work").disabled).toBe(false);
    expect(button("Request changes").disabled).toBe(false);
    fireEvent.click(button("Open financial review for FR-00002"));
    expect(open).toHaveBeenCalledWith({ recordId: "liquidation-2", orgId: "org-1", fiscalYear: 2025 });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("refreshes after settlement and permits the existing approval RPC", async () => {
    mocks.fetch.mockResolvedValueOnce(blockers()).mockResolvedValue([]);
    const done = vi.fn();
    render(<ReviewDecisionForm {...reviewProps("task-1")} onDone={done} />);
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    fireEvent.focus(window);
    await startApproval();
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(mocks.verify).toHaveBeenCalledWith("task-1", true, undefined, { id: "accounting-1", name: "Cheryl Gallo" });
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });

  it("keeps requesting work changes available while cash remains open", async () => {
    mocks.fetch.mockResolvedValue(blockers());
    render(<ReviewDecisionForm {...reviewProps("task-1")} />);
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    fireEvent.click(button("Request changes"));
    fireEvent.change(screen.getByRole("textbox", { name: "Required change feedback" }), { target: { value: "Please clarify the final evidence" } });
    fireEvent.click(button("Yes, request changes"));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith("task-1", false, "Please clarify the final evidence", expect.anything()));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("blocks work acceptance when the shared clearance contract cannot be verified", async () => {
    mocks.assertAcceptance.mockRejectedValueOnce(new Error("Financial clearance could not be verified. Refresh before continuing."));
    render(<ReviewDecisionForm {...reviewProps("task-1")} />);
    await startApproval();
    await screen.findByText(/Financial clearance could not be verified/);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("refreshes actionable details when the database catches a race after the preflight", async () => {
    mocks.fetch.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValue(blockers());
    mocks.verify.mockRejectedValue(approvalError);
    mocks.readDecision.mockResolvedValue('pending');
    const done = vi.fn();
    render(<ReviewDecisionForm {...reviewProps("task-1")} onDone={done} />);
    await startApproval();
    await screen.findByText("FR-00002 · Awaiting final cash settlement");
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(done).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalledWith(approvalError.message, "error");
  });

  it("does not claim clearance when RLS hides the server-reported blocker", async () => {
    mocks.verify.mockRejectedValue(approvalError);
    mocks.readDecision.mockResolvedValue('pending');
    render(<ReviewDecisionForm {...reviewProps("task-1")} />);
    await startApproval();
    await screen.findByText(/last approval attempt reported unresolved cash/);
    fireEvent.focus(window);
    await screen.findByText(/last approval attempt reported unresolved cash/);
    expect(screen.queryByText(/No open cash requests found/)).toBeNull();
  });

  it("shows a loading failure explicitly without inventing financial clearance or blocking rejection", async () => {
    mocks.fetch.mockRejectedValue(new Error("Budget read denied"));
    render(<ReviewDecisionForm {...reviewProps("task-1")} />);
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
    const view = render(<ReviewDecisionForm {...reviewProps("task-1")} />);
    view.rerender(<ReviewDecisionForm {...reviewProps("task-2")} />);
    await screen.findByText(/No open cash requests found/);
    await act(async () => { resolveOld(blockers()); });
    expect(screen.queryByText("FR-00002 · Awaiting final cash settlement")).toBeNull();
    expect(button("Approve work").disabled).toBe(false);
  });

  it("gives Strict Mode remounts independent realtime subscriptions", async () => {
    render(<StrictMode><ReviewDecisionForm {...reviewProps("task-1")} /></StrictMode>);
    await screen.findByText(/No open cash requests found/);
    expect(mocks.topics).toHaveLength(2);
    expect(new Set(mocks.topics).size).toBe(2);
  });
});
