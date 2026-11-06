import { supabase } from '../../../../lib/supabase';

/** Authoritative checks refresh on their inputs; each consumer owns its channel. */
export function subscribeProjectChecks(projectId: string, onChanged: () => void): () => void {
  let active = true;
  let queued: ReturnType<typeof setTimeout> | undefined;
  const invalidate = () => {
    if (!active || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    // A single operation can update tasks, project revisions and reviews together.
    if (queued !== undefined) return;
    queued = setTimeout(() => { queued = undefined; if (active) onChanged(); }, 150);
  };
  const channel = supabase.channel(`readiness-${projectId}-${crypto.randomUUID()}`);
  for (const [table, column] of [
    ['project_readiness_reviews', 'project_id'], ['projects', 'id'],
    ['tasks', 'linked_project_id'], ['project_offices', 'project_id'],
    ['project_office_identities', 'project_id'],
  ]) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `${column}=eq.${projectId}` }, invalidate);
  // These published child/financial tables have no project_id column. Existing
  // Realtime RLS scopes their events; only the authorized project RPC is reread.
  for (const table of ['project_office_members', 'subtasks', 'petty_cash_requests', 'petty_cash_liquidations', 'work_budget_allocations'])
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, invalidate);
  channel.subscribe(status => { if (status === 'SUBSCRIBED') invalidate(); });
  // Recover missed/unpublished changes and temporary socket outages automatically.
  const fallback = setInterval(invalidate, 15_000);
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', invalidate);
    window.addEventListener('online', invalidate);
    window.addEventListener('eflow:project-setup', invalidate);
    document.addEventListener('visibilitychange', invalidate);
  }
  return () => {
    active = false;
    clearInterval(fallback);
    if (queued !== undefined) clearTimeout(queued);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', invalidate);
      window.removeEventListener('online', invalidate);
      window.removeEventListener('eflow:project-setup', invalidate);
      document.removeEventListener('visibilitychange', invalidate);
    }
    void supabase.removeChannel(channel);
  };
}
