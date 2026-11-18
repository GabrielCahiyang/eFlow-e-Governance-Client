// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subitemStartBlocker } from "../../src/app/features/subtasks/selectors/subitemStart";
import type { WorkNode, WorkTreeSnapshot } from "../../src/app/features/nested-work";
import { pendingActionKey, writePendingAction } from '../../src/app/shared/pendingActionStore';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  session: vi.fn(),
  submitLiquidation: vi.fn(),
  findLiquidation: vi.fn(),
  toast: vi.fn(),
  actor: "user-1",
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getSession: mocks.session,
    },
  },
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: mocks.actor },
    userProfile: { id: mocks.actor, full_name: "Test Actor", role: "head" },
  }),
}));
vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("../../src/app/shared/workChanges", () => ({
  subscribeWorkChanges: () => () => {},
}));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  submitPettyCashLiquidation: mocks.submitLiquidation,
  findSavedLiquidation: mocks.findLiquidation,
}));

import {
  fetchCashReturnClearance,
  fetchReceiptSubmissionClearance,
  fetchWorkFinancialClearance,
  verifySavedCompletion,
  verifySavedReturn,
  writeSavedClearanceRequest,
} from "../../src/app/features/budget/services/workFinancialClearanceService";
import { WorkFinancialClearancePanel } from "../../src/app/features/budget/components/WorkFinancialClearancePanel";
import { CashReturnPanel } from "../../src/app/features/budget/components/CashReturnPanel";
import { CashLiquidationDialog } from "../../src/app/features/budget/components/CashLiquidationDialog";
import { cashRequest } from "./taskCashClearance.fixtures";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.actor = "user-1";
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: "user-1" } } },
    error: null,
  });
});
afterEach(cleanup);

describe("date-neutral subtask Start blocker", () => {
  const baseNode: WorkNode = {
    id: "sub-1",
    task_id: "root-1",
    parent_subtask_id: null,
    lead_id: "lead-1",
    title: "Survey site",
    assigned_to_ids: ["lead-1"],
    depth: 1,
    sibling_order: 0,
    due_date: "2026-12-10",
    start_date: "2099-01-01",
    started_at: null,
    is_standalone: true,
    status: "todo",
    percent_complete: 0,
    can_manage: false,
    can_appoint: false,
    can_order: false,
    can_work: true,
    can_review: false,
  };
  const baseTree: WorkTreeSnapshot = {
    root: {
      id: "root-1",
      project: "proj-1",
      office: "org-1",
      kind: "office",
      open: true,
      lead: "task-lead",
      people: ["task-lead", "lead-1"],
      due: "2026-12-31",
      status: "in_progress",
      project_status: "active",
      scheduling: { version: 1, today: "2026-11-18" },
    },
    revision: 1,
    can_manage: false,
    can_transfer: false,
    nodes: [baseNode],
    people: [],
    leaf_total: 1,
    leaf_completed: 0,
  };

  it("allows starting before, on, or without a planned start date when parent and prerequisites are ready", () => {
    expect(subitemStartBlocker(baseTree, baseNode, "lead-1", false, false)).toBeNull();
    expect(
      subitemStartBlocker(
        baseTree,
        { ...baseNode, start_date: undefined },
        "lead-1",
        false,
        false,
      ),
    ).toBeNull();
  });

  it("retains lead, parent-task, and prerequisite gates", () => {
    expect(subitemStartBlocker(baseTree, baseNode, "other-user", false, false)).toContain(
      "appointed subtask lead",
    );
    expect(
      subitemStartBlocker(
        { ...baseTree, root: { ...baseTree.root, status: "todo" } },
        baseNode,
        "lead-1",
        false,
        false,
      ),
    ).toContain("Start the parent task");
    expect(
      subitemStartBlocker(
        baseTree,
        { ...baseNode, dependency_ids: null },
        "lead-1",
        false,
        false,
        "Earlier Step",
      ),
    ).toContain("Complete “Earlier Step” first.");
  });
});

describe("workFinancialClearanceService validators", () => {
  it("validates exact RPC responses and rejects mismatched scopes", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        version: 1,
        rootId: "root-1",
        nodeId: null,
        workAccepted: true,
        cashOutstanding: false,
        completed: false,
        canFinalize: true,
      },
      error: null,
    });
    await expect(fetchWorkFinancialClearance("root-1")).resolves.toMatchObject({
      workAccepted: true,
      canFinalize: true,
    });

    mocks.rpc.mockResolvedValueOnce({
      data: {
        version: 1,
        rootId: "wrong-root",
        nodeId: null,
        workAccepted: true,
        cashOutstanding: false,
        completed: false,
        canFinalize: true,
      },
      error: null,
    });
    await expect(fetchWorkFinancialClearance("root-1")).rejects.toThrow(
      "Financial clearance could not be verified",
    );

    mocks.rpc.mockResolvedValueOnce({
      data: {
        version: 1,
        requestId: "req-1",
        workAccepted: true,
        canSubmit: true,
      },
      error: null,
    });
    await expect(fetchReceiptSubmissionClearance("req-1")).resolves.toMatchObject({
      canSubmit: true,
    });

    mocks.rpc.mockResolvedValueOnce({
      data: {
        version: 1,
        liquidationId: "liq-1",
        packageVersion: 2,
        amount: 500,
        received: true,
        approved: false,
        receivedBy: "acc-1",
        approvedBy: null,
        reference: "OR-99",
        canAcknowledge: false,
        canApprove: true,
      },
      error: null,
    });
    await expect(fetchCashReturnClearance("liq-1")).resolves.toMatchObject({
      received: true,
      canApprove: true,
    });
  });

  it("verifies saved return and completion commands and rejects tampered terms", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(
      verifySavedCompletion(
        { id, args: { p_root: "root-1", p_node: null } },
        "root-1",
      ),
    ).toEqual({ id, args: { p_root: "root-1", p_node: null } });
    expect(() =>
      verifySavedCompletion(
        { id, args: { p_root: "other-root", p_node: null } },
        "root-1",
      ),
    ).toThrow("saved completion could not be verified");

    expect(
      verifySavedReturn(
        {
          id,
          args: {
            p_liquidation: "liq-1",
            p_version: 2,
            p_action: "acknowledge",
            p_amount: 500,
            p_reference: "OR-123",
            p_key: id,
          },
        },
        "liq-1",
        2,
        500,
      ),
    ).toBeTruthy();
    expect(() =>
      verifySavedReturn(
        {
          id,
          args: {
            p_liquidation: "liq-1",
            p_version: 2,
            p_action: "acknowledge",
            p_amount: 400,
            p_reference: "OR-123",
            p_key: id,
          },
        },
        "liq-1",
        2,
        500,
      ),
    ).toThrow("saved cash-return action could not be verified");
  });
});

describe("WorkFinancialClearancePanel & CashReturnPanel & CashLiquidationDialog", () => {
  it("shows accepted-work status and finalizes cleared work after confirmation", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "work_financial_clearance") {
        return {
          data: {
            version: 1,
            rootId: "root-1",
            nodeId: null,
            workAccepted: true,
            cashOutstanding: false,
            completed: false,
            canFinalize: true,
          },
          error: null,
        };
      }
      if (name === "finalize_cleared_work") {
        return {
          data: {
            version: 1,
            rootId: "root-1",
            nodeId: null,
            workAccepted: true,
            cashOutstanding: false,
            completed: true,
            canFinalize: false,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const onSaved = vi.fn();
    render(<WorkFinancialClearancePanel root="root-1" onSaved={onSaved} />);
    await screen.findByText(/Work accepted and financial clearance confirmed/);
    fireEvent.click(screen.getByRole("button", { name: "Mark as complete" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Mark this work complete?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as complete" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("finalize_cleared_work", {
      p_root: "root-1",
      p_node: null,
    });
    expect(mocks.toast).toHaveBeenCalledWith("Work completed.", "success");
  });

  it("records Accounting acknowledgment and Office Head return approval with stable keys", async () => {
    let stage: "initial" | "acknowledged" | "approved" = "initial";
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "cash_return_clearance") {
        return {
          data: {
            version: 1,
            liquidationId: "liq-1",
            packageVersion: 2,
            amount: 1500,
            received: stage !== "initial",
            approved: stage === "approved",
            receivedBy: stage !== "initial" ? "acc-1" : null,
            approvedBy: stage === "approved" ? "head-1" : null,
            reference: stage !== "initial" ? "OR-555" : null,
            canAcknowledge: stage === "initial",
            canApprove: stage === "acknowledged",
          },
          error: null,
        };
      }
      if (name === "record_cash_return") {
        stage = args.p_action === "acknowledge" ? "acknowledged" : "approved";
        return {
          data: {
            version: 1,
            liquidationId: "liq-1",
            packageVersion: 2,
            amount: 1500,
            received: true,
            approved: stage === "approved",
            receivedBy: "acc-1",
            approvedBy: stage === "approved" ? "head-1" : null,
            reference: "OR-555",
            canAcknowledge: false,
            canApprove: stage === "acknowledged",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(
      <CashReturnPanel
        liquidationId="liq-1"
        rootId="root-1"
        version={2}
        amount={1500}
        onSaved={onSaved}
      />,
    );

    await screen.findByText(/Accounting must acknowledge the actual cash received/);
    fireEvent.change(screen.getByLabelText(/Receiving reference/), {
      target: { value: "OR-555" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge cash received" }));
    const ackDialog = await screen.findByRole("alertdialog", {
      name: "Acknowledge cash received?",
    });
    fireEvent.click(within(ackDialog).getByRole("button", { name: "Acknowledge receipt" }));

    await screen.findByText(/Cash received by Accounting — awaiting Office Head approval/);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_cash_return",
      expect.objectContaining({
        p_liquidation: "liq-1",
        p_version: 2,
        p_action: "acknowledge",
        p_amount: 1500,
        p_reference: "OR-555",
      }),
    );

    fireEvent.change(screen.getByLabelText(/Return approval note/), {
      target: { value: "Verified OR-555 cash return" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve cash return" }));
    const approveDialog = await screen.findByRole("alertdialog", {
      name: "Approve this cash return?",
    });
    fireEvent.click(within(approveDialog).getByRole("button", { name: "Approve return" }));

    await screen.findByText(/Return approved by the Office Head/);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_cash_return",
      expect.objectContaining({
        p_liquidation: "liq-1",
        p_version: 2,
        p_action: "approve",
        p_amount: 1500,
        p_reference: "Verified OR-555 cash return",
      }),
    );
  });

  it("recovers a saved completion request without prompting for a new confirmation", async () => {
    const savedId = "11111111-2222-3333-4444-555555555555";
    writeSavedClearanceRequest("user-1", "finalize-clearance:root-1:task", {
      id: savedId,
      args: { p_root: "root-1", p_node: null },
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "work_financial_clearance") {
        return {
          data: {
            version: 1,
            rootId: "root-1",
            nodeId: null,
            workAccepted: true,
            cashOutstanding: false,
            completed: true,
            canFinalize: false,
          },
          error: null,
        };
      }
      if (name === "finalize_cleared_work") {
        return {
          data: {
            version: 1,
            rootId: "root-1",
            nodeId: null,
            workAccepted: true,
            cashOutstanding: false,
            completed: true,
            canFinalize: false,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const onSaved = vi.fn();
    render(<WorkFinancialClearancePanel root="root-1" onSaved={onSaved} />);
    const retryBtn = await screen.findByRole("button", {
      name: "Check saved completion",
    });
    fireEvent.click(retryBtn);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("finalize_cleared_work", {
      p_root: "root-1",
      p_node: null,
    });
  });

  it("gates CashLiquidationDialog inputs and submission on receipt_submission_clearance", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        version: 1,
        requestId: "request-1",
        workAccepted: false,
        canSubmit: false,
      },
      error: null,
    });

    render(
      <CashLiquidationDialog
        request={cashRequest({ status: "released" })}
        orgId="org-1"
        perReceiptLimit={50000}
        liquidationDueDays={15}
        allowReceiptOverride={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await screen.findByText("Receipts become available after the work is accepted.");
    expect(
      (screen.getByLabelText("Vendor / payee") as HTMLInputElement).disabled,
    ).toBe(true);
    const submitBtn = screen.getByRole("button", { name: /Submit liquidation/ }) as HTMLButtonElement;
    expect(
      submitBtn.disabled || submitBtn.getAttribute("aria-disabled") === "true",
    ).toBe(true);
    expect(mocks.submitLiquidation).not.toHaveBeenCalled();
  });

  it('recovers a saved receipt package after the request is no longer eligible to submit', async () => {
    const key = '4c27cd2d-0b5b-4d58-a04e-609a828c87c7';
    const attempt = { actor:'user-1', orgId:'org-1', requestId:'request-1', spent:0, note:'Return', receipts:[], idempotencyKey:key };
    await writePendingAction(pendingActionKey('user-1','cash-liquidation','org-1','request-1'), attempt);
    mocks.findLiquidation.mockResolvedValueOnce('564726bc-348a-48f1-ac1c-4217c7f63039');
    mocks.rpc.mockResolvedValue({ data:{ version:1, requestId:'request-1', workAccepted:true, canSubmit:false }, error:null });
    const onSaved = vi.fn();
    render(<CashLiquidationDialog request={cashRequest({status:'pending_department_settlement'})} orgId="org-1"
      perReceiptLimit={50000} liquidationDueDays={15} allowReceiptOverride={false} onClose={vi.fn()} onSaved={onSaved}/>);
    fireEvent.click(await screen.findByRole('button', { name:'Check saved liquidation' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(mocks.findLiquidation).toHaveBeenCalledWith(attempt);
    expect(mocks.submitLiquidation).not.toHaveBeenCalled();
  });
});
