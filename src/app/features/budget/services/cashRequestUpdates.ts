import { supabase } from '../../../../lib/supabase';

export function subscribeCashRequestChanges(taskId: string, refresh: () => void) {
  if (typeof supabase.channel !== 'function') return () => {};
  const channel = supabase.channel(`task-cash-clearance:${taskId}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_requests', filter: `task_id=eq.${taskId}` }, refresh)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
