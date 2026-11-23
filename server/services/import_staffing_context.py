"""Verified staffing context for not-yet-published PDF tasks."""
from fastapi import HTTPException
from gateway_dependencies import _permission_allowed, is_administrator, supabase_admin
from invitations.service import require_head
from services.staffing_context import compact_profile, ACTIVE, _workload_summary_note
from services.workload_scoring import (
    compute_member_workload,
    fetch_auxiliary_workload_rows,
    load_office_thresholds,
)


def build_import_staffing_context(project_id, draft, user):
    if user.role == 'head':
        require_head(user)
    elif is_administrator(user.role) or not user.org_id or not _permission_allowed(user, 'projects.create'):
        raise HTTPException(403, 'The projects.create capability is required for import staffing.')
    # The service-only RPC checks public.can_configure_project (Office Head or owning creator) and open project.
    try:
        people = supabase_admin.rpc('pdf_import_available_people', {'p_project': project_id, 'p_actor': user.id}).execute().data or []
    except Exception as exc:
        if '42501' in str(exc) or 'configuration access' in str(exc).lower():
            raise HTTPException(403, 'Project configuration access is required for import staffing.') from exc
        raise
    ids = [p['id'] for p in people]
    if len(ids) > 200:
        raise HTTPException(409, 'The available directory exceeds 200 people.')
    professional = supabase_admin.table('user_professional_profiles').select('user_id,skills,education,trainings,certifications,work_experience,specializations,competency_summary').in_('user_id', ids).eq('confirmed_by_user', True).execute().data if ids else []
    profiles = {p['user_id']: p for p in professional or []}
    work = []
    for offset in range(0, 10000, 500):
        batch = supabase_admin.table('tasks').select('id,assigned_to,recommendation_lead_id,team_member_ids,status,percent_complete,due_date,deadline,linked_project_id,archived_at,deleted_at').eq('org_id', user.org_id).is_('deleted_at', 'null').is_('archived_at', 'null').in_('status', list(ACTIVE)).range(offset, offset + 499).execute().data or []
        work.extend(batch)
        if len(batch) < 500:
            break
    else:
        raise HTTPException(503, 'Workload is too large to summarize safely.')
    thresholds = load_office_thresholds(supabase_admin, user.org_id)
    projects, subtasks = fetch_auxiliary_workload_rows(supabase_admin, ids, [user.org_id] if user.org_id else None)
    candidates = []
    planned = draft.get('plannedAssignments') or []
    if not isinstance(planned, list) or len(planned) > 100:
        raise HTTPException(422, 'Invalid planned workload.')
    for item in planned:
        if not isinstance(item, dict):
            raise HTTPException(422, 'Invalid planned workload.')
    for person in people:
        pid = person['id']
        planned_leads = sum(1 for item in planned if item.get('lead') == pid)
        planned_contribs = sum(
            1
            for item in planned
            if item.get('lead') != pid and pid in (item.get('contributors') or item.get('members') or [])
        )
        workload = compute_member_workload(
            pid,
            tasks=work,
            projects=projects,
            subtasks=subtasks,
            thresholds=thresholds,
            planned_task_leads=planned_leads,
            planned_task_contributors=planned_contribs,
        )
        profile = profiles.get(pid, {})
        compacted = compact_profile(profile)
        note = _workload_summary_note(workload)
        if profile:
            if workload['isOverloaded'] or workload['workloadTier'] == 'heavy':
                compacted['experience_summary'] = f"{compacted['experience_summary']} {note}".strip()[:700]
        else:
            compacted['experience_summary'] = (
                f"Professional details not confirmed. {note} Match using known workload; do not invent skills."
            )[:700]
        candidates.append({'id': pid, 'name': person['full_name'], **compacted, **workload})
    candidates.sort(key=lambda c: (bool(c.get('isOverloaded')), float(c.get('loadPoints', 0.0)), (c.get('name') or '').lower()))
    return {'task': {'id': project_id, 'title': draft['title'], 'description': draft.get('description', '')[:3000], 'skills': []},
            'candidates': candidates, 'excludedUnconfirmed': 0,
            'workloadPolicy': {'heavyPoints': thresholds['heavy_points'], 'overloadPoints': thresholds['overload_points'], 'avoidOverloaded': True}}
