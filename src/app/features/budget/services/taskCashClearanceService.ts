import { supabase } from "../../../../lib/supabase";
import { CASH_COMPLETION_TERMINAL_STATES, getTaskCashBlockers } from "../selectors/taskCashClearance";
import type { TaskCashBlocker } from "../types";
import { mapAllocationLine, mapLiquidation, mapRelease, mapRequest } from "./budgetMappers";
import { getIndependentReview } from "./independentReviewService";

/** Read only this task's cash, across fiscal years, using the signed-in user's RLS. */
export async function fetchTaskCashBlockers(taskId: string): Promise<TaskCashBlocker[]> {
  if (!taskId) return [];
  const rows: Record<string, unknown>[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.from("petty_cash_requests").select("*").eq("task_id", taskId)
      .not("status", "in", `(${CASH_COMPLETION_TERMINAL_STATES.join(",")})`)
      .order("created_at").order("id").range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data || []));
    if ((result.data?.length || 0) < pageSize) break;
  }
  if (!rows.length) return [];
  const ids = (values: unknown[]) => Array.from(new Set(values.filter(Boolean).map(String)));
  const read = async (table: string, columns: string, column: string, values: string[]) => {
    if (!values.length) return [];
    // Paginate related rows too: a request can have many release tranches.
    const found: Record<string, unknown>[] = [];
    for (let start = 0; start < values.length; start += pageSize) {
      for (let offset = 0; ; offset += pageSize) {
        const result = await supabase.from(table).select(columns).in(column, values.slice(start, start + pageSize))
          .order("id").range(offset, offset + pageSize - 1);
        if (result.error) throw new Error(result.error.message);
        const page = (result.data || []) as unknown as Record<string, unknown>[];
        found.push(...page);
        if (page.length < pageSize) break;
      }
    }
    return found;
  };
  const requestIds = ids(rows.map((row) => row.id));
  const [profiles, tasks, subtasks, lines, releases, liquidations, budgets] = await Promise.all([
    read("profiles", "id,full_name", "id", ids(rows.flatMap((row) => [row.requester_id, row.task_leader_id, row.cash_recipient_id]))),
    read("tasks", "id,title", "id", [taskId]),
    read("subtasks", "id,title", "id", ids(rows.map((row) => row.subtask_id))),
    read("work_budget_allocation_lines", "*", "id", ids(rows.map((row) => row.allocation_line_id))),
    read("petty_cash_releases", "*", "request_id", requestIds),
    read("petty_cash_liquidations", "*", "request_id", requestIds),
    read("department_fiscal_budgets", "id,fiscal_year", "id", ids(rows.map((row) => row.fiscal_budget_id))),
  ]);
  const byId = (items: Record<string, unknown>[]) => new Map(items.map((row) => [String(row.id), row]));
  const profileById = byId(profiles);
  const subtaskById = byId(subtasks);
  const blockers = getTaskCashBlockers(taskId, {
    requests: rows.map((row) => mapRequest({
      ...row, task: tasks[0], subtask: subtaskById.get(String(row.subtask_id)),
      requester: profileById.get(String(row.requester_id)),
      task_leader: profileById.get(String(row.task_leader_id)),
      cash_recipient: profileById.get(String(row.cash_recipient_id)),
    })),
    releases: releases.map(mapRelease),
    liquidations: liquidations.map((row) => mapLiquidation(row, [])),
    allocationLines: lines.map(mapAllocationLine),
  }, new Map(budgets.map((row) => [String(row.id), Number(row.fiscal_year)])));
  return Promise.all(blockers.map(async blocker => {
    const item = blocker.liquidation;
    if (item?.status !== "pending_department_settlement") return blocker;
    // Some task reviewers can see the cash blocker but lack finance review access.
    const review = await getIndependentReview(item.id).catch(() => undefined);
    if (!review || review.version !== item.version || !Number.isInteger(review.eligibleSettlers)) return blocker;
    return { ...blocker, settlement: {
      eligibleSettlers: review.eligibleSettlers,
      headNotified: review.headAlertStatus === "notified",
      headApproved: review.headEscalationApproved === true,
    } };
  }));
}
