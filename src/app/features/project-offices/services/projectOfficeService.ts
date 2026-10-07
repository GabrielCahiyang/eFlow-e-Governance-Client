import { supabase } from '../../../../lib/supabase';
import { jsonRequest, phase2Request } from '../../../shared/phase2Api';
import { withSupabaseSessionRetry } from '../../../shared/supabaseSession';
import { notifyTaskListeners } from '../../tasks';
import type { Invitation } from '../../invitations';
import type { OfficeProposal, ProjectOffice, ProjectOfficeMember } from '../types';
import { readOfficeInvitationHistory } from './officeInvitationHistory';

export async function fetchProjectOffices(projectId: string) {
  const { data, error } = await withSupabaseSessionRetry(() => supabase.from('project_offices').select('*').eq('project_id', projectId).order('created_at'));
  if (error) throw new Error(error.message);
  const offices = (data || []) as ProjectOffice[];
  if (!offices.length) return { offices, members: [] as ProjectOfficeMember[] };
  const membership = await withSupabaseSessionRetry(() => supabase.from('project_office_members').select('project_office_id,user_id').in('project_office_id', offices.map(o => o.id)));
  if (membership.error) throw new Error(membership.error.message);
  return { offices, members: (membership.data || []) as ProjectOfficeMember[] };
}
export const inviteProjectOffice = (projectId: string, officeId: string, email: string, access: 'collaborating' | 'observer') =>
  phase2Request<Invitation>('/invitations/project-office', jsonRequest('POST', { project_id: projectId, office_id: officeId, email, access }));
export const projectOfficeInvitations = (projectId: string) => readOfficeInvitationHistory(projectId, 'project_office');
export async function confirmProjectOffice(id: string) {
  const { error } = await withSupabaseSessionRetry(() => supabase.rpc('phase6_confirm_office', { p_id: id }));
  if (error) throw new Error(error.message);
}
export async function withdrawProjectOffice(id: string) {
  const { error } = await withSupabaseSessionRetry(() => supabase.rpc('phase6_withdraw_office_invitation', { p_id: id }));
  if (error) throw new Error(error.message);
}
export async function selectProjectOfficeMembers(id: string, users: string[]) {
  const { error } = await withSupabaseSessionRetry(() => supabase.rpc('phase6_set_members', { p_id: id, p_users: users }));
  if (error) throw new Error(error.message);
}
export async function setResponsibleOffice(task: string, office: string) {
  const { error } = await withSupabaseSessionRetry(() => supabase.rpc('phase6_responsible_office', { p_task: task, p_office: office }));
  if (error) throw new Error(error.message);
  await notifyTaskListeners();
}
export async function moveProjectOfficeTask(task: string, group: string, position: number) {
  const { error } = await withSupabaseSessionRetry(() => supabase.rpc('phase6_move_task', { p_task: task, p_group: group, p_position: position }));
  if (error) throw new Error(error.message);
  await notifyTaskListeners();
}
export async function fetchConfirmedOfficeProposals(projectId: string): Promise<OfficeProposal[]> {
  const { data, error } = await withSupabaseSessionRetry(() => supabase.from('project_import_batches').select('review').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50));
  if (error) throw new Error(error.message);
  const found = new Map<string, OfficeProposal>();
  for (const row of data || []) for (const o of (row.review?.offices || [])) {
    if (o.confirmed && typeof o.name === 'string' && typeof o.officeId === 'string' && !found.has(o.officeId || o.name)) found.set(o.officeId || o.name, { name: o.name, officeId: o.officeId, evidence: o.evidence || '' });
  }
  return [...found.values()];
}
