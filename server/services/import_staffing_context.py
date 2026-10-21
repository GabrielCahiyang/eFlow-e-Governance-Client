"""Verified staffing context for not-yet-published PDF tasks."""
from fastapi import HTTPException
from gateway_dependencies import supabase_admin
from invitations.service import require_head
from services.staffing_context import compact_profile, workload_for, ACTIVE


def build_import_staffing_context(project_id, draft, user):
    require_head(user)
    # The service-only RPC checks the current appointed Head and open project.
    people = supabase_admin.rpc('pdf_import_available_people', {'p_project': project_id, 'p_actor': user.id}).execute().data or []
    ids = [p['id'] for p in people]
    if len(ids) > 200:
        raise HTTPException(409, 'The available directory exceeds 200 people.')
    professional = supabase_admin.table('user_professional_profiles').select('user_id,skills,education,trainings,certifications,work_experience,specializations,competency_summary').in_('user_id', ids).eq('confirmed_by_user', True).execute().data if ids else []
    profiles = {p['user_id']: p for p in professional or []}
    work = []
    for offset in range(0, 10000, 500):
        batch = supabase_admin.table('tasks').select('id,assigned_to,recommendation_lead_id,team_member_ids,status,estimated_hours,percent_complete').eq('org_id', user.org_id).is_('deleted_at', 'null').is_('archived_at', 'null').in_('status', list(ACTIVE)).range(offset, offset + 499).execute().data or []
        work.extend(batch)
        if len(batch) < 500:
            break
    else:
        raise HTTPException(503, 'Workload is too large to summarize safely.')
    candidates = []
    planned = draft.get('plannedAssignments') or []
    if not isinstance(planned, list) or len(planned) > 100:
        raise HTTPException(422, 'Invalid planned workload.')
    for person in people:
        workload = workload_for(person['id'], work)
        for item in planned:
            if not isinstance(item, dict) or not isinstance(item.get('hours', 0), (int, float)) or not 0 <= item.get('hours', 0) <= 10000:
                raise HTTPException(422, 'Invalid planned workload.')
            if item.get('lead') == person['id']:
                workload['activeTasks'] += 1
                workload['remainingHours'] += item.get('hours', 0)
        profile = profiles.get(person['id'], {})
        candidates.append({'id': person['id'], 'name': person['full_name'], **compact_profile(profile), **workload,
                           **({} if profile else {'experience_summary': 'Professional details unconfirmed. Match using known workload; do not invent skills.'})})
    return {'task': {'id': project_id, 'title': draft['title'], 'description': draft.get('description', '')[:3000], 'skills': [], 'estimatedHours': draft.get('estimatedHours', 0)},
            'candidates': candidates, 'excludedUnconfirmed': 0}
