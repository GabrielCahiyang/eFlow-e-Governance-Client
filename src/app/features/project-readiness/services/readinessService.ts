import { supabase } from '../../../../lib/supabase';
import type { ProjectReadiness, CloseoutSummary, ReviewKind } from '../types';
import { notifyProjectListeners } from '../../projects';
async function readinessRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === 'PGRST202' ? 'Readiness checks are not installed yet. Contact your administrator.' : error.message);
  return data as T;
}
export const fetchReadiness = (projectId: string) => readinessRpc<ProjectReadiness>('phase7_project_readiness', {p_project: projectId});
export const fetchCloseoutSummary = (projectId: string) => readinessRpc<CloseoutSummary>('phase7_closeout_summary', {p_project: projectId});
export const reviewProject = (projectId: string, kind: ReviewKind) => readinessRpc<void>('phase7_review_project', {p_project: projectId, p_kind: kind});
export async function activateReadyProject(projectId: string) {
  await readinessRpc<void>('phase7_activate_project', {p_project: projectId});
  await notifyProjectListeners();
}
export async function publishReadyProject(projectId: string) {
  await readinessRpc<void>('publish_project', {p_project:projectId});
  await notifyProjectListeners();
}
