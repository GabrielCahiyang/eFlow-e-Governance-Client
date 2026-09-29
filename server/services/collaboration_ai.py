"""Private cross-organization staffing intelligence for collaboration drafts.

Raw manager notes are loaded with the server-side Supabase client and are never
returned to the browser. Only bounded scores and short fit explanations leave
this module.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from gateway_config import settings
from gateway_dependencies import AuthenticatedUser, internal_ai_key, supabase_admin
from services.deadline_workload import deadline_workload_signal


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
        and user.role in {"dept_head", "department_head", "assistant_head"}
    )
    if user.role == "super_admin" or (not owner and not owner_org_manager):
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
        .neq("role", "super_admin")
        .execute().data or []
    )
    ids = [str(profile["id"]) for profile in profiles]
    notes = _rows("employee_notes", "profile_id,strengths,weaknesses,notes,tags").in_("profile_id", ids).execute().data or [] if ids else []
    note_by_id = {str(note["profile_id"]): note for note in notes}
    active_tasks = (
        _rows("tasks", "assigned_to,team_member_ids,status,deadline,due_date,estimated_hours,percent_complete,archived_at,deleted_at")
        .in_("status", ["pending_assignment", "todo", "in_progress", "for_review", "changes_requested"])
        .execute().data or []
    )
    result: list[dict[str, Any]] = []
    for profile in profiles:
        candidate_id = str(profile["id"])
        intelligence = note_by_id.get(candidate_id, {})
        result.append({
            "employee_id": candidate_id,
            "name": profile.get("full_name"),
            "organization_id": str(profile.get("org_id")),
            "role": profile.get("role"),
            "skills": [key for key, enabled in (profile.get("skills") or {}).items() if enabled],
            "workload": deadline_workload_signal(active_tasks, candidate_id),
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
            score = round(max(0, min(100, 55 + match * 35 - workload * 0.25)))
            ranked.append((score, candidate))
        ranked.sort(key=lambda item: (-item[0], item[1]["workload"], item[1]["name"] or ""))
        # Do not impose an arbitrary team-size ceiling. A genuinely broad LGU
        # task may need every suitable participating office, while a focused
        # task may remain a one-person assignment. The manager still approves
        # the proposal before any assignment becomes operational.
        selected = [item for item in ranked if item[0] >= 60]
        if not selected and ranked:
            selected = [ranked[0]]
        for index, (score, candidate) in enumerate(selected):
            recommendations.append({
                "taskKey": task.get("key"),
                "employeeId": candidate["employee_id"],
                "organizationId": candidate["organization_id"],
                "recommendationScore": score,
                "fitReason": f"Balanced skill fit and {candidate['workload']}% current workload signal.",
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
        "instruction": "Recommend a justified mixed team for each task. Do not invent IDs. Prefer skill fit, then lower workload and burnout. A task may be solo or use every eligible candidate when genuinely necessary. Return only JSON with recommendations containing taskKey, employeeId, recommendationScore 0-100, fitReason, workload, recommendedRole lead|support, organizationId.",
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
