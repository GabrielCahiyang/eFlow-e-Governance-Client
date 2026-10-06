import { useEffect, useState } from 'react';
import { normalizeProjectFilters, projectViewPreferenceKey } from '../preferences';
import type { ProjectViewFilters } from '../types';
function read(key: string): ProjectViewFilters {
  try { return normalizeProjectFilters(JSON.parse(localStorage.getItem(key) || 'null')); } catch { return normalizeProjectFilters(null); }
}
export function useProjectViewPreferences(userId: string, projectId: string) {
  const key = projectViewPreferenceKey(userId, projectId);
  const [state, setState] = useState(() => ({ key, filters: userId ? read(key) : normalizeProjectFilters(null) }));
  const filters = state.key === key ? state.filters : userId ? read(key) : normalizeProjectFilters(null);
  useEffect(() => { if (state.key !== key) setState({ key, filters: userId ? read(key) : normalizeProjectFilters(null) }); }, [key, state.key, userId]);
  const setFilters = (value: ProjectViewFilters) => {
    const normalized = normalizeProjectFilters(value);
    setState({ key, filters: normalized });
    if (userId) try { localStorage.setItem(key, JSON.stringify(normalized)); } catch { /* Presentation remains usable when storage is blocked. */ }
  };
  return { filters, setFilters };
}
