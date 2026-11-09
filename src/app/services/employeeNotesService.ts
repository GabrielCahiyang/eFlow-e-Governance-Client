// ─── eFlow Employee Notes Service (Supabase) ─────────────────────
// Stores team intelligence notes per employee in Supabase.

import { supabase } from '../../lib/supabase';
import { registerAuthCacheReset } from '../shared/authCacheReset';
import {
  invalidateQueryDomain,
  loadWithQueryCache,
  readCachedQuery,
} from '../shared/queryCache';

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

const noteListeners = new Set<(notes: EmployeeNotesMap) => void>();
let sharedNotesChannel: ReturnType<typeof supabase.channel> | null = null;

export function getCachedEmployeeNotes(): EmployeeNotesMap | undefined {
  return readCachedQuery<EmployeeNotesMap>('employee-notes', 'all').data;
}

export async function fetchEmployeeNotesMap(forceRefresh = false): Promise<EmployeeNotesMap> {
  return loadWithQueryCache({
    domain: 'employee-notes',
    scope: 'all',
    ttlMs: 30_000,
    forceRefresh,
    fetcher: async () => {
      const { data } = await supabase.from('employee_notes').select('*');
      if (!data) return {};

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
      return map;
    },
  });
}

async function refreshEmployeeNotes(forceRefresh = false) {
  const map = await fetchEmployeeNotesMap(forceRefresh);
  noteListeners.forEach((cb) => {
    try {
      cb(map);
    } catch (e) {
      console.error(e);
    }
  });
  return map;
}

export const subscribeToEmployeeNotes = (
  callback: (notes: EmployeeNotesMap) => void,
) => {
  noteListeners.add(callback);
  const cached = getCachedEmployeeNotes();
  if (cached) {
    callback(cached);
  }
  void refreshEmployeeNotes(false).then((map) => {
    if (noteListeners.has(callback)) callback(map);
  });

  if (!sharedNotesChannel) {
    sharedNotesChannel = supabase
      .channel('member-notes-changes-shared')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_notes' },
        () => {
          invalidateQueryDomain('employee-notes');
          void refreshEmployeeNotes(true);
        },
      )
      .subscribe();
  }

  return () => {
    noteListeners.delete(callback);
    if (noteListeners.size === 0 && sharedNotesChannel) {
      const ch = sharedNotesChannel;
      sharedNotesChannel = null;
      void supabase.removeChannel(ch);
    }
  };
};

registerAuthCacheReset(() => {
  if (sharedNotesChannel) {
    const ch = sharedNotesChannel;
    sharedNotesChannel = null;
    void supabase.removeChannel(ch);
  }
});

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
  invalidateQueryDomain('employee-notes');
  void refreshEmployeeNotes(true);
};
