import { supabase } from '../../../../lib/supabase';

/** Realtime only invalidates authorized reads. The interval covers missed events. */
export function subscribeFinancialReviewChanges(officeId: string, userId: string, refresh: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  const invalidate = () => {
    if (!active || document.visibilityState === 'hidden' || timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; if (active) refresh(); }, 150);
  };
  const channel = supabase.channel(`financial-review:${officeId}:${crypto.randomUUID()}`);
  for (const [table, filter] of [
    ['notifications', `user_id=eq.${userId}`],
    ['petty_cash_requests', `org_id=eq.${officeId}`],
    ['profiles', `org_id=eq.${officeId}`],
    ['organizations', `id=eq.${officeId}`],
    ['liquidation_independent_reviews', `org_id=eq.${officeId}`],
    ['petty_cash_liquidations', undefined],
  ]) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, invalidate);
  }
  let connected = false;
  channel.subscribe(status => {
    if (status !== 'SUBSCRIBED') return;
    if (connected) invalidate();
    connected = true;
  });
  const fallback = setInterval(invalidate, 15_000);
  window.addEventListener('focus', invalidate);
  window.addEventListener('online', invalidate);
  document.addEventListener('visibilitychange', invalidate);
  return () => {
    active = false;
    clearTimeout(timer);
    clearInterval(fallback);
    window.removeEventListener('focus', invalidate);
    window.removeEventListener('online', invalidate);
    document.removeEventListener('visibilitychange', invalidate);
    void supabase.removeChannel(channel);
  };
}
