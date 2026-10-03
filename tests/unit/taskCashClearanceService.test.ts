import { beforeEach, describe, expect, it, vi } from "vitest";

const backend = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, queries: [] as Array<{ table: string; column?: string; values?: unknown[]; excluded?: string }>, failure: "" }));
vi.mock("../../src/lib/supabase", () => ({ supabase: {
  from: (table: string) => {
    const query = { table } as (typeof backend.queries)[number];
    backend.queries.push(query);
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { query.column = column; query.values = [value]; return builder; },
      in: (column: string, values: unknown[]) => { query.column = column; query.values = values; return builder; },
      not: (_column: string, _operator: string, values: string) => { query.excluded = values; return builder; },
      order: () => builder,
      range: async (start: number, end: number) => {
        if (backend.failure === table) return { error: { message: "Read failed" }, data: null };
        const rows = (backend.tables[table] || []).filter((row) => !query.column || query.values?.includes(row[query.column]));
        return { error: null, data: rows.filter((row) => !query.excluded?.includes(String(row.status))).slice(start, end + 1) };
      },
    };
    return builder;
  },
} }));
import { fetchTaskCashBlockers } from "../../src/app/features/budget/services/taskCashClearanceService";

beforeEach(() => {
  backend.failure = "";
  backend.queries = [];
  backend.tables = {
    petty_cash_requests: [{ id: "cash-1", task_id: "task-1", subtask_id: "subtask-1", status: "released", requester_id: "user-1", cash_recipient_id: "user-1", request_number: 12, fiscal_budget_id: "fy-old", requested_amount: 500, released_amount: 500 }],
    tasks: [{ id: "task-1", title: "Task one" }], subtasks: [{ id: "subtask-1", title: "Buy pens" }],
    profiles: [{ id: "user-1", full_name: "Cash recipient" }], department_fiscal_budgets: [{ id: "fy-old", fiscal_year: 2025 }],
  };
});

describe("task-scoped cash diagnostics", () => {
  it("uses the signed-in task-scoped read across fiscal years, not the office-wide bundle", async () => {
    backend.tables.petty_cash_requests.push({ id: "other", task_id: "other-task", status: "released" });
    const result = await fetchTaskCashBlockers("task-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fiscalYear: 2025, owner: "Cash recipient", request: { requestNumber: 12, taskTitle: "Task one", subtaskTitle: "Buy pens" } });
    expect(backend.queries[0]).toEqual({ table: "petty_cash_requests", column: "task_id", values: ["task-1"], excluded: "(settled,rejected,cancelled)" });
  });

  it("does not silently truncate tasks with multiple pages of requests", async () => {
    const row = backend.tables.petty_cash_requests[0];
    backend.tables.petty_cash_requests = Array.from({ length: 205 }, (_, index) => ({ ...row, id: `cash-${index}` }));
    expect(await fetchTaskCashBlockers("task-1")).toHaveLength(205);
    expect(backend.queries.filter((query) => query.table === "petty_cash_requests")).toHaveLength(2);
  });

  it("propagates read errors rather than returning a misleading empty clearance", async () => {
    backend.failure = "petty_cash_requests";
    await expect(fetchTaskCashBlockers("task-1")).rejects.toThrow("Read failed");
  });

  it("does not query related records if there are no visible blockers", async () => {
    backend.tables.petty_cash_requests = [];
    expect(await fetchTaskCashBlockers("task-1")).toEqual([]);
    expect(backend.queries).toHaveLength(1);
  });
});
