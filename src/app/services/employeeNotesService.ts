// ─── eFlow Employee Notes Service (Supabase) ─────────────────────
// Stores team intelligence notes per employee in Supabase.

import { supabase } from '../../lib/supabase';

export interface EmployeeNote {
  employeeId: string;
  strengths: string;
  weaknesses: string;
  notes: string;
  tags: string[];
  updatedAt: number;
  updatedBy?: string;
}

export type EmployeeNotesMap = Record<string, EmployeeNote>;

export const subscribeToEmployeeNotes = (
  callback: (notes: EmployeeNotesMap) => void,
) => {
  let disposed = false;
  const load = async () => {
    const { data } = await supabase.from('employee_notes').select('*');
    if (disposed) return;
    if (!data) { callback({}); return; }

    const map: EmployeeNotesMap = {};
    data.forEach(row => {
      map[row.profile_id] = {
        employeeId: row.profile_id as string,
        strengths: (row.strengths as string) || '',
        weaknesses: (row.weaknesses as string) || '',
        notes: (row.notes as string) || '',
        tags: (row.tags as string[]) || [],
        updatedAt: new Date((row.updated_at as string) || Date.now()).getTime(),
        updatedBy: (row.updated_by as string) || undefined,
      };
    });
    callback(map);
  };
  load();

  const channel = supabase
    .channel(`member-notes-changes-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'employee_notes' },
      () => { load(); },
    )
    .subscribe();

  return () => {
    disposed = true;
    supabase.removeChannel(channel);
  };
};

export const updateEmployeeNotes = async (
  employeeId: string,
  partial: Partial<EmployeeNote>,
  updatedBy?: string,
): Promise<void> => {
  const { error } = await supabase.from('employee_notes').upsert({
    profile_id: employeeId,
    strengths: partial.strengths || '',
    weaknesses: partial.weaknesses || '',
    notes: partial.notes || '',
    tags: partial.tags || [],
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id' });
  if (error) throw new Error(error.message);
};
