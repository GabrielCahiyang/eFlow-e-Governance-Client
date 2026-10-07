"""Confirmed professional summaries only; task authority defines candidate scope."""
from fastapi import HTTPException
from gateway_dependencies import supabase_admin
from invitations.service import require_head

ACTIVE = {'pending_assignment', 'todo', 'in_progress', 'for_review', 'changes_requested'}

def workload_for(user_id, tasks):
    owned = [t for t in tasks if t.get('status') in ACTIVE and
             user_id in {t.get('assigned_to'), t.get('recommendation_lead_id'), *(t.get('team_member_ids') or [])}]
    known = [t for t in owned if t.get('estimated_hours') is not None and float(t.get('estimated_hours') or 0) > 0]
    remaining = sum(float(t['estimated_hours']) * (1 - max(0, min(100, t.get('percent_complete') or 0)) / 100) for t in known)
    return {'activeTasks': len(owned), 'remainingHours': round(remaining, 1), 'unknownEffortTasks': len(owned) - len(known)}

def compact_profile(profile):
    def items(key, cap):
        return [str(v)[:180] for v in (profile.get(key) or [])[:cap]]
    return {'skills': items('skills', 15), 'training': items('trainings', 8),
            'education': items('education', 5), 'experience': items('work_experience', 8),
            'specializations': items('specializations', 8), 'certifications': items('certifications', 5),
            'experience_summary': str(profile.get('competency_summary') or '')[:700]}

def build_staffing_context(task_id, user):
    require_head(user)
    rows = supabase_admin.table('tasks').select('id,title,description,tags,org_id,linked_project_id,status,assigned_to,deleted_at,archived_at,estimated_hours,proposed_office_identity_id').eq('id', task_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(404, 'Task not found.')
    task = rows[0]
    if task.get('org_id') != user.org_id or task.get('deleted_at') or task.get('archived_at') or task['status'] not in ('pending_assignment', 'todo') or task.get('assigned_to'):
        raise HTTPException(403, 'Recommend staff only for unassigned, unstarted work in your own Office.')
    if task.get('proposed_office_identity_id'):
        raise HTTPException(409, 'Resolve proposed Office responsibility before recommending staff.')
    if not supabase_admin.rpc('can_manage_task', {'target_task': task_id, 'caller_id': user.id}).execute().data:
        raise HTTPException(403, 'Your Office must join this project before recommending its staff.')
    project_id = task.get('linked_project_id')
    office = None
    if project_id:
        project = supabase_admin.table('projects').select('status').eq('id', project_id).single().execute().data
        if project['status'] in ('completed', 'archived'):
            raise HTTPException(409, 'Closed project work is read-only.')
        office_rows = supabase_admin.table('project_offices').select('id,relationship_type,invitation_status').eq('project_id', project_id).eq('office_id', user.org_id).limit(1).execute().data or []
        office = office_rows[0] if office_rows else None
    profiles = supabase_admin.table('profiles').select('id,full_name').eq('org_id', user.org_id).eq('is_active', True).neq('role', 'admin').execute().data or []
    if office and office['relationship_type'] != 'lead':
        if office['relationship_type'] == 'observer' or office['invitation_status'] != 'joined':
            raise HTTPException(403, 'Observer or pending Offices cannot recommend staff.')
        selected = supabase_admin.table('project_office_members').select('user_id').eq('project_office_id', office['id']).execute().data or []
        allowed = {r['user_id'] for r in selected} | {user.id}
        profiles = [p for p in profiles if p['id'] in allowed]
    ids = [p['id'] for p in profiles]
    if not ids:
        return {'task': task, 'candidates': [], 'excludedUnconfirmed': 0}
    professional = supabase_admin.table('user_professional_profiles').select('user_id,skills,education,trainings,certifications,work_experience,specializations,competency_summary').in_('user_id', ids).eq('confirmed_by_user', True).execute().data or []
    # Page through active Office work instead of silently truncating workload.
    work = []; offset = 0
    while True:
        batch = supabase_admin.table('tasks').select('id,assigned_to,recommendation_lead_id,team_member_ids,status,estimated_hours,percent_complete').eq('org_id', user.org_id).is_('deleted_at', 'null').is_('archived_at', 'null').in_('status', list(ACTIVE)).range(offset, offset + 499).execute().data or []
        work.extend(batch)
        if len(batch) < 500: break
        offset += 500
        if offset >= 10000: raise HTTPException(503, 'Office workload is too large to summarize safely. Narrow the active workload first.')
    names = {p['id']: p['full_name'] for p in profiles}
    candidates = [{'id': p['user_id'], 'name': names[p['user_id']], **compact_profile(p), **workload_for(p['user_id'], work)} for p in professional]
    if len(candidates) > 200:
        raise HTTPException(409, 'Select a smaller project team before requesting staffing recommendations.')
    return {'task': {'id': task['id'], 'title': task['title'], 'description': (task.get('description') or '')[:3000], 'skills': task.get('tags') or [], 'estimatedHours': task.get('estimated_hours')},
            'candidates': candidates, 'excludedUnconfirmed': len(profiles) - len(candidates)}
