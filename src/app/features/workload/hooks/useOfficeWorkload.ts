import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchOfficeWorkloadSummary,
  WORKLOAD_CHANGED_EVENT,
} from '../services/workloadService';
import {
  DEFAULT_WORKLOAD_THRESHOLDS,
  type MemberWorkloadSummary,
  type OfficeWorkloadSummary,
} from '../types';

export function useOfficeWorkload(orgId?: string | null, enabled = true) {
  const [data, setData] = useState<OfficeWorkloadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return;
      const req = ++version.current;
      setLoading(true);
      setError('');
      try {
        const result = await fetchOfficeWorkloadSummary(orgId, { force });
        if (req !== version.current) return;
        setData(result);
      } catch (caught) {
        if (req === version.current) {
          setError(caught instanceof Error ? caught.message : 'Could not load office workload.');
        }
      } finally {
        if (req === version.current) setLoading(false);
      }
    },
    [orgId, enabled],
  );

  useEffect(() => {
    void load(false);
    if (!enabled || typeof window === 'undefined') return;
    const onChanged = () => void load(true);
    window.addEventListener(WORKLOAD_CHANGED_EVENT, onChanged);
    window.addEventListener('eflow:project-setup', onChanged);
    return () => {
      ++version.current;
      window.removeEventListener(WORKLOAD_CHANGED_EVENT, onChanged);
      window.removeEventListener('eflow:project-setup', onChanged);
    };
  }, [load, enabled]);

  const byUserId = useMemo(() => {
    const map = new Map<string, MemberWorkloadSummary>();
    for (const member of data?.members ?? []) {
      map.set(member.userId, member);
    }
    return map;
  }, [data]);

  return {
    data,
    thresholds: data?.thresholds ?? DEFAULT_WORKLOAD_THRESHOLDS,
    members: data?.members ?? [],
    byUserId,
    loading,
    error,
    reload: () => load(true),
  };
}
