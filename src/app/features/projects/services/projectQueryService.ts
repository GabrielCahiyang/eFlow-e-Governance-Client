import { supabase } from '../../../../lib/supabase';
import { rowToProject } from './projectMappers';
import type { Project } from './types';

const projectListeners = new Set<(projects: Project[]) => void>();
// Keep the latest project snapshot in memory so navigating away from and back
// to Plans & Projects does not blank the workspace while the same query runs
// again. Realtime events still invalidate and refresh this snapshot.
const PROJECT_CACHE_TTL_MS = 30_000;
let projectCache: Project[] | null = null;
let projectCacheUpdatedAt = 0;
let projectLoadPromise: Promise<Project[]> | null = null;
let projectRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function broadcastProjects(projects: Project[]) {
  projectCache = projects;
  projectCacheUpdatedAt = Date.now();
  projectListeners.forEach((callback) => {
    try { callback(projects); } catch (error) { console.error(error); }
  });
}

export async function fetchAllProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    // Table may not exist yet (migration not applied) — degrade gracefully.
    if (error.code === '42P01') return [];
    console.error('Failed to fetch projects:', error);
    return [];
  }
  return (data || []).map(rowToProject);
}

export async function notifyProjectListeners() {
  if (projectLoadPromise) return projectLoadPromise;
  projectLoadPromise = fetchAllProjects()
    .then((projects) => {
      broadcastProjects(projects);
      return projects;
    })
    .catch((error) => {
      console.error('Failed to refresh projects:', error);
      return projectCache || [];
    })
    .finally(() => { projectLoadPromise = null; });
  return projectLoadPromise;
}

export function subscribeToProjects(callback: (projects: Project[]) => void): () => void {
  projectListeners.add(callback);

  if (projectCache) callback(projectCache);
  if (!projectCache || Date.now() - projectCacheUpdatedAt > PROJECT_CACHE_TTL_MS) {
    void notifyProjectListeners();
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
    if (projectListeners.size === 0 && projectRealtimeChannel) {
      void supabase.removeChannel(projectRealtimeChannel);
      projectRealtimeChannel = null;
    }
  };
}

// ─── createProject ───────────────────────────────────────────────
