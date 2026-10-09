// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/app/features/tasks";
import type { DepartmentBudgetBundle, TaskFundingContext } from "../../src/app/features/budget/types";

const state = vi.hoisted(() => ({
  user: { id: "head", role: "head", org_id: "task-office", is_active: true },
  context: null as TaskFundingContext | null,
  budgetCalls: vi.fn(), refresh: vi.fn(),
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({ useAuth: () => ({ userProfile: state.user }) }));
vi.mock("../../src/app/shared/useReviewedMutation", () => ({ useReviewedMutation: () => ({ pending: false, dialog: null, message: "", run: vi.fn() }) }));
vi.mock("../../src/app/features/budget/hooks/useDepartmentBudget", () => ({
  useDepartmentBudget: (office: string, year: number) => {
    state.budgetCalls(office, year);
    return { summary: { id: "budget", status: "locked" }, allocations: [], requests: [], loading: false, refresh: state.refresh };
  },
}));
vi.mock("../../src/app/features/budget/hooks/useTaskFundingContext", () => ({ useTaskFundingContext: () => ({ context: state.context, loading: false, refresh: state.refresh }) }));
vi.mock("../../src/app/features/budget/components/DirectWorkFunding", () => ({ DirectWorkFunding: () => <button>Authorize work funding</button> }));
vi.mock("../../src/app/features/budget/components/CashRequestForm", () => ({ CashRequestForm: ({ orgId }: { orgId: string }) => <div data-testid="request-upload-office">{orgId}</div> }));
vi.mock("../../src/app/features/budget/components/CashRequestTimeline", () => ({ CashRequestTimeline: ({ orgId }: { orgId: string }) => <div data-testid="receipt-upload-office">{orgId}</div> }));
import { WorkBudgetCard } from "../../src/app/features/budget/components/WorkBudgetCard";
import { isOpenDirectFundingWork } from "../../src/app/features/budget/selectors/directFundingEligibility";

const task = { id: "task", title: "Workshop", orgId: "task-office", assigneeId: "head", status: "in_progress" } as Task;
beforeEach(() => {
  state.context = { funded: false, taskId: task.id, taskBudget: 0, available: 0, lines: [] };
  state.user = { id: "head", role: "head", org_id: "task-office", is_active: true };
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("work funding merge boundaries", () => {
  it("keeps oversight funding read-only when the inspector withholds management capability", () => {
    render(<WorkBudgetCard task={task} canManage={false} />);
    expect(screen.queryByRole("button", { name: "Authorize work funding" })).toBeNull();
  });
  it("keeps direct funding available to an authorized active Office Head managing open work", () => {
    render(<WorkBudgetCard task={task} canManage />);
    expect(screen.getByRole("button", { name: "Authorize work funding" })).toBeTruthy();
  });
  it.each([
    { status: "completed" }, { status: "cancelled" },
    { archivedAt: 1 }, { proposedOfficeIdentityId: "unresolved-office" },
  ])("withholds direct funding for closed or unresolved work %j", patch => {
    const closed = { ...task, ...patch } as Task;
    expect(isOpenDirectFundingWork(closed)).toBe(false);
    render(<WorkBudgetCard task={closed} canManage />);
    expect(screen.queryByRole("button", { name: "Authorize work funding" })).toBeNull();
  });
  it.each([{ is_active: false }, { org_id: "other-office" }])("withholds direct funding for an inactive or different Office Head %j", patch => {
    state.user = { ...state.user, ...patch };
    render(<WorkBudgetCard task={task} canManage />);
    expect(screen.queryByRole("button", { name: "Authorize work funding" })).toBeNull();
  });
  it("uses the actual funding Office and fiscal year for cash evidence and receipts", async () => {
    state.context = { funded: true, fundingOrgId: "funding-office", fiscalYear: 2025, taskId: task.id, taskBudget: 1000, available: 500, taskLeaderId: "head", lines: [] };
    render(<WorkBudgetCard task={task} canManage />);
    await waitFor(() => expect(state.budgetCalls).toHaveBeenLastCalledWith("funding-office", 2025));
    expect(screen.getByTestId("receipt-upload-office").textContent).toBe("funding-office");
    fireEvent.click(screen.getByRole("button", { name: "Request cash" }));
    expect(screen.getByTestId("request-upload-office").textContent).toBe("funding-office");
  });
  it("removes closed work from the direct-funding selector without issuing an authorization", async () => {
    const { DirectWorkFunding } = await vi.importActual<typeof import("../../src/app/features/budget/components/DirectWorkFunding")>("../../src/app/features/budget/components/DirectWorkFunding");
    render(<DirectWorkFunding data={{ summary: { id: "budget", status: "locked" }, sectionsAvailable: true, sections: [], allocations: [] } as unknown as DepartmentBudgetBundle} tasks={[task, { ...task, id: "closed", title: "Closed", status: "completed" }, { ...task, id: "archived", title: "Archived", archivedAt: 1 }]} onChanged={state.refresh} />);
    expect(screen.getByRole("option", { name: "Workshop" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Closed" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Archived" })).toBeNull();
    expect(state.refresh).not.toHaveBeenCalled();
  });
});
