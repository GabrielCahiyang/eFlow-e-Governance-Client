import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjectTaskTemplates, type ProjectTaskTemplate } from '../work-templates';

export function useProjectTaskTemplates(enabled: boolean) {
  const [templates, setTemplates] = useState<ProjectTaskTemplate[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listProjectTaskTemplates();
      if (mounted.current) setTemplates(rows);
    } catch {
      if (mounted.current) setError('Templates could not load. Check your connection and retry.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { templates, loading, error, reload };
}
