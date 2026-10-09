import { workDay } from "../../../shared/workCalendar";
/** Locate calendar midnight in the workspace zone, including 23/25-hour DST days. */
export function activityDateBound(
  day: string,
  timezone: string,
  end = false,
): string | null {
  if (!day) return null;
  const target = workDay(day);
  if (target === null) throw new Error("Invalid activity date.");
  const wanted = target + (end ? 1 : 0);
  let low = wanted * 86400000 - 36 * 3600000,
    high = wanted * 86400000 + 36 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2),
      calendar = workDay(middle, timezone);
    if (calendar === null) throw new Error("Invalid workspace timezone.");
    if (calendar < wanted) low = middle + 1;
    else high = middle;
  }
  return new Date(low).toISOString();
}
