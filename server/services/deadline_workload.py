"""Active work and overdue deadline facts for private AI candidate scoring."""
from datetime import datetime, time, timedelta, timezone

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
        deadline = task.get("deadline")
        raw_due = deadline if "T" in str(deadline or "") else task.get("due_date") or deadline
        items.append(_deadline(raw_due))
    # No duration estimate is inferred from task counts. Only deadline risk is scored.
    if any(due is not None and due < now for due in items):
        return 100
    return 55 if items else 0
