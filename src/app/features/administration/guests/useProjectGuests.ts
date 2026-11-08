import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { readProjectGuests } from './service';
import type { ProjectGuest } from './types';

export function useProjectGuests(actor: string, enabled: boolean) {
  const [data, setData] = useState<ProjectGuest[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const request = ++generation.current;
    try { const result = await readProjectGuests(); if (request === generation.current) { setData(result); setError(''); } }
    catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : 'Could not load project guests.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [actor, enabled]);
  useEffect(() => {
    setData([]); setLoading(enabled); setError('');
    if (!enabled) return;
    let debounce: ReturnType<typeof setTimeout>;
    const sync = () => { clearTimeout(debounce); debounce = setTimeout(() => void refresh(), 200); };
    const visible = () => { if (!document.hidden) sync(); };
    void refresh();
    const channel = supabase.channel('admin-project-guests:' + actor + ':' + crypto.randomUUID());
    for (const table of ['project_guest_accounts', 'project_guest_account_events', 'profiles', 'projects', 'project_guest_members', 'personal_projects'])
      channel.on('postgres_changes', {event: '*', schema: 'public', table}, sync);
    channel.subscribe();
    const timer = setInterval(visible, 60_000);
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { ++generation.current; clearTimeout(debounce); clearInterval(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); void supabase.removeChannel(channel); };
  }, [actor, enabled, refresh]);
  return {data, loading, error, refresh};
}
