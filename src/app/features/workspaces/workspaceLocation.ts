import { pushNavigationHistory, replaceNavigationHistory } from '../../shared/navigationHistory';
import {destinationNavigationParameters,getNavigationSectionFromPath,navigationDisplayKeys} from '../navigation';

export const WORKSPACE_QUERY = 'workspace';
const key = (user: string) => `eflow:workspaces:v1:${user}`;
export function readWorkspacePreference(user: string): { current?: string; recent: string[] } {
  try {
    const stored = JSON.parse(localStorage.getItem(key(user)) || '{}');
    return { current: typeof stored.current === 'string' ? stored.current : undefined, recent: Array.isArray(stored.recent) ? stored.recent.filter((id: unknown) => typeof id === 'string').slice(0,5) : [] };
  } catch { return { recent: [] }; }
}
export function saveWorkspacePreference(user: string, id: string) {
  const { recent } = readWorkspacePreference(user);
  try { localStorage.setItem(key(user),JSON.stringify({ current: id, recent: [id,...recent.filter(item => item !== id)].slice(0,5) })); } catch { /* Selection still works without browser storage. */ }
}
export interface WorkspaceDestination { pathname: string; page: string; project?: string; view?: string;parameters?:Record<string,string>;isCurrent?:()=>boolean }
export function writeWorkspaceLocation(id: string, switchContext = true, mode: 'push' | 'replace' = 'push', destination?: WorkspaceDestination) {
  const url = new URL(window.location.href);
  url.searchParams.set(WORKSPACE_QUERY,id);
  if (switchContext) {
    url.pathname='/projects'; url.searchParams.set('page','Projects');
    for (const key of [...navigationDisplayKeys.filter(key=>key!=='workspace'),'task','subtask','proposal']) url.searchParams.delete(key);
    url.hash='';
  }
  if(destination){url.pathname=destination.pathname;url.searchParams.set('page',destination.page);if(destination.project)url.searchParams.set('project',destination.project);if(destination.view)url.searchParams.set('view',destination.view);}
  for(const [key,value] of Object.entries(destinationNavigationParameters(getNavigationSectionFromPath(url.pathname)||'',destination?.parameters,destination?.page)))if(key!==WORKSPACE_QUERY)url.searchParams.set(key,value);
  (mode === 'push' ? pushNavigationHistory : replaceNavigationHistory)(`${url.pathname}${url.search}${url.hash}`);
}
