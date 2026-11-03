import { describe, it, expect } from "vitest";
import { accountingOverviewMetrics } from "../../src/app/features/budget/selectors/accountingOverviewMetrics";
import type {
  DepartmentBudgetBundle,
  BudgetSection,
} from "../../src/app/features/budget/types";
const section = (
  id: string,
  amount: number,
  extra: Partial<BudgetSection> = {},
): BudgetSection => ({
  id,
  name: id,
  amount,
  heldAmount: 0,
  position: 0,
  ...extra,
});
const bundle = (extra: Partial<DepartmentBudgetBundle> = {}) =>
  ({
    summary: null,
    lines: [],
    commitments: [],
    allocations: [],
    allocationLines: [],
    requests: [],
    requestAttachments: [],
    releases: [],
    liquidations: [],
    ledger: [],
    adjustments: [],
    ...extra,
  }) as DepartmentBudgetBundle;
describe("Accounting overview totals", () => {
  it("does not charge settled spending again on top of committed protection", () => {
    const model = accountingOverviewMetrics(
      bundle({
        sections: [
          section("Supplies", 10000, {
            heldAmount: 2000,
            committedAmount: 4000,
            spentAmount: 3000,
          }),
        ],
      }),
    );
    expect(model.available[0].value).toBe(4000);
  });
  it("uses the server protected amount and counts active leaf accounts only", () => {
    const model = accountingOverviewMetrics(
      bundle({
        sections: [
          section("Parent", 0),
          section("Supplies", 10000, {
            parentId: "Parent",
            protectedAmount: 4500,
          }),
          section("Retired", 5000, { retired: true }),
        ],
      }),
    );
    expect(model.available.map((a) => [a.label, a.value])).toEqual([
      ["Supplies", 5500],
    ]);
  });
  it("shows only pending availability releases on active leaves", () => {
    const pending = {
      id: "r",
      date: "2026-11-10",
      amount: 2000,
      status: "pending" as const,
    };
    const model = accountingOverviewMetrics(
      bundle({
        sections: [
          section("A", 5000, {
            releaseSchedule: [
              pending,
              { ...pending, id: "confirmed", status: "confirmed" },
            ],
          }),
          section("Old", 5000, {
            retired: true,
            releaseSchedule: [{ ...pending, id: "old" }],
          }),
        ],
      }),
    );
    expect(model.scheduled).toEqual([{ account: "A", ...pending }]);
  });
  it("separates settled spending, returned cash and outstanding advances; excludes scheduled cash", () => {
    const now = Date.parse("2026-11-03T12:00:00Z");
    const data = bundle({
      requests: [
        {
          id: "settled",
          status: "settled",
          releasedAmount: 4000,
          actualSpent: 3000,
          returnedAmount: 1000,
          createdAt: now - 86400000,
        },
        {
          id: "open",
          status: "released",
          releasedAmount: 500,
          createdAt: now - 40 * 86400000,
        },
      ] as DepartmentBudgetBundle["requests"],
      releases: [
        {
          id: "one",
          requestId: "settled",
          status: "released",
          amount: 4000,
          createdAt: now - 86400000,
        },
        {
          id: "two",
          requestId: "open",
          status: "released",
          amount: 500,
          createdAt: now - 40 * 86400000,
          releasedAt: now - 10 * 86400000,
        },
        {
          id: "three",
          requestId: "open",
          status: "scheduled",
          amount: 700,
          createdAt: now,
        },
      ] as DepartmentBudgetBundle["releases"],
    });
    const model = accountingOverviewMetrics(data, now);
    expect([
      model.released,
      model.spent,
      model.returned,
      model.outstanding,
    ]).toEqual([4500, 3000, 1000, 500]);
    expect(model.ages.map((a) => a.value)).toEqual([0, 500, 0]);
  });
});
