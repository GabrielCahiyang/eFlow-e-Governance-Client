// ─── eFlow Employee Service (Supabase) ───────────────────────────
// Bridges profiles table → Employee objects for LLM service compat.
// All exported function signatures kept identical.

import { supabase } from '../../lib/supabase';

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

async function loadAndNotify() {
  const { data } = await supabase
    .from('profiles')
    .select('*, organizations(name)')
    .eq('is_active', true)
    .neq('role', 'admin').neq('role', 'super_admin')
    .neq('role', 'admin')
    .order('full_name');

  if (!data) return [];

  const employees = (data as Record<string, unknown>[]).map(row =>
    profileToEmployee(row, (row.organizations as any)?.name)
  );

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
  loadAndNotify().then(employees => { if (employees) callback(employees); });

  const channelId = `profiles-emp-changes-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      loadAndNotify();
    })
    .subscribe();

  return () => {
    employeeListeners.delete(callback);
    supabase.removeChannel(channel);
  };
};

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
