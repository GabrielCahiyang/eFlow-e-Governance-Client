import { financialOfficeUnavailable } from "../../src/app/features/projects/selectors/projectReportAvailability";
import { budgetReportRead } from "../../src/app/features/budget/services/budgetReportReads";
import { describe, it, expect } from "vitest";
import { readAllRows } from "../../src/app/shared/readAllRows";
import {
  selectProjectReportScope,
  EMPTY_REPORT_FILTERS,
} from "../../src/app/features/projects/selectors/projectReportScope";
import { buildProjectExecutionFinancialRows } from "../../src/app/features/projects/selectors/projectFinancialReportSelectors";
import type { ProjectCommandData } from "../../src/app/features/projects/components/project-command/types";
function fixture(): ProjectCommandData {
  return {
    project: { title: "Report", status: "active" },
    tasks: [
      {
        id: "root",
        title: "Workshop",
        orgId: "office",
        status: "todo",
        percentComplete: 20,
      },
      {
        id: "other",
        title: "Other Office",
        orgId: "foreign",
        status: "todo",
        percentComplete: 30,
      },
    ],
    facts: {
      subtasks: [
        {
          id: "child",
          taskId: "root",
          title: "Materials",
          status: "todo",
          assignedToIds: [],
          position: 1,
        },
        {
          id: "grandchild",
          parentSubtaskId: "child",
          taskId: "root",
          title: "Receipts",
          status: "in_progress",
          assignedToIds: [],
          position: 0,
        },
      ],
      evidence: [],
      submissions: [],
      progress: [],
      statusHistory: [],
    },
    financial: {
      allocations: [
        { id: "a", taskId: "root", amount: 100, status: "approved" },
        { id: "b", taskId: "other", amount: 200, status: "approved" },
        {
          id: "c",
          taskId: "root",
          subtaskId: "child",
          amount: 20,
          status: "approved",
        },
      ],
      requests: [
        {
          id: "r1",
          taskId: "root",
          status: "settled",
          actualSpent: 50,
          returnedAmount: 5,
        },
        {
          id: "r2",
          taskId: "root",
          subtaskId: "child",
          status: "approved",
          requestedAmount: 10,
        },
      ],
      allocationLines: [],
      requestAttachments: [],
      releases: [],
      liquidations: [],
      ledger: [],
      commitments: [],
    },
  } as unknown as ProjectCommandData;
}
describe("R11 report integrity", () => {
  it("preserves task families, recursive paths and funding pools under filters", () => {
    const scoped = selectProjectReportScope(fixture(), {
      ...EMPTY_REPORT_FILTERS,
      office: "office",
      search: "Receipts",
      status: "in_progress",
    });
    expect(scoped.tasks.map((t) => t.id)).toEqual(["root"]);
    expect(scoped.financial.allocations).toHaveLength(2);
    expect(scoped.facts.subtasks).toHaveLength(2);
    const rows = buildProjectExecutionFinancialRows(
      scoped.tasks,
      scoped.facts.subtasks,
      scoped.financial,
      scoped.facts,
    );
    expect(rows.map((r) => r.workItem)).toEqual([
      "Workshop",
      "Materials",
      "Materials / Receipts",
    ]);
    expect(rows[0]).toMatchObject({
      budgetAmount: 100,
      spentAmount: 50,
      reservedAmount: 10,
      returnedAmount: 5,
      availableAmount: 40,
    });
    expect(rows[1]).toMatchObject({
      budgetMode: "cap",
      budgetAmount: 20,
      reservedAmount: 10,
    });
    expect(rows[2].budgetMode).toBe("shared");
    expect(
      selectProjectReportScope(fixture(), {
        ...EMPTY_REPORT_FILTERS,
        search: "missing",
      }).financial.requests,
    ).toEqual([]);
  });
  it("exhausts exact-count queries even when the server cap is smaller than the requested page", async () => {
    const calls: number[] = [],
      all = Array.from({ length: 1201 }, (_, i) => i);
    const rows = await readAllRows<number>(async (from) => {
      calls.push(from);
      return {
        data: all.slice(from, from + 250),
        count: all.length,
        error: null,
      };
    });
    expect(rows).toEqual(all);
    expect(calls).toEqual([0, 250, 500, 750, 1000]);
  });
  it("rejects failed, truncated or changed-count reads instead of false complete totals", async () => {
    await expect(
      readAllRows(async () => ({
        data: null,
        error: { message: "Evidence denied" },
      })),
    ).rejects.toThrow("Evidence denied");
    let calls = 0;
    await expect(
      readAllRows(async () => ({
        data: calls++ ? [2] : [1],
        count: calls === 1 ? 3 : 4,
        error: null,
      })),
    ).rejects.toThrow("changed during loading");
    await expect(
      readAllRows(async () => ({ data: [], count: 3, error: null })),
    ).rejects.toThrow("incomplete");
  });
  it("marks other Office funding unavailable without treating it as zero", () => {
    const data = fixture();
    data.project.orgId = "office";
    expect(financialOfficeUnavailable(data, "root")).toBe(false);
    expect(financialOfficeUnavailable(data, "other")).toBe(true);
  });
  it("chunks financial identifiers, exhausts small server pages and keeps global ordering", async () => {
    const ids = Array.from({ length: 205 }, (_, i) => String(i));
    const batches: number[] = [];
    const result = await budgetReportRead(
      (selected) => {
        batches.push(selected.length);
        return {
          range: async (from) => ({
            data: selected
              .slice(from, from + 25)
              .map((id) => ({ id, position: Number(id) })),
            count: selected.length,
            error: null,
          }),
        };
      },
      ids,
      "position",
      false,
    );
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(205);
    expect(result.data?.[0].id).toBe("204");
    expect(Math.max(...batches)).toBe(100);
  });
  it("keeps budget source failures explicit through the existing return contract", async () => {
    expect(
      await budgetReportRead(() => ({
        range: async () => ({
          data: null,
          error: { message: "Settlement denied" },
        }),
      })),
    ).toMatchObject({ data: null, error: { message: "Settlement denied" } });
  });
});
