"""Private cross-organization staffing intelligence for collaboration drafts.

Raw manager notes are loaded with the server-side Supabase client and are never
returned to the browser. Only bounded scores and short fit explanations leave
this module.
"""

from __future__ import annotations

import json
import re
from typing import Any
from services.administrative_roles import is_administrator

import httpx

from gateway_config import settings
from gateway_dependencies import AuthenticatedUser, internal_ai_key, supabase_admin
from services.deadline_workload import deadline_workload_signal
from services.workload_scoring import (
    compute_member_workload,
    fetch_auxiliary_workload_rows,
    load_office_thresholds,
)


def _rows(table: str, fields: str = "*") -> Any:
    return supabase_admin.table(table).select(fields)


def _authorized_draft(user: AuthenticatedUser, draft_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    draft_result = _rows("proposal_collaboration_drafts").eq("id", draft_id).limit(1).execute()
    draft_rows = draft_result.data or []
    if not draft_rows:
        raise PermissionError("Collaboration draft not found.")
    draft = draft_rows[0]
    participants = _rows("proposal_collaboration_orgs").eq("draft_id", draft_id).execute().data or []
    owner = str(draft.get("owner_user_id")) == user.id
    owner_org_manager = bool(
        user.org_id
        and str(draft.get("owner_org_id")) == user.org_id
        and user.role in {"head"}
    )
    if is_administrator(user.role) or (not owner and not owner_org_manager):
        raise PermissionError("Only the owning office may request AI staffing recommendations.")
    if draft.get("status") != "draft":
        raise PermissionError("AI staffing recommendations are available only before collaboration review begins.")
    return draft, participants


def _candidate_context(participants: list[dict[str, Any]]) -> list[dict[str, Any]]:
    org_ids = [str(row["org_id"]) for row in participants if row.get("staffing_enabled")]
    if not org_ids:
        return []
    profiles = (
        _rows("profiles", "id,full_name,role,org_id,skills,workload,burnout_level")
        .eq("is_active", True)
        .in_("org_id", org_ids)
        .neq("role", "admin").neq("role", "super_admin")
        .neq("role", "admin")
        .execute().data or []
    )
    ids = [str(profile["id"]) for profile in profiles]
    notes = _rows("employee_notes", "profile_id,strengths,weaknesses,notes,tags").in_("profile_id", ids).execute().data or [] if ids else []
    note_by_id = {str(note["profile_id"]): note for note in notes}
    active_tasks = (
        _rows("tasks", "id,assigned_to,team_member_ids,status,deadline,due_date,percent_complete,linked_project_id,archived_at,deleted_at")
        .in_("status", ["pending_assignment", "todo", "in_progress", "for_review", "changes_requested"])
        .execute().data or []
    )
    projects, subtasks = fetch_auxiliary_workload_rows(supabase_admin, ids, org_ids)
    thresholds_by_org = {oid: load_office_thresholds(supabase_admin, oid) for oid in set(org_ids)}
    result: list[dict[str, Any]] = []
    for profile in profiles:
        candidate_id = str(profile["id"])
        candidate_org = str(profile.get("org_id"))
        intelligence = note_by_id.get(candidate_id, {})
        unified_load = compute_member_workload(
            candidate_id,
            tasks=active_tasks,
            projects=projects,
            subtasks=subtasks,
            thresholds=thresholds_by_org.get(candidate_org),
        )
        result.append({
            "employee_id": candidate_id,
            "name": profile.get("full_name"),
            "organization_id": candidate_org,
            "role": profile.get("role"),
            "skills": [key for key, enabled in (profile.get("skills") or {}).items() if enabled],
            "workload": deadline_workload_signal(active_tasks, candidate_id),
            "load_points": unified_load["loadPoints"],
            "workload_tier": unified_load["workloadTier"],
            "is_overloaded": unified_load["isOverloaded"],
            "active_projects_led": unified_load["activeProjectsLed"],
            "overdue_count": unified_load["overdueCount"],
            "overload_reasons": unified_load["overloadReasons"],
            "burnout": profile.get("burnout_level") or "low",
            "strengths": intelligence.get("strengths") or "",
            "weaknesses": intelligence.get("weaknesses") or "",
            "manager_notes": intelligence.get("notes") or "",
            "tags": intelligence.get("tags") or [],
        })
    return result


def _extract_json(text: str) -> dict[str, Any] | None:
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned, flags=re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start >= 0 and end > start:
            try:
                value = json.loads(cleaned[start:end + 1])
                return value if isinstance(value, dict) else None
            except json.JSONDecodeError:
                return None
    return None


def _deterministic_recommendations(tasks: list[dict[str, Any]], candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    for task in tasks:
        required = {str(skill).lower() for skill in task.get("requiredSkills", [])}
        ranked = []
        for candidate in candidates:
            skills = {str(skill).lower() for skill in candidate.get("skills", []) + candidate.get("tags", [])}
            match = len(required & skills) / max(1, len(required))
            workload = int(candidate.get("workload", 0))
            overload_penalty = 25 if candidate.get("is_overloaded") else (10 if candidate.get("workload_tier") == "heavy" else 0)
            score = round(max(0, min(100, 55 + match * 35 - workload * 0.25 - overload_penalty)))
            ranked.append((score, candidate))
        ranked.sort(
            key=lambda item: (
                bool(item[1].get("is_overloaded")),
                -item[0],
                float(item[1].get("load_points", 0.0)),
                item[1]["workload"],
                item[1]["name"] or "",
            )
        )
        # Do not impose an arbitrary team-size ceiling. A genuinely broad LGU
        # task may need every suitable participating office, while a focused
        # task may remain a one-person assignment. The manager still approves
        # the proposal before any assignment becomes operational.
        selected = [item for item in ranked if item[0] >= 60 and not item[1].get("is_overloaded")]
        if not selected:
            selected = [item for item in ranked if item[0] >= 60]
        if not selected and ranked:
            selected = [ranked[0]]
        for index, (score, candidate) in enumerate(selected):
            tier = candidate.get("workload_tier") or "available"
            pts = float(candidate.get("load_points", 0.0))
            recommendations.append({
                "taskKey": task.get("key"),
                "employeeId": candidate["employee_id"],
                "organizationId": candidate["organization_id"],
                "recommendationScore": score,
                "fitReason": f"Balanced skill fit with {tier} workload ({pts:.1f} pts, {candidate['workload']}% deadline signal).",
                "workload": candidate["workload"],
                "recommendedRole": "lead" if index == 0 else "support",
            })
    return recommendations


async def recommend_assignments(user: AuthenticatedUser, draft_id: str, task_keys: list[str]) -> list[dict[str, Any]]:
    draft, participants = _authorized_draft(user, draft_id)
    revision_id = draft.get("current_revision_id")
    revision_rows = _rows("proposal_collaboration_revisions", "snapshot").eq("id", revision_id).limit(1).execute().data or []
    snapshot = (revision_rows[0].get("snapshot") if revision_rows else draft.get("working_snapshot")) or {}
    tasks = [task for task in snapshot.get("tasks", []) if task.get("enabled", True) and (not task_keys or task.get("key") in task_keys)]
    candidates = _candidate_context(participants)
    if not tasks or not candidates:
        return []
    prompt = {
        "instruction": "Recommend a justified mixed team for each task. Do not invent IDs. Strongly avoid candidates where is_overloaded is true whenever lighter-loaded eligible candidates exist. Prefer skill fit, then lower load_points, workload, and burnout. A task may be solo or use every eligible candidate when genuinely necessary. Return only JSON with recommendations containing taskKey, employeeId, recommendationScore 0-100, fitReason, workload, recommendedRole lead|support, organizationId.",
        "tasks": tasks,
        "candidates": candidates,
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(settings.ai_timeout_seconds, connect=10.0)) as client:
            response = await client.post(
                f"{settings.internal_ai_base_url}/chat",
                headers={"Authorization": f"Bearer {internal_ai_key.get()}", "X-eFlow-User-Id": user.id},
                json={"model": "deepseek-r1:8b", "stream": False, "messages": [{"role": "user", "content": json.dumps(prompt)}]},
            )
            response.raise_for_status()
            payload = response.json()
            content = payload.get("message", {}).get("content") or payload.get("response") or ""
            parsed = _extract_json(content)
            proposed = parsed.get("recommendations", []) if parsed else []
            eligible_ids = {candidate["employee_id"] for candidate in candidates}
            safe = [item for item in proposed if str(item.get("employeeId")) in eligible_ids and any(task.get("key") == item.get("taskKey") for task in tasks)]
            if safe:
                candidate_by_id = {candidate["employee_id"]: candidate for candidate in candidates}
                return [{
                    "taskKey": str(item.get("taskKey")),
                    "employeeId": str(item.get("employeeId")),
                    "organizationId": candidate_by_id[str(item.get("employeeId"))]["organization_id"],
                    "recommendationScore": max(0, min(100, int(item.get("recommendationScore", 0)))),
                    "fitReason": str(item.get("fitReason") or "AI-ranked from eligible staffing information.")[:500],
                    "workload": candidate_by_id[str(item.get("employeeId"))]["workload"],
                    "recommendedRole": "lead" if item.get("recommendedRole") == "lead" else "support",
                } for item in safe]
    except Exception:
        pass
    return _deterministic_recommendations(tasks, candidates)
