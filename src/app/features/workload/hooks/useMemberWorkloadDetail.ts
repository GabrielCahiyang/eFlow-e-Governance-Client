import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMemberWorkloadDetail,
  WORKLOAD_CHANGED_EVENT,
} from '../services/workloadService';
import type { MemberWorkloadDetail } from '../types';

export function useMemberWorkloadDetail(
  userId?: string | null,
  orgId?: string | null,
  enabled = true,
) {
  const [data, setData] = useState<MemberWorkloadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !userId) {
      setData(null);
      setLoading(false);
      setError('');
      return;
    }
    const req = ++version.current;
    setLoading(true);
    setError('');
    try {
      const result = await fetchMemberWorkloadDetail(userId, orgId);
      if (req !== version.current) return;
      setData(result);
    } catch (caught) {
      if (req === version.current) {
        setError(caught instanceof Error ? caught.message : 'Could not load member workload details.');
      }
    } finally {
      if (req === version.current) setLoading(false);
    }
  }, [userId, orgId, enabled]);

  useEffect(() => {
    void load();
    if (!enabled || !userId || typeof window === 'undefined') return;
    const onChanged = () => void load();
    window.addEventListener(WORKLOAD_CHANGED_EVENT, onChanged);
    return () => {
      ++version.current;
      window.removeEventListener(WORKLOAD_CHANGED_EVENT, onChanged);
    };
  }, [load, enabled, userId]);

  return { data, loading, error, reload: load };
}
