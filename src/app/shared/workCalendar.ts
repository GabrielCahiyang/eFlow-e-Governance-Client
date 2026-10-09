/** Date-only values keep their calendar day; instants are displayed in the workspace timezone. */
export function workDay(
  value: string | Date | number | undefined | null,
  timezone = "Asia/Singapore",
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const instant = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(instant) &&
      new Date(instant).toISOString().slice(0, 10) === value
      ? instant / 86400000
      : null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day")) / 86400000;
  } catch {
    return null;
  }
}
export function workDateLabel(
  value: string | undefined | null,
  timezone: string,
) {
  const day = workDay(value, timezone);
  return day === null
    ? "Date not set"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(day * 86400000));
}
export function matchesWorkDate(
  due: string | null | undefined,
  filter: string,
  now: Date,
  timezone: string,
) {
  if (filter === "All my work") return true;
  const day = workDay(due, timezone),
    today = workDay(now, timezone);
  if (day === null || today === null) return false;
  const monday = today - ((new Date(today * 86400000).getUTCDay() + 6) % 7);
  return filter === "Today"
    ? day === today
    : filter === "This week"
      ? day >= monday && day <= monday + 6
      : day < today;
}
