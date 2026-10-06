import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchReadiness } from '../services/readinessService';
import type { ProjectReadiness } from '../types';
import { FeedbackState } from '../../../components/ui/FeedbackState';

const ReadinessSummaryContext = createContext<{ update: (snapshot: ProjectReadiness) => void; snapshot: ProjectReadiness | null; loading: boolean; error: string; refresh: () => void } | null>(null);
export const useReadinessSummaryContext = () => useContext(ReadinessSummaryContext);

/** A scoped presentation snapshot of the existing checks, shared with the full readiness panel. */
export function ProjectReadinessSummaryProvider({ projectId, refreshKey, children }: { projectId: string; refreshKey: string; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ProjectReadiness | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const version = useRef(0);
  const update = useCallback((next: ProjectReadiness) => { ++version.current; setSnapshot(next); setError(''); setLoading(false); }, []);
  const refresh = useCallback(() => {
    const request = ++version.current; setLoading(true); setError('');
    void fetchReadiness(projectId).then(next => {
      if (request !== version.current) return;
      if (!next || !Array.isArray(next.checks)) throw new Error('Readiness checks did not return a valid summary.');
      update(next);
    }).catch(caught => { if (request === version.current) setError(caught instanceof Error ? caught.message : 'Could not load readiness checks.'); })
      .finally(() => { if (request === version.current) setLoading(false); });
  }, [projectId, update]);
  useEffect(() => { refresh(); return () => { ++version.current; }; }, [refresh, refreshKey]);
  const value = useMemo(() => ({ update, snapshot, loading, error, refresh }), [update, snapshot, loading, error, refresh]);
  return <ReadinessSummaryContext.Provider value={value}>{children}</ReadinessSummaryContext.Provider>;
}

export function ProjectReadinessSummary() {
  const context = useReadinessSummaryContext();
  if (!context) return null;
  if (context.loading) return <p role="status">Loading readiness checks…</p>;
  if (context.error) return <FeedbackState tone="warning" title="Readiness summary unavailable" onRetry={context.refresh}>{context.error}</FeedbackState>;
  const snapshot = context.snapshot;
  return snapshot ? <p>{snapshot.stage} · {snapshot.checks.filter(check => check.ok).length} of {snapshot.checks.length} checks confirmed{snapshot.governed ? ' · Proposal approval workflow' : ''}</p> : null;
}
