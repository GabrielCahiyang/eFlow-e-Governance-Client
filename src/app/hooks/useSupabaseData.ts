import { isAdminRole } from "../shared/roles";
// ─── Supabase Realtime Data Hooks ────────────────────────────────
// Wraps supabaseService subscriptions into clean React hooks.

import { useState, useEffect, useMemo } from 'react';
import {
  fetchAllOrgs,
  fetchAllProfiles,
  subscribeToOrgs,
  subscribeToProfiles,
  getDescendantOrgIds,
} from '../../lib/supabaseService';
import { subscribeToProjects, type Project } from '../services/projectService';
import { subscribeToTasks, type Task } from '../services/taskService';
import { operationalMetrics } from '../services/taskSelectors';
import { useAuth } from '../contexts/AuthContext';
import type { Organization, UserProfile, DashboardMetrics } from '../types';

// ─── useOrgs ─────────────────────────────────────────────────────
export function useOrgs() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAllOrgs()
      .then((data) => {
        if (!cancelled) {
          setOrgs(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = subscribeToOrgs((data) => {
      if (!cancelled) setOrgs(data);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { orgs, loading };
}

// ─── useProfiles ─────────────────────────────────────────────────
export function useProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAllProfiles()
      .then((data) => {
        if (!cancelled) {
          setProfiles(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = subscribeToProfiles((data) => {
      if (!cancelled) setProfiles(data);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { profiles, loading };
}

// ─── useTasksData ────────────────────────────────────────────────
// Realtime operational tasks (deleted rows already excluded server-side).
export function useTasksData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeToTasks((data) => {
      if (cancelled) return;
      setTasks(data);
      setLoading(false);
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  return { tasks, loading, error, setError };
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
export function useProjectsData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeToProjects((data) => {
      if (!cancelled) {
        setProjects(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  return { projects, loading };
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
