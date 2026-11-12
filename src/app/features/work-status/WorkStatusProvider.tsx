import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { resolveStatus, type StatusDefinition } from './statusDefinitions';

type StatusCatalog = {
  definitions: readonly StatusDefinition[];
  ready: boolean;
  error: string;
  save: (definition: StatusDefinition) => Promise<void>;
};
const empty: StatusCatalog = {
  definitions: [], ready: false, error: '',
  save: async () => { throw new Error('Sign in to edit statuses.'); },
};
const StatusContext = createContext(empty);

export function WorkStatusProvider({ children }: { children: ReactNode }) {
  const { user, userProfile } = useAuth();
  return user?.id && userProfile?.is_active !== false
    ? <StatusCatalogProvider key={user.id}>{children}</StatusCatalogProvider>
    : <StatusContext.Provider value={empty}>{children}</StatusContext.Provider>;
}

function StatusCatalogProvider({ children }: { children: ReactNode }) {
  const [definitions, setDefinitions] = useState<StatusDefinition[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    let request = 0;
    async function refresh() {
      const started = ++request;
      try {
        const result = await supabase.from('work_status_definitions').select('id,label,color,position,scope,retired');
        if (!current || request !== started) return;
        if (result.error) throw result.error;
        setDefinitions(result.data ?? []);
        setReady(true);
        setError('');
      } catch {
        if (current && request === started) setError('Could not load statuses.');
      }
    }
    void refresh();
    const channel = typeof supabase.channel === 'function'
      ? supabase.channel('work-status-definitions:' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_status_definitions' }, () => void refresh())
        .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); })
      : undefined;
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('eflow:status-definitions-updated', refresh);
    return () => {
      current = false;
      if (channel) void supabase.removeChannel(channel);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('eflow:status-definitions-updated', refresh);
    };
  }, []);

  const save = useCallback(async (definition: StatusDefinition) => {
    const { error } = await supabase.from('work_status_definitions').upsert(definition);
    if (error) throw new Error(error.code === '23505' ? 'That status name is already in use.' : error.message);
    setDefinitions(current => [...current.filter(item => item.id !== definition.id), definition]);
    window.dispatchEvent(new Event('eflow:status-definitions-updated'));
  }, []);

  return <StatusContext.Provider value={{ definitions, ready, error, save }}>{children}</StatusContext.Provider>;
}

export function useWorkStatuses() { return useContext(StatusContext); }

export function useWorkStatus(status: string, fallback: string, customId?: string | null) {
  return resolveStatus(useWorkStatuses().definitions, status, fallback, customId);
}
