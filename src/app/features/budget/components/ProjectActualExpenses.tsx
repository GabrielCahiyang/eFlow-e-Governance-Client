import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchProjectExpenseTotals, type ProjectExpenseTotals } from '../services/projectExpenseService';
import { peso } from './budgetUi';

const Expenses = createContext<{ totals?: ProjectExpenseTotals; loading: boolean; retry?: () => void }>({ loading: false });

export function ProjectActualExpensesProvider({ taskIds, children }: { taskIds: string[]; children: ReactNode }) {
  const { user } = useAuth();
  const scope = JSON.stringify([user?.id ?? '', [...new Set(taskIds)].sort()]);
  const [state, setState] = useState<{ scope: string; totals?: ProjectExpenseTotals; loading: boolean }>({ scope, loading: true });
  const [revision, setRevision] = useState(0);
  const channelId = useId();

  useEffect(() => {
    const [actor, ids] = JSON.parse(scope) as [string, string[]];
    if (!actor || !ids.length) {
      setState({ scope, loading: false });
      return;
    }
    let active = true;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      const run = ++generation;
      try {
        const totals = await fetchProjectExpenseTotals(ids);
        if (active && run === generation) setState({ scope, loading: false, totals });
      } catch {
        if (active && run === generation) setState({ scope, loading: false });
      }
    }
    function refresh() {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 150);
    }
    setState({ scope, loading: true });
    void load();
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('eflow:expenses-updated', refresh);
    let channel: ReturnType<typeof supabase.channel> | undefined;
    try {
      channel = supabase.channel(`project-expenses-${channelId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_requests' }, event => {
          const taskId = (event.new as { task_id?: string }).task_id || (event.old as { task_id?: string }).task_id;
          if (!taskId || ids.includes(taskId)) refresh();
        })
        .subscribe();
    } catch { /* Focus and local expense events still refresh the totals. */ }
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('eflow:expenses-updated', refresh);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [scope, channelId, revision]);

  return <Expenses.Provider value={state.scope === scope
    ? { ...state, retry: () => setRevision(value => value + 1) }
    : { loading: true }}>{children}</Expenses.Provider>;
}

export function ProjectActualExpensesCell({ taskId, subtaskId, personal }: {
  taskId?: string;
  subtaskId?: string;
  personal?: boolean;
}) {
  const { totals, loading, retry } = useContext(Expenses);
  if (personal || !taskId) return <span>—</span>;
  if (loading) return <span aria-label="Loading expenses">…</span>;
  if (!totals) return retry
    ? <button type="button" aria-label="Retry expenses" title="Retry expenses" onClick={retry}><RotateCw size={14} aria-hidden="true"/></button>
    : <span>—</span>;
  const amount = subtaskId ? totals.subtasks.get(subtaskId) : totals.tasks.get(taskId);
  if (!amount) return <span className="text-muted-foreground" title="No visible expenses">—</span>;
  return <span className="block whitespace-nowrap text-right tabular-nums" title={amount.complete ? 'Settled expenses' : 'Settled expenses visible to your account'}>
    {peso.format(amount.settled / 100)}
  </span>;
}
