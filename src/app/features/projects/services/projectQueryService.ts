import {readAllRows} from '../../../shared/readAllRows';
import { supabase } from '../../../../lib/supabase';
import { rowToProject } from './projectMappers';
import type { Project } from './types';
import { registerAuthCacheReset } from '../../../shared/authCacheReset';
import { registerExternalMemoryCache } from '../../../shared/queryCache';

const projectListeners = new Set<(projects: Project[]) => void>();
const projectErrorListeners=new Set<(error:Error)=>void>();
// Keep the latest project snapshot in memory so navigating away from and back
// to Plans & Projects does not blank the workspace while the same query runs
// again. Realtime events still invalidate and refresh this snapshot.
const PROJECT_CACHE_TTL_MS = 30_000;
const DUE_ACTIVATION_SYNC_COOLDOWN_MS = 60_000;
let projectCache: Project[] | null = null;
let projectCacheUpdatedAt = 0;
let lastDueActivationSyncAt = 0;
let projectLoadPromise: Promise<Project[]> | null = null;
let projectRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let projectSetupWindowListener: (() => void) | null = null;
let cacheGeneration = 0;
export function getCachedProjects(): Project[] | null { return projectCache; }
registerExternalMemoryCache('projects','Projects',()=>{++cacheGeneration;projectCache=null;projectCacheUpdatedAt=0;lastDueActivationSyncAt=0;projectLoadPromise=null;if(projectListeners.size>0)void notifyProjectListeners();},()=>({domain:'projects',entries:projectCache?1:0,approxBytes:projectCache?projectCache.length*480:0}));
registerAuthCacheReset(() => {
  ++cacheGeneration;
  projectCache = null; projectCacheUpdatedAt = 0; lastDueActivationSyncAt = 0; projectLoadPromise = null;
  projectListeners.forEach(callback => callback([]));
  if (projectRealtimeChannel) void supabase.removeChannel(projectRealtimeChannel);
  projectRealtimeChannel = null;
  if (projectSetupWindowListener && typeof window !== 'undefined') {
    window.removeEventListener('eflow:project-setup', projectSetupWindowListener);
    projectSetupWindowListener = null;
  }
});

async function maybeSyncDueProjectActivations(): Promise<void> {
  const now = Date.now();
  if (now - lastDueActivationSyncAt < DUE_ACTIVATION_SYNC_COOLDOWN_MS) return;
  lastDueActivationSyncAt = now;
  try {
    if (typeof supabase.rpc === 'function') {
      await supabase.rpc('sync_due_project_activations', {});
    }
  } catch {
    // Non-blocking: pg_cron also handles due activations every minute.
  }
}

export const PROJECTS_BROADCAST_EVENT = 'eflow:projects-broadcast';

function broadcastProjects(projects: Project[]) {
  projectCache = projects;
  projectCacheUpdatedAt = Date.now();
  projectListeners.forEach((callback) => {
    try { callback(projects); } catch (error) { console.error(error); }
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<Project[]>(PROJECTS_BROADCAST_EVENT, { detail: projects }));
}

async function fetchCompleteProjects():Promise<Project[]>{
 const data=await readAllRows<Record<string,unknown>>((from,to)=>supabase.from('projects').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:true}).range(from,to));return data.map(rowToProject);
}
export async function fetchAllProjects():Promise<Project[]>{
 try{return await fetchCompleteProjects();}catch(error){console.error('Failed to fetch projects:',error);return [];}
}

export async function notifyProjectListeners() {
  if (projectLoadPromise) return projectLoadPromise;
  const generation = cacheGeneration;
  projectLoadPromise = fetchCompleteProjects()
    .then((projects) => {
      if (generation === cacheGeneration) broadcastProjects(projects);
      return projects;
    })
    .catch((error) => {
      console.error('Failed to refresh projects:', error);
      if(generation===cacheGeneration)projectErrorListeners.forEach(callback=>callback(error instanceof Error?error:new Error('Project facts unavailable.')));
      return projectCache || [];
    })
    .finally(() => { if (generation === cacheGeneration) projectLoadPromise = null; });
  return projectLoadPromise;
}

export function subscribeToProjects(callback: (projects: Project[]) => void,onError?:(error:Error)=>void): () => void {
  if(onError)projectErrorListeners.add(onError);
  projectListeners.add(callback);

  if (projectCache) callback(projectCache);
  if (!projectCache || Date.now() - projectCacheUpdatedAt > PROJECT_CACHE_TTL_MS) {
    void maybeSyncDueProjectActivations().finally(() => void notifyProjectListeners());
  }

  if (!projectSetupWindowListener && typeof window !== 'undefined') {
    projectSetupWindowListener = () => {
      void notifyProjectListeners();
    };
    window.addEventListener('eflow:project-setup', projectSetupWindowListener);
  }

  // Share one realtime channel across all consumers. The channel remains
  // active while the feature is mounted, while the snapshot survives page
  // switches for instant rehydration.
  if (!projectRealtimeChannel) {
    projectRealtimeChannel = supabase
      .channel('projects-changes-shared')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => void notifyProjectListeners())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_offices' }, () => void notifyProjectListeners())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_office_members' }, () => void notifyProjectListeners())
      .subscribe();
  }

  return () => {
    projectListeners.delete(callback);
    if(onError)projectErrorListeners.delete(onError);
    if (projectListeners.size === 0 && projectRealtimeChannel) {
      void supabase.removeChannel(projectRealtimeChannel);
      projectRealtimeChannel = null;
    }
    if (projectListeners.size === 0 && projectSetupWindowListener && typeof window !== 'undefined') {
      window.removeEventListener('eflow:project-setup', projectSetupWindowListener);
      projectSetupWindowListener = null;
    }
  };
}

// ─── createProject ───────────────────────────────────────────────
