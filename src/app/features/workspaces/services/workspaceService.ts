import { supabase } from '../../../../lib/supabase';
import { userFacingError } from '../../../shared/userFacingError';
import type { PersonalCommand, PersonalProject, PersonalSnapshot, Workspace, WorkspaceSnapshot } from '../types';

export class WorkspaceApiUnavailable extends Error {}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error, status } = await supabase.rpc(name, args);
  if (error) {
    if (['PGRST202','42883'].includes(error.code)) throw new WorkspaceApiUnavailable('Personal workspaces are awaiting the R3 server migration.');
    throw Object.assign(new Error(userFacingError(error, 'Could not load workspace.')), { code: error.code, status });
  }
  return data as T;
}
let inFlightWorkspaces: Promise<Workspace[]> | null = null;
const inFlightSelections = new Map<string, Promise<WorkspaceSnapshot>>();

export function listWorkspaces(): Promise<Workspace[]> {
  if (inFlightWorkspaces) return inFlightWorkspaces;
  const request = (async () => {
    const data = await rpc<Workspace[]>('r3_list_workspaces');
    if (!Array.isArray(data) || data.some(w => !w.id || !w.name || !['office','personal'].includes(w.kind))) throw new Error('Invalid workspace response.');
    return data;
  })().finally(() => {
    if (inFlightWorkspaces === request) inFlightWorkspaces = null;
  });
  inFlightWorkspaces = request;
  return request;
}
export function selectWorkspace(id: string): Promise<WorkspaceSnapshot> {
  const existing = inFlightSelections.get(id);
  if (existing) return existing;
  const request = (async () => {
    const data = await rpc<WorkspaceSnapshot>('r3_select_workspace', { p_workspace: id });
    if (data?.workspace?.id !== id || !Array.isArray(data.projects)) throw new Error('Invalid workspace selection response.');
    return data;
  })().finally(() => {
    if (inFlightSelections.get(id) === request) inFlightSelections.delete(id);
  });
  inFlightSelections.set(id, request);
  return request;
}
export const createWorkspace = (request: string, name: string, timezone: string) => rpc<Workspace>('r3_create_workspace', { p_request: request, p_name: name, p_timezone: timezone });
export const createPersonalProject = (workspace: string, request: string, title: string) => rpc<PersonalProject>('r3_create_personal_project', { p_workspace: workspace, p_request: request, p_title: title });
export async function fetchPersonalProject(project: string): Promise<PersonalSnapshot> {
  const data = await rpc<PersonalSnapshot>('r3_personal_project_snapshot', { p_project: project });
  if (data?.project?.id !== project || !Array.isArray(data.tasks) || !Array.isArray(data.members)) throw new Error('Invalid personal project response.');
  return data;
}
export const fetchPersonalCandidates = (project: string) => rpc<{ id: string; name: string }[]>('r3_personal_member_candidates', { p_project: project });
export const personalCommand = (project: string, command: PersonalCommand, payload: Record<string, unknown>, request: string) => rpc<Record<string, unknown>>('r3_personal_project_command', { p_project: project, p_command: command, p_payload: payload, p_request: request });
