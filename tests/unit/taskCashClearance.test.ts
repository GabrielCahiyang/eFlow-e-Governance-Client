import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASH_COMPLETION_TERMINAL_STATES, canOpenCashBlockerReview, getTaskCashBlockers, isCashCompletionError } from "../../src/app/features/budget/selectors/taskCashClearance";
import type { PettyCashStatus } from "../../src/app/features/budget/types";
import { cashData, cashRequest } from "./taskCashClearance.fixtures";

describe("task cash clearance", () => {
  it("uses the database guard's terminal states, including its expired-request limitation", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20260824000008_budget_controls_and_resubmission.sql", import.meta.url), "utf8");
    const guard = sql.split("create or replace function public.guard_task_financial_completion()")[1].split("$$;")[0];
    expect(guard).toContain(`request.status not in (${CASH_COMPLETION_TERMINAL_STATES.map((status) => `'${status}'`).join(", ")})`);
    const statuses: PettyCashStatus[] = ["settled", "rejected", "cancelled", "expired", "draft", "pending", "released"];
    const requests = statuses.map((status) => cashRequest({ id: status, status }));
    requests.push(cashRequest({ id: "other", taskId: "other-task" }));
    expect(getTaskCashBlockers("task-1", cashData(requests)).map((item) => item.request.id)).toEqual(["expired", "draft", "pending", "released"]);
  });

  it("identifies a subtask, its fund source, recipient and exact latest settlement record", () => {
    const data = cashData();
    data.liquidations.push({ ...data.liquidations[0], id: "old", version: 1, status: "changes_requested" });
    const [blocker] = getTaskCashBlockers("task-1", data, new Map([["budget-1", 2025]]));
    expect(blocker).toMatchObject({
      fiscalYear: 2025, stage: "Awaiting final cash settlement", owner: "Accounting Staff",
      sourceLabel: "Food · Meals · Office Budget", reviewTarget: { recordId: "liquidation-2", role: "department" },
      request: { subtaskTitle: "Order Food", requestNumber: 2 }, liquidation: { declaredSpent: 8500, returnedAmount: 1500 },
    });
    expect(blocker.nextStep).toContain("Approving work evidence does not settle this cash");
  });

  it.each([
    ["pending_leader_review", "Awaiting operational endorsement", "Gabriel Cahiyang (Task Leader)"],
    ["pending_department_approval", "Awaiting fiscal authorization", "Head"],
    ["leader_changes_requested", "Cash request needs correction", "Crisostomo Ibarra"],
    ["department_changes_requested", "Cash request needs correction", "Crisostomo Ibarra"],
    ["released", "Awaiting receipts and return", "Crisostomo Ibarra"],
    ["overdue_liquidation", "Receipts overdue", "Crisostomo Ibarra"],
    ["changes_requested", "Receipts need correction", "Crisostomo Ibarra"],
    ["pending_leader_liquidation_review", "Receipts awaiting Task Leader review", "Gabriel Cahiyang (Task Leader)"],
  ] as const)("explains %s without treating reservations as spending", (status, stage, owner) => {
    const [blocker] = getTaskCashBlockers("task-1", cashData([cashRequest({ status })]));
    expect(blocker).toMatchObject({ stage, owner });
    expect(blocker.nextStep.length).toBeGreaterThan(30);
  });

  it("names missing cash acknowledgement before the receipt step", () => {
    const data = cashData([cashRequest({ status: "released" })]);
    data.releases = [{ id: "release-1", requestId: "request-1", orgId: "org-1", scheduledDate: "2026-08-30", amount: 10000, status: "released", createdAt: 1 }];
    expect(getTaskCashBlockers("task-1", data)[0].nextStep).toContain("Acknowledge receipt");
  });

  it("routes partial releases only to an actionable tranche, not an empty review inbox", () => {
    const data = cashData([cashRequest({ status: "partially_released" })]);
    data.releases = [{ id: "release-1", requestId: "request-1", orgId: "org-1", scheduledDate: "2026-09-02", amount: 1000, status: "scheduled", createdAt: 1 }];
    expect(getTaskCashBlockers("task-1", data, new Map(), "2026-08-31")[0].reviewTarget).toBeUndefined();
    expect(getTaskCashBlockers("task-1", data, new Map(), "2026-09-02")[0].reviewTarget?.recordId).toBe("release-1");
  });

  it("does not offer self-settlement or leadership actions to an unrelated employee", () => {
    const [blocker] = getTaskCashBlockers("task-1", cashData(), new Map([["budget-1", 2026]]));
    expect(canOpenCashBlockerReview(blocker, "head-1", "head")).toBe(false);
    expect(canOpenCashBlockerReview(blocker, "accounting-1", "accounting_staff")).toBe(true);
    expect(canOpenCashBlockerReview(blocker, "employee-1", "head")).toBe(false);
    expect(canOpenCashBlockerReview(blocker, "unrelated", "member")).toBe(false);
    blocker.reviewTarget = { role: "leader", recordId: "liquidation-2" };
    expect(canOpenCashBlockerReview(blocker, "leader-1", "member")).toBe(true);
    expect(canOpenCashBlockerReview(blocker, "head-1", "head")).toBe(false);
  });

  it("recognizes only cash-completion failures", () => {
    expect(isCashCompletionError(new Error("Settle all task and subtask cash before approving this task"))).toBe(true);
    expect(isCashCompletionError(new Error("Only the assigned reviewer may decide"))).toBe(false);
  });
});
