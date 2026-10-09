import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProjectCompletionReadiness, type ProjectCompletionReadiness } from '../services/projectLifecycleService';
import { projectCompletionAvailability } from '../selectors/projectCompletionAvailability';
import type { Project } from '../services/types';

/** Scoped reads only; menu/dialog instances share the same fail-closed calculation. */
export function useProjectCompletionAvailability(project: Pick<Project, 'id' | 'status' | 'updatedAt'> | undefined, allowed: boolean, scope: string, refreshKey = '') {
  const key = `${scope}:${project?.id}:${project?.status}:${project?.updatedAt}:${allowed}:${refreshKey}`;
  const [state, setState] = useState<{ key: string; loading: boolean; error: string; readiness?: ProjectCompletionReadiness }>({ key: '', loading: true, error: '' });
  const version = useRef(0);
  const id = project?.id, status = project?.status || '';
  const refresh = useCallback(async () => {
    const request = ++version.current;
    setState({ key, loading: true, error: '' });
    if (!id || !allowed || ['completed', 'archived'].includes(status)) { setState({ key, loading: false, error: '' }); return; }
    try {
      const readiness = await fetchProjectCompletionReadiness(id);
      if (request !== version.current) return;
      if (readiness.projectId !== id) throw new Error('Completion checks belong to another project.');
      if (typeof readiness.canComplete !== 'boolean') throw new Error('Completion checks returned an invalid result.');
      setState({ key, loading: false, error: '', readiness });
    } catch (error) {
      if (request === version.current) setState({ key, loading: false, error: error instanceof Error ? error.message : 'Could not check completion.' });
    }
  }, [id, key, allowed, status]);
  useEffect(() => {
    void refresh();
    const focus = () => void refresh();
    const interval = window.setInterval(focus, 15_000);
    window.addEventListener('focus', focus);
    return () => { ++version.current; window.clearInterval(interval); window.removeEventListener('focus', focus); };
  }, [refresh]);
  const current = state.key === key ? state : { key, loading: true, error: '' };
  return { ...current, ...projectCompletionAvailability(status, allowed, current.loading, current.error, current.readiness), refresh };
}
