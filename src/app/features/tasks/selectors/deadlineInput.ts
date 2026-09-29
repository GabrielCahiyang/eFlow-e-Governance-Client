/** Editor values in Philippine local time; a missing time means end of the date. */
export function deadlineInputParts(deadline: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { date: deadline, time: "" };
  if (/^\d{4}-\d{2}-\d{2}T/.test(deadline)) {
    const value = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(deadline) ? deadline : `${deadline}+08:00`);
    if (Number.isFinite(value)) { const local = new Date(value + 8 * 3_600_000).toISOString(); return { date: local.slice(0, 10), time: local.slice(11, 16) }; }
  }
  return { date: "", time: "" };
}

export function deadlineFromInputs(date: string, time: string) {
  return date ? time ? `${date}T${time}:00+08:00` : date : "";
}

export function isValidCalendarDeadline(value: string) {
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) return false;
  return value.length === 10 || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}+08:00`));
}
