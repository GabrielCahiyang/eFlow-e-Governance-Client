import { isAdminRole } from "../shared/roles";
// ─── Supabase Realtime Data Hooks ────────────────────────────────
// Wraps supabaseService subscriptions into clean React hooks.

import { useState, useEffect, useMemo } from 'react';
import * as supabaseServiceModule from '../../lib/supabaseService';
import {
  fetchAllOrgs,
  fetchAllProfiles,
  subscribeToOrgs,
  subscribeToProfiles,
  getDescendantOrgIds,
} from '../../lib/supabaseService';
import * as projectServiceModule from '../services/projectService';
import {
  subscribeToProjects,
  notifyProjectListeners,
  type Project,
} from '../services/projectService';
import * as taskServiceModule from '../services/taskService';
import {
  subscribeToTasks,
  type Task,
} from '../services/taskService';
import { operationalMetrics } from '../services/taskSelectors';
import { useAuth } from '../contexts/AuthContext';
import type { Organization, UserProfile, DashboardMetrics } from '../types';

function readOrgsCache(): Organization[] | undefined {
  try {
    return typeof supabaseServiceModule.getCachedOrgs === 'function'
      ? supabaseServiceModule.getCachedOrgs()
      : undefined;
  } catch {
    return undefined;
  }
}

function readProfilesCache(): UserProfile[] | undefined {
  try {
    return typeof supabaseServiceModule.getCachedProfiles === 'function'
      ? supabaseServiceModule.getCachedProfiles()
      : undefined;
  } catch {
    return undefined;
  }
}

function readProjectsCache(): Project[] | null {
  try {
    return typeof projectServiceModule.getCachedProjects === 'function'
      ? projectServiceModule.getCachedProjects()
      : null;
  } catch {
    return null;
  }
}

function readTasksCache(): Task[] | null {
  try {
    return typeof taskServiceModule.getCachedTasks === 'function'
      ? taskServiceModule.getCachedTasks()
      : null;
  } catch {
    return null;
  }
}

// ─── useOrgs ─────────────────────────────────────────────────────
export function useOrgs() {
  const [orgs, setOrgs] = useState<Organization[]>(() => readOrgsCache() ?? []);
  const [loading, setLoading] = useState<boolean>(() => !readOrgsCache());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = readOrgsCache();
    if (cached) {
      setOrgs(cached);
      setLoading(false);
    }

    fetchAllOrgs()
      .then((data) => {
        if (!cancelled) {
          setOrgs(data);
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    const unsub = subscribeToOrgs((data) => {
      if (!cancelled) {
        setOrgs(data);
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { orgs, loading, refreshing };
}

// ─── useProfiles ─────────────────────────────────────────────────
export function useProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>(() => readProfilesCache() ?? []);
  const [loading, setLoading] = useState<boolean>(() => !readProfilesCache());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = readProfilesCache();
    if (cached) {
      setProfiles(cached);
      setLoading(false);
    }

    fetchAllProfiles()
      .then((data) => {
        if (!cancelled) {
          setProfiles(data);
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    const unsub = subscribeToProfiles((data) => {
      if (!cancelled) {
        setProfiles(data);
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { profiles, loading, refreshing };
}

// ─── useTasksData ────────────────────────────────────────────────
// Realtime operational tasks (deleted rows already excluded server-side).
export function useTasksData(enabled = true) {
  const [tasks, setTasks] = useState<Task[]>(() => (enabled ? readTasksCache() ?? [] : []));
  const [loading, setLoading] = useState<boolean>(() => Boolean(enabled && !readTasksCache()));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    let cancelled = false;
    const cached = readTasksCache();
    if (cached) {
      setTasks(cached);
      setLoading(false);
    }
    const unsub = subscribeToTasks(
      (data) => {
        if (cancelled) return;
        setTasks(data);
        setError(null);
        setLoading(false);
        setRefreshing(false);
      },
      (caught) => {
        if (!cancelled) {
          setError(caught);
          setLoading(false);
          setRefreshing(false);
        }
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [enabled]);

  return {
    tasks: enabled ? tasks : [],
    loading: enabled && loading,
    refreshing: enabled && refreshing,
    error: enabled ? error : null,
    setError,
    retry: () => {
      if (enabled) {
        if (readTasksCache() || tasks.length > 0) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        void import('../features/tasks')
          .then(({ notifyTaskListeners }) => notifyTaskListeners())
          .catch(() => {
            setLoading(false);
            setRefreshing(false);
            setError(new Error('Tasks could not be refreshed. Try again.'));
          });
      }
    },
  };
}

// ─── useDashboardMetrics ─────────────────────────────────────────
// System-wide metrics. Project/task counts are now derived from LIVE data via
// the shared selectors (previously hard-coded to 0, which showed false zeroes
// on the Admin dashboard even when data existed).
export function useDashboardMetrics(): { metrics: DashboardMetrics; loading: boolean } {
  const { profiles, loading: profilesLoading } = useProfiles();
  const { orgs, loading: orgsLoading } = useOrgs();
  const { projects, loading: projectsLoading } = useProjectsData();
  const { tasks, loading: tasksLoading } = useTasksData();

  const loading = profilesLoading || orgsLoading || projectsLoading || tasksLoading;

  const metrics: DashboardMetrics = useMemo(() => {
    const activeProfiles = profiles.filter((p) => p.is_active && !isAdminRole(p.role));
    const activeOrgs = orgs.filter((o) => o.is_active);
    const overloaded = activeProfiles.filter((p) => p.workload >= 80);
    const totalWorkload = activeProfiles.reduce((sum, p) => sum + p.workload, 0);
    const avgWorkload = activeProfiles.length > 0 ? Math.round(totalWorkload / activeProfiles.length) : 0;
    const deptHeads = activeProfiles.filter((p) => p.role === 'head');

    // Shared selectors — same definitions every other dashboard uses.
    const op = operationalMetrics(tasks, projects);

    return {
      totalUsers: activeProfiles.length,
      totalDepartments: activeOrgs.length,
      activeProjects: op.activeProjects,
      activeTasks: op.activeTasks,
      pendingTasks: op.unassignedTasks + op.inProgressTasks,
      completedTasks: op.completedTasks,
      departmentHeads: deptHeads.length,
      overloadedEmployees: overloaded.length,
      averageWorkload: avgWorkload,
    };
  }, [profiles, orgs, projects, tasks]);

  return { metrics, loading };
}

// ─── useProjectsData ─────────────────────────────────────────────
// Realtime operational projects. RLS already scopes what the server returns;
// this hook just wires the subscription into React.
export function useProjectsData(enabled = true) {
  const [projects, setProjects] = useState<Project[]>(() => (enabled ? readProjectsCache() ?? [] : []));
  const [loading, setLoading] = useState<boolean>(() => Boolean(enabled && !readProjectsCache()));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProjects([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    let cancelled = false;
    const cached = readProjectsCache();
    if (cached) {
      setProjects(cached);
      setLoading(false);
    }
    const unsub = subscribeToProjects(
      (data) => {
        if (!cancelled) {
          setProjects(data);
          setError(null);
          setLoading(false);
          setRefreshing(false);
        }
      },
      (reason) => {
        if (!cancelled) {
          setError(reason);
          setLoading(false);
          setRefreshing(false);
        }
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [enabled]);

  return {
    projects: enabled ? projects : [],
    loading: enabled && loading,
    refreshing: enabled && refreshing,
    error: enabled ? error : null,
    retry: () => {
      if (enabled) {
        if (readProjectsCache() || projects.length > 0) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        void notifyProjectListeners();
      }
    },
  };
}

// ─── useScopedOrgIds ─────────────────────────────────────────────
// The current user's org plus every descendant (their subtree). Empty array
// means "no scope filter" (e.g. admin) — callers treat empty as all.
export function useScopedOrgIds(): { scopedOrgIds: string[]; includeAllAccessibleWork: boolean; orgs: Organization[] } {
  const { orgs } = useOrgs();
  const { userProfile } = useAuth();
  const includeAllAccessibleWork = false;

  const scopedOrgIds = useMemo(() => {
    if (includeAllAccessibleWork) return [];
    return getDescendantOrgIds(orgs, userProfile?.org_id);
  }, [orgs, userProfile?.org_id, includeAllAccessibleWork]);

  return { scopedOrgIds, includeAllAccessibleWork, orgs };
}
