import { describe, expect, it, vi } from "vitest";
import {
  assertCashNeededByIsCurrentOrFuture,
  getPhilippineCalendarDate,
  getScheduledReleaseSummary,
  isLiquidationLate,
  isPastCashNeededBy,
} from "../../src/app/features/budget/selectors/cashWorkflowRules";
import type {
  PettyCashLiquidation,
  PettyCashRelease,
  PettyCashRequest,
} from "../../src/app/features/budget/types";

describe("cash workflow timing rules", () => {
  it('treats the Manila morning as due today even while UTC is yesterday',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-20T23:20:00Z'));
    try {expect(getScheduledReleaseSummary([{id:'release',status:'scheduled',scheduledDate:'2026-10-21',amount:500} as PettyCashRelease]).dueAmount).toBe(500);}finally{vi.useRealTimers();}
  });
  it("uses the Philippine calendar date at the UTC day boundary", () => {
    expect(getPhilippineCalendarDate(new Date("2026-09-24T16:30:00.000Z"))).toBe("2026-09-25");
  });

  it("rejects a past needed-by date while allowing today, the future, or no date", () => {
    expect(isPastCashNeededBy("2026-09-24", "2026-09-25")).toBe(true);
    expect(isPastCashNeededBy("2026-09-25", "2026-09-25")).toBe(false);
    expect(isPastCashNeededBy("2026-09-26", "2026-09-25")).toBe(false);
    expect(isPastCashNeededBy(undefined, "2026-09-25")).toBe(false);
    expect(() => assertCashNeededByIsCurrentOrFuture("2000-01-01")).toThrow(/cannot be earlier than today/i);
  });

  it("separates cash due now from future scheduled tranches", () => {
    const releases: PettyCashRelease[] = [
      { id: "due", requestId: "r1", orgId: "o1", scheduledDate: "2026-09-25", amount: 5000, status: "scheduled", createdAt: 1 },
      { id: "future", requestId: "r1", orgId: "o1", scheduledDate: "2026-09-27", amount: 3000, status: "scheduled", createdAt: 1 },
      { id: "released", requestId: "r1", orgId: "o1", scheduledDate: "2026-09-24", amount: 2000, status: "released", createdAt: 1 },
    ];
    expect(getScheduledReleaseSummary(releases, "2026-09-25")).toEqual({
      scheduledCount: 2,
      scheduledAmount: 8000,
      dueCount: 1,
      dueAmount: 5000,
      futureCount: 1,
    });
  });

  it("flags a receipt package submitted after its recorded deadline", () => {
    const request = { liquidationDueAt: 1000 } as PettyCashRequest;
    expect(isLiquidationLate(request, { submittedAt: 1001 } as PettyCashLiquidation)).toBe(true);
    expect(isLiquidationLate(request, { submittedAt: 1000 } as PettyCashLiquidation)).toBe(false);
  });
});

