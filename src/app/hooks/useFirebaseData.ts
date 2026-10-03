// ─── Realtime Data Hooks (now Supabase-backed) ──────────────────
// File kept at same path for import compatibility.
// All hooks now use Supabase under the hood.

import { useState, useEffect, useMemo } from 'react';
import { subscribeToTasks, type Task as OperationalTask } from '../services/taskService';
import { subscribeToProjects, type Project as OperationalProject } from '../services/projectService';
import { subscribeToEmployees } from '../services/employeeService';
import { subscribeToEmployeeNotes, EmployeeNotesMap } from '../services/employeeNotesService';
import { fetchAllProfiles, subscribeToProfiles, fetchAllOrgs, subscribeToOrgs } from '../../lib/supabaseService';
import type { UserProfile, Department, RoleDefinition, DashboardMetrics } from '../types';
import type { Employee } from '../services/employeeService';

// ─── useUsers ────────────────────────────────────────────────────
export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAllProfiles().then(data => {
      if (!cancelled) { setUsers(data); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    const unsub = subscribeToProfiles(data => { if (!cancelled) setUsers(data); });
    return () => { cancelled = true; unsub(); };
  }, []);

  return { users, loading };
}

// ─── useDepartments ──────────────────────────────────────────────
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const orgs = await fetchAllOrgs();
      if (cancelled) return;
      setDepartments(orgs.map(org => ({
        id: org.id,
        name: org.name,
        description: org.description || '',
        headUserId: org.head_user_id || '',
        employeeCount: 0,
        status: org.is_active ? 'active' : 'archived',
        createdAt: new Date(org.created_at).getTime(),
      })));
      setLoading(false);
    };
    load();
    const unsub = subscribeToOrgs(orgs => {
      if (cancelled) return;
      setDepartments(orgs.map(org => ({
        id: org.id,
        name: org.name,
        description: org.description || '',
        headUserId: org.head_user_id || '',
        employeeCount: 0,
        status: org.is_active ? 'active' : 'archived',
        createdAt: new Date(org.created_at).getTime(),
      })));
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  return { departments, loading };
}

// ─── useProjects ─────────────────────────────────────────────────
export function useProjects() {
  const [projects, setProjects] = useState<OperationalProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeToProjects((data) => {
      if (cancelled) return;
      setProjects(data);
      setLoading(false);
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  return { projects, loading };
}

// ─── useTasks ────────────────────────────────────────────────────
export function useTasks() {
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToTasks(data => {
      setTasks(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { tasks, loading };
}

// ─── useEmployees ────────────────────────────────────────────────
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToEmployees(data => {
      setEmployees(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { employees, loading };
}

// ─── useEmployeeNotes ────────────────────────────────────────────
export function useEmployeeNotes() {
  const [notes, setNotes] = useState<EmployeeNotesMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToEmployeeNotes(data => {
      setNotes(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { notes, loading };
}

// ─── useRoles ────────────────────────────────────────────────────
export function useRoles() {
  const [roles, setRoles] = useState<Record<string, RoleDefinition>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRoles({});
    setLoading(false);
  }, []);

  return { roles, loading };
}

// ─── useDashboardMetrics ─────────────────────────────────────────
export function useDashboardMetrics() {
  const { users, loading: usersLoading } = useUsers();
  const { departments, loading: deptsLoading } = useDepartments();
  const { projects, loading: projsLoading } = useProjects();
  const { tasks, loading: tasksLoading } = useTasks();

  const loading = usersLoading || deptsLoading || projsLoading || tasksLoading;

  const metrics: DashboardMetrics = useMemo(() => {
    const activeUsers = users.filter((u: any) => u.status === 'active' || u.is_active);
    const activeDepts = departments.filter((d) => d.status === 'active');
    const activeProjects = projects.filter((p) => p.status !== 'archived');
    const activeTasks = tasks.filter((t) => t.status !== 'completed');
    const pendingTasks = tasks.filter((t) => t.status === 'pending_assignment' || t.status === 'todo');
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const deptHeads = activeUsers.filter((u: any) => u.role === 'head' || u.role === 'head');
    const overloaded = activeUsers.filter((u: any) => u.workload >= 80);
    const totalWorkload = activeUsers.reduce((sum: number, u: any) => sum + (u.workload || 0), 0);
    const avgWorkload = activeUsers.length > 0 ? Math.round(totalWorkload / activeUsers.length) : 0;

    return {
      totalUsers: activeUsers.length,
      totalDepartments: activeDepts.length,
      activeProjects: activeProjects.length,
      activeTasks: activeTasks.length,
      pendingTasks: pendingTasks.length,
      completedTasks: completedTasks.length,
      departmentHeads: deptHeads.length,
      overloadedEmployees: overloaded.length,
      averageWorkload: avgWorkload,
    };
  }, [users, departments, projects, tasks]);

  return { metrics, users, departments, projects, tasks, loading };
}
