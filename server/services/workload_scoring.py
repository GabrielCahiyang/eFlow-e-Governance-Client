"""Unified workload & overload scoring for AI staffing services.

Mirrors the live Postgres RPC (`eflow_project.resolve_workload_settings` &
`public.get_office_workload_summary`) and frontend `workloadProjection.ts` using
integer-tenth arithmetic and `Asia/Manila` business-day dates so AI staffing
decisions follow the exact same thresholds configured in Admin Maintenance.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

MANILA = timezone(timedelta(hours=8))

ACTIVE_TASK_STATUSES = {
    "pending_assignment",
    "todo",
    "in_progress",
    "for_review",
    "changes_requested",
}
ACTIVE_SUBTASK_STATUSES = {
    "todo",
    "in_progress",
    "for_review",
    "changes_requested",
}
OPEN_PROJECT_ACTIVE_STATUSES = {"active", "pending_completion_review"}
OPEN_PROJECT_PLANNING_STATUSES = {
    "planning",
    "pending",
    "pending_head_approval",
    "pending_accounting",
}
CLOSED_STATUSES = {"completed", "cancelled", "archived"}

DEFAULT_WORKLOAD_THRESHOLDS: dict[str, Any] = {
    "heavy_points": 8.0,
    "overload_points": 12.0,
    "max_active_project_leads": 3,
    "max_active_task_leads": 5,
    "max_overdue_items": 3,
    "due_soon_business_days": 3,
    "weight_active_project_lead": 3.0,
    "weight_planning_project_lead": 1.5,
    "weight_task_lead": 2.0,
    "weight_task_contributor": 1.0,
    "weight_subtask_lead": 1.0,
    "weight_subtask_contributor": 0.5,
    "weight_pending_review": 0.5,
    "weight_overdue_penalty": 1.5,
    "weight_due_soon_penalty": 0.5,
}


def _to_tenths(value: Any) -> int:
    try:
        return int(round(float(value) * 10))
    except (TypeError, ValueError):
        return 0


def _from_tenths(tenths: int) -> float:
    return round(tenths / 10.0, 1)


def add_business_days(start: date, business_days: int) -> date:
    current = start
    remaining = max(0, int(business_days))
    while remaining > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Mon=0 .. Fri=4
            remaining -= 1
    return current


def parse_iso_date(raw: Any) -> date | None:
    if not raw:
        return None
    text = str(raw).strip()
    if len(text) < 10:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def load_office_thresholds(supabase_admin: Any, org_id: str | None) -> dict[str, Any]:
    """Read office-specific or global thresholds from `workload_threshold_settings`."""
    merged = dict(DEFAULT_WORKLOAD_THRESHOLDS)
    try:
        query = supabase_admin.table("workload_threshold_settings").select("*")
        rows = query.execute().data or []
        if not isinstance(rows, list):
            return merged
        global_row = next((r for r in rows if isinstance(r, dict) and r.get("org_id") is None), None)
        office_row = (
            next((r for r in rows if isinstance(r, dict) and org_id and str(r.get("org_id")) == str(org_id)), None)
            if org_id
            else None
        )
        chosen = office_row or global_row
        if isinstance(chosen, dict):
            for key in DEFAULT_WORKLOAD_THRESHOLDS:
                if chosen.get(key) is not None:
                    merged[key] = (
                        int(chosen[key])
                        if key.startswith(("max_", "due_soon_"))
                        else float(chosen[key])
                    )
    except Exception:
        return merged
    return merged


def fetch_auxiliary_workload_rows(
    supabase_admin: Any,
    user_ids: list[str],
    org_ids: list[str] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Load open projects led and open subtasks safely (graceful on mocked clients)."""
    projects: list[dict[str, Any]] = []
    subtasks: list[dict[str, Any]] = []
    if not user_ids:
        return projects, subtasks
    try:
        pq = (
            supabase_admin.table("projects")
            .select("id,project_lead_id,org_id,status")
            .in_("project_lead_id", user_ids)
            .in_("status", list(OPEN_PROJECT_ACTIVE_STATUSES | OPEN_PROJECT_PLANNING_STATUSES))
        )
        raw_projects = pq.execute().data or []
        if isinstance(raw_projects, list):
            projects = [r for r in raw_projects if isinstance(r, dict)]
    except Exception:
        projects = []
    try:
        sq = (
            supabase_admin.table("subtasks")
            .select("id,task_id,lead_id,assigned_to,team_member_ids,status,due_date,deadline,deleted_at")
            .is_("deleted_at", "null")
            .in_("status", list(ACTIVE_SUBTASK_STATUSES))
        )
        raw_subtasks = sq.execute().data or []
        if isinstance(raw_subtasks, list):
            uid_set = set(user_ids)
            subtasks = [
                r
                for r in raw_subtasks
                if isinstance(r, dict)
                and (
                    str(r.get("lead_id") or "") in uid_set
                    or str(r.get("assigned_to") or "") in uid_set
                    or any(str(m) in uid_set for m in (r.get("team_member_ids") or []))
                )
            ]
    except Exception:
        subtasks = []
    return projects, subtasks


def compute_member_workload(
    user_id: str,
    *,
    tasks: list[dict[str, Any]],
    projects: list[dict[str, Any]] | None = None,
    subtasks: list[dict[str, Any]] | None = None,
    thresholds: dict[str, Any] | None = None,
    now_manila: datetime | None = None,
    planned_task_leads: int = 0,
    planned_task_contributors: int = 0,
) -> dict[str, Any]:
    """Compute live workload points, tier, caps, and overload triggers for one user."""
    cfg = thresholds or DEFAULT_WORKLOAD_THRESHOLDS
    today = (now_manila or datetime.now(MANILA)).astimezone(MANILA).date()
    due_soon_cutoff = add_business_days(today, int(cfg["due_soon_business_days"]))

    active_projects_led = 0
    planning_projects_led = 0
    led_project_ids: set[str] = set()
    for project in projects or []:
        if str(project.get("project_lead_id") or "") != str(user_id):
            continue
        status = str(project.get("status") or "").lower()
        if status in OPEN_PROJECT_ACTIVE_STATUSES:
            active_projects_led += 1
            if project.get("id"):
                led_project_ids.add(str(project["id"]))
        elif status in OPEN_PROJECT_PLANNING_STATUSES:
            planning_projects_led += 1
            if project.get("id"):
                led_project_ids.add(str(project["id"]))

    tasks_led = 0
    tasks_contributing = 0
    pending_reviews = 0
    overdue_count = 0
    due_soon_count = 0
    active_task_ids: set[str] = set()

    for task in tasks or []:
        if task.get("deleted_at") or task.get("archived_at"):
            continue
        status = str(task.get("status") or "").lower()
        if status not in ACTIVE_TASK_STATUSES:
            continue
        task_lead = str(task.get("assigned_to") or "")
        rec_lead = str(task.get("recommendation_lead_id") or "")
        team = [str(m) for m in (task.get("team_member_ids") or [])]
        is_lead = str(user_id) == task_lead
        is_member = is_lead or str(user_id) == rec_lead or str(user_id) in team

        if is_lead:
            tasks_led += 1
        elif is_member:
            tasks_contributing += 1

        if is_member:
            if task.get("id"):
                active_task_ids.add(str(task["id"]))
            if status != "for_review":
                due = parse_iso_date(task.get("due_date") or task.get("deadline"))
                if due is not None:
                    if due < today:
                        overdue_count += 1
                    elif due <= due_soon_cutoff:
                        due_soon_count += 1

        # Pending review queue owned by a Project Lead for other people's submitted tasks
        if (
            status == "for_review"
            and task.get("linked_project_id")
            and str(task["linked_project_id"]) in led_project_ids
            and task_lead != str(user_id)
        ):
            pending_reviews += 1

    subtasks_led = 0
    subtasks_contributing = 0
    for sub in subtasks or []:
        if sub.get("deleted_at"):
            continue
        status = str(sub.get("status") or "").lower()
        if status not in ACTIVE_SUBTASK_STATUSES:
            continue
        sub_lead = str(sub.get("lead_id") or sub.get("assigned_to") or "")
        sub_team = [str(m) for m in (sub.get("team_member_ids") or [])]
        is_sub_lead = str(user_id) == sub_lead
        is_sub_member = is_sub_lead or str(user_id) in sub_team
        if is_sub_lead:
            subtasks_led += 1
        elif is_sub_member:
            subtasks_contributing += 1

        if is_sub_member and status != "for_review":
            due = parse_iso_date(sub.get("due_date") or sub.get("deadline"))
            if due is not None:
                if due < today:
                    overdue_count += 1
                elif due <= due_soon_cutoff:
                    due_soon_count += 1

    effective_task_leads = tasks_led + max(0, int(planned_task_leads))
    effective_task_contributors = tasks_contributing + max(0, int(planned_task_contributors))

    points_tenths = (
        active_projects_led * _to_tenths(cfg["weight_active_project_lead"])
        + planning_projects_led * _to_tenths(cfg["weight_planning_project_lead"])
        + effective_task_leads * _to_tenths(cfg["weight_task_lead"])
        + effective_task_contributors * _to_tenths(cfg["weight_task_contributor"])
        + subtasks_led * _to_tenths(cfg["weight_subtask_lead"])
        + subtasks_contributing * _to_tenths(cfg["weight_subtask_contributor"])
        + pending_reviews * _to_tenths(cfg["weight_pending_review"])
        + overdue_count * _to_tenths(cfg["weight_overdue_penalty"])
        + due_soon_count * _to_tenths(cfg["weight_due_soon_penalty"])
    )
    heavy_tenths = _to_tenths(cfg["heavy_points"])
    overload_tenths = _to_tenths(cfg["overload_points"])

    reasons: list[str] = []
    if points_tenths >= overload_tenths:
        reasons.append(f"Load {_from_tenths(points_tenths):.1f} pts >= {float(cfg['overload_points']):.1f} pts cap")
    if active_projects_led >= int(cfg["max_active_project_leads"]):
        reasons.append(f"Leads {active_projects_led} active projects (cap {int(cfg['max_active_project_leads'])})")
    if effective_task_leads >= int(cfg["max_active_task_leads"]):
        reasons.append(f"Leads {effective_task_leads} active tasks (cap {int(cfg['max_active_task_leads'])})")
    if overdue_count >= int(cfg["max_overdue_items"]):
        reasons.append(f"Has {overdue_count} overdue items (cap {int(cfg['max_overdue_items'])})")

    if reasons:
        tier = "overloaded"
    elif points_tenths >= heavy_tenths:
        tier = "heavy"
    elif points_tenths >= _to_tenths(3.0):
        tier = "balanced"
    else:
        tier = "available"

    return {
        "activeTasks": len(active_task_ids) + max(0, int(planned_task_leads)) + max(0, int(planned_task_contributors)),
        "activeProjectsLed": active_projects_led,
        "planningProjectsLed": planning_projects_led,
        "tasksLed": effective_task_leads,
        "tasksContributing": effective_task_contributors,
        "subtasksLed": subtasks_led,
        "subtasksContributing": subtasks_contributing,
        "pendingReviewsCount": pending_reviews,
        "overdueCount": overdue_count,
        "dueSoonCount": due_soon_count,
        "loadPoints": _from_tenths(points_tenths),
        "workloadTier": tier,
        "isOverloaded": tier == "overloaded",
        "overloadReasons": reasons,
    }
