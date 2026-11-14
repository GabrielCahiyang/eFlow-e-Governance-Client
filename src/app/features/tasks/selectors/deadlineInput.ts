/** Editor values in Philippine calendar dates (no due time). */
export function deadlineInputParts(deadline: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { date: deadline };
  if (/^\d{4}-\d{2}-\d{2}T/.test(deadline)) {
    const value = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(deadline) ? deadline : `${deadline}+08:00`);
    if (Number.isFinite(value)) return { date: new Date(value + 8 * 3_600_000).toISOString().slice(0, 10) };
  }
  return { date: "" };
}

export function deadlineFromInputs(date: string) {
  return date;
}

export function isValidCalendarDeadline(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}
