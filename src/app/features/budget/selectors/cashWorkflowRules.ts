import type {
  PettyCashLiquidation,
  PettyCashRelease,
  PettyCashRequest,
} from "../types";

import { getPhilippineCalendarDate } from '../../../shared/calendarDates';
export { getPhilippineCalendarDate } from '../../../shared/calendarDates';

export function isPastCashNeededBy(
  neededBy?: string,
  today = getPhilippineCalendarDate(),
) {
  return Boolean(neededBy && neededBy < today);
}

export function assertCashNeededByIsCurrentOrFuture(neededBy?: string) {
  if (isPastCashNeededBy(neededBy)) {
    throw new Error("Needed-by date cannot be earlier than today.");
  }
}

export function getScheduledReleaseSummary(
  releases: PettyCashRelease[],
  today = getPhilippineCalendarDate(),
) {
  const scheduled = releases.filter((release) => release.status === "scheduled");
  const due = scheduled.filter((release) => release.scheduledDate <= today);
  return {
    scheduledCount: scheduled.length,
    scheduledAmount: scheduled.reduce((sum, release) => sum + release.amount, 0),
    dueCount: due.length,
    dueAmount: due.reduce((sum, release) => sum + release.amount, 0),
    futureCount: scheduled.length - due.length,
  };
}

export function isLiquidationLate(
  request?: PettyCashRequest,
  liquidation?: PettyCashLiquidation,
) {
  return Boolean(
    request?.liquidationDueAt &&
      liquidation?.submittedAt &&
      liquidation.submittedAt > request.liquidationDueAt,
  );
}

export function isLiquidationCurrentlyOverdue(
  request?: PettyCashRequest,
  now = Date.now(),
) {
  return Boolean(request?.liquidationDueAt && now > request.liquidationDueAt);
}
