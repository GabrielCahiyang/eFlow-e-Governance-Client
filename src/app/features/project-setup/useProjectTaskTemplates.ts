import { useEffect, useState } from 'react';
import { listProjectTaskTemplates, type ProjectTaskTemplate } from '../work-templates';

export function useProjectTaskTemplates(enabled: boolean) {
  const [templates, setTemplates] = useState<ProjectTaskTemplate[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setLoading(true);
    setError('');
    listProjectTaskTemplates().then(rows => { if (current) setTemplates(rows); })
      .catch(() => { if (current) setError('Templates could not load. Try reopening setup.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [enabled]);
  return { templates, loading, error };
}
