import { supabase } from '../../../../lib/supabase';
import { fetchProjectOffices } from './projectOfficeService';
import { withSupabaseSessionRetry } from '../../../shared/supabaseSession';
/** Checked reads supplement the UI; phase6_set_members remains the final authority. */
export async function readStaffingAuthority(projectId: string, officeId: string, actorId: string) {
  const state = await fetchProjectOffices(projectId);
  const office = state.offices.find(o => o.id === officeId);
  if (!office) throw new Error('This Office participation is no longer available.');
  const [project, organization, actor] = await Promise.all([
    withSupabaseSessionRetry(() => supabase.from('projects').select('status,source_collaboration_draft_id').eq('id', projectId).maybeSingle()),
    withSupabaseSessionRetry(() => supabase.from('organizations').select('head_user_id').eq('id', office.office_id).maybeSingle()),
    withSupabaseSessionRetry(() => supabase.from('profiles').select('role,is_active,org_id').eq('id', actorId).maybeSingle()),
  ]);
  for (const result of [project, organization, actor]) if (result.error) throw new Error(result.error.message);
  if (!project.data || ['completed','archived'].includes(project.data.status) || project.data.source_collaboration_draft_id) throw new Error('Project is closed or governed. Reopen its current participation workflow.');
  if (office.relationship_type === 'observer' || office.invitation_status !== 'joined') throw new Error('Only joined, non-observer Offices can select project members.');
  if (!actor.data?.is_active || actor.data.role !== 'head' || actor.data.org_id !== office.office_id || organization.data?.head_user_id !== actorId) throw new Error('Only the current appointed Head of this Office can select project members.');
  return state.members.filter(m => m.project_office_id === officeId).map(m => m.user_id);
}
