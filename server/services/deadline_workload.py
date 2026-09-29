"""Deadline pressure for private AI candidate scoring; mirrors the task selector.

Work hours: Monday-Friday 08-12 and 13-17, Philippine time. Unknown
estimates remain unknown; task counts never stand in for duration.
"""
from datetime import datetime, time, timedelta, timezone
from math import isfinite

MANILA = timezone(timedelta(hours=8))


def _deadline(value):
    if not value:
        return None
    try:
        raw = str(value).strip()
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if len(raw) == 10:
            parsed = datetime.combine(parsed.date(), time(23, 59, 59, 999999))
        return (parsed if parsed.tzinfo else parsed.replace(tzinfo=MANILA)).astimezone(MANILA)
    except (ValueError, TypeError):
        return None


def working_hours(start, end):
    if end <= start:
        return 0.0
    day = start.astimezone(MANILA).replace(hour=0, minute=0, second=0, microsecond=0)
    hours = 0.0
    while day < end:
        if day.weekday() < 5:
            for first, last in ((8, 12), (13, 17)):
                hours += max(0, (min(end, day + timedelta(hours=last)) - max(start, day + timedelta(hours=first))).total_seconds()) / 3600
        day += timedelta(days=1)
    return hours


def deadline_workload_signal(tasks, employee_id, now=None):
    now = now or datetime.now(MANILA)
    if now.tzinfo is None:
        now = now.replace(tzinfo=MANILA)
    items = []
    for task in tasks:
        members = {str(member) for member in (task.get("team_member_ids") or [])}
        if task.get("assigned_to"):
            members.add(str(task["assigned_to"]))
        if str(employee_id) not in members or task.get("status") in {"completed", "cancelled", "for_review"} or task.get("archived_at") or task.get("deleted_at"):
            continue
        try:
            estimate = float(task.get("estimated_hours") or 0)
            progress = float(task.get("percent_complete") or 0)
        except (ValueError, TypeError):
            estimate, progress = 0, 0
        hours = estimate * (1 - max(0, min(100, progress)) / 100) / max(1, len(members)) if estimate > 0 and isfinite(estimate) else None
        deadline = task.get("deadline")
        raw_due = deadline if "T" in str(deadline or "") else task.get("due_date") or deadline
        items.append((_deadline(raw_due), hours))
    unknown = any(due is None or hours is None for due, hours in items)
    overdue = any(due is not None and due < now for due, _ in items)
    pressure = 0
    for deadline, _ in items:
        if deadline is None:
            continue
        required = sum(hours or 0 for due, hours in items if due is not None and due <= deadline)
        capacity = working_hours(now, deadline)
        pressure = max(pressure, required / capacity * 100 if capacity else 200 if required else 0)
    # Established AI scale: light <55, moderate 55-79, high 80-84, very high >=85.
    if pressure > 100 or overdue:
        return min(100, max(85, round(pressure * .8)))
    if pressure >= 85:
        return min(84, 80 + round((pressure - 85) / 15 * 4))
    if unknown:
        return 55
    if pressure >= 50:
        return 55 + round((pressure - 50) / 35 * 24)
    return round(pressure / 50 * 54)
