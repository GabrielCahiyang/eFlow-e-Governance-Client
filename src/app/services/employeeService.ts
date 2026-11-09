// ─── eFlow Employee Service (Supabase) ───────────────────────────
// Bridges profiles table → Employee objects for LLM service compat.
// All exported function signatures kept identical.

import { supabase } from '../../lib/supabase';
import { registerAuthCacheReset } from '../shared/authCacheReset';
import {
  invalidateQueryDomain,
  loadWithQueryCache,
  readCachedQuery,
} from '../shared/queryCache';

export interface Employee {
  id: string;
  name: string;
  jobTitle: string;
  jobDescription: string;
  currentWorkload: number;
  department?: string;
  departmentName?: string;
  initials?: string;
  email?: string;
}

// Re-export for backward compat
export type SeedEmployee = Employee;



function profileToEmployee(profile: Record<string, unknown>, orgName?: string): Employee {
  const name = (profile.full_name as string) || '';
  const role = (profile.role as string) || 'member';
  const parts = name.split(' ');
  const initials = parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2) || '??';
  const skills = (profile.skills as Record<string, boolean>) || {};
  const skillList = Object.keys(skills).filter(k => skills[k]).join(', ');

  return {
    id: profile.id as string,
    name,
    jobTitle: formatRole(role),
    jobDescription: skillList || `${formatRole(role)} at ${orgName || 'LEDIPO'}`,
    currentWorkload: (profile.workload as number) || 0,
    department: (profile.org_id as string) || undefined,
    departmentName: orgName || (profile.org_id as string) || '',
    initials,
    email: (profile.email as string) || undefined,
  };
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}



const employeeListeners = new Set<(employees: Employee[]) => void>();
let sharedEmployeeChannel: ReturnType<typeof supabase.channel> | null = null;

export function getCachedEmployees(): Employee[] | undefined {
  return readCachedQuery<Employee[]>('employees', 'all').data;
}

export async function fetchEmployees(forceRefresh = false): Promise<Employee[]> {
  return loadWithQueryCache({
    domain: 'employees',
    scope: 'all',
    ttlMs: 30_000,
    forceRefresh,
    fetcher: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*, organizations(name)')
        .eq('is_active', true)
        .neq('role', 'admin').neq('role', 'super_admin')
        .neq('role', 'admin')
        .order('full_name');

      if (!data) return [];

      return (data as Record<string, unknown>[]).map(row =>
        profileToEmployee(row, (row.organizations as any)?.name)
      );
    },
  });
}

async function loadAndNotify(forceRefresh = false) {
  const employees = await fetchEmployees(forceRefresh);
  employeeListeners.forEach(cb => {
    try { cb(employees); } catch (e) { console.error(e); }
  });
  return employees;
}

export const seedEmployeesIfEmpty = async () => {
  // Employee seeding skipped since profiles require auth users (seeded by seedTasksIfEmpty)
};

export const subscribeToEmployees = (callback: (employees: Employee[]) => void) => {
  employeeListeners.add(callback);
  const cached = getCachedEmployees();
  if (cached) {
    callback(cached);
  }
  void loadAndNotify(false).then(employees => {
    if (employees && employeeListeners.has(callback)) callback(employees);
  });

  if (!sharedEmployeeChannel) {
    let connectedOnce = false;
    sharedEmployeeChannel = supabase
      .channel('profiles-emp-changes-shared')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        invalidateQueryDomain('employees');
        void loadAndNotify(true);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (connectedOnce) {
            invalidateQueryDomain('employees');
            void loadAndNotify(true);
          }
          connectedOnce = true;
        }
      });
  }

  return () => {
    employeeListeners.delete(callback);
    if (employeeListeners.size === 0 && sharedEmployeeChannel) {
      const ch = sharedEmployeeChannel;
      sharedEmployeeChannel = null;
      void supabase.removeChannel(ch);
    }
  };
};

registerAuthCacheReset(() => {
  if (sharedEmployeeChannel) {
    const ch = sharedEmployeeChannel;
    sharedEmployeeChannel = null;
    void supabase.removeChannel(ch);
  }
});

export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  const { data } = await supabase
    .from('profiles')
    .select('*, organizations(name)')
    .eq('id', id)
    .single();
  if (!data) return null;
  return profileToEmployee(data as Record<string, unknown>, (data as any).organizations?.name);
};

export const updateEmployeeWorkload = async (id: string, workload: number): Promise<void> => {
  await supabase.from('profiles').update({ workload }).eq('id', id);
  await loadAndNotify();
};
