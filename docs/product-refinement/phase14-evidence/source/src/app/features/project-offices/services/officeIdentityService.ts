import { supabase } from '../../../../lib/supabase';
import { jsonRequest, phase2Request } from '../../../shared/phase2Api';
import { notifyTaskListeners } from '../../tasks';
import type { Invitation } from '../../invitations';
import type { OfficeIdentity, ProposedOfficeTask } from '../types';

async function identityRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === 'PGRST202' ? 'Project-local Office identities are not installed yet. Contact your administrator.' : error.message);
  return data as T;
}
export async function fetchOfficeIdentities(projectId: string): Promise<OfficeIdentity[]> {
  const { data, error } = await supabase.from('project_office_identities').select('*').eq('project_id', projectId).order('created_at');
  if (error) throw new Error(['PGRST205', '42P01'].includes(error.code) ? 'Project-local Office identities are not installed yet. Contact your administrator.' : error.message);
  return data || [];
}
export const saveOfficeIdentity = (projectId: string, id: string, name: string, evidence = '') =>
  identityRpc<OfficeIdentity>('phase65_save_office_identity', { p_project: projectId, p_id: id, p_name: name, p_evidence: evidence });
export const inviteOfficeIdentity = (id: string, email: string, access: 'collaborating' | 'observer') =>
  phase2Request<Invitation>('/invitations/v1/project-office-identity', jsonRequest('POST', { identity_id: id, email, access }));
export const identityInvitations = (projectId: string) =>
  phase2Request<{ invitations: Invitation[] }>(`/invitations/v1/project/${projectId}/office-identities`);
export const linkOfficeIdentity = (id: string, office: string) =>
  identityRpc<void>('phase65_link_office_identity', { p_identity: id, p_office: office });
export async function proposeTaskOffice(task: string, identity: string) {
  await identityRpc<void>('phase65_propose_task_office', { p_task: task, p_identity: identity });
  await Promise.allSettled([notifyTaskListeners()]);
}
export async function resolveTaskOffice(task: string) {
  await identityRpc<void>('phase65_resolve_task_office', { p_task: task });
  await Promise.allSettled([notifyTaskListeners()]);
}
export async function fetchProposedOfficeTasks(projectId: string): Promise<ProposedOfficeTask[]> {
  const { data, error } = await supabase.from('tasks').select('id,title,proposed_office_identity_id').eq('linked_project_id', projectId).not('proposed_office_identity_id', 'is', null).is('deleted_at', null).neq('status', 'cancelled');
  if (error) throw new Error(error.message);
  return data || [];
}
