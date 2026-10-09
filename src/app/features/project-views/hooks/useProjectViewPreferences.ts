import { useEffect, useState } from 'react';
import { normalizeProjectFilters, projectViewPreferenceKey } from '../preferences';
import type { ProjectViewFilters } from '../types';
import { useWorkspaceScope } from '../../workspaces';
function read(key: string): ProjectViewFilters {
  try { return normalizeProjectFilters(JSON.parse(localStorage.getItem(key) || 'null')); } catch { return normalizeProjectFilters(null); }
}
export function useProjectViewPreferences(userId: string, projectId: string) {
  const scope = useWorkspaceScope();
  const legacyKey = projectViewPreferenceKey(userId, projectId);
  const key = legacyKey + (scope ? `:workspace:${scope.workspace.id}` : '');
  const load = () => {
    try { return userId ? read(localStorage.getItem(key) ? key : legacyKey) : normalizeProjectFilters(null); }
    catch { return normalizeProjectFilters(null); }
  };
  const [state, setState] = useState(() => ({ key, filters: load() }));
  const filters = state.key === key ? state.filters : load();
  useEffect(() => { if (state.key !== key) setState({ key, filters: load() }); }, [key, state.key, userId]);
  const setFilters = (value: ProjectViewFilters) => {
    const normalized = normalizeProjectFilters(value);
    setState({ key, filters: normalized });
    if (userId) try { localStorage.setItem(key, JSON.stringify(normalized)); } catch { /* Presentation remains usable when storage is blocked. */ }
  };
  return { filters, setFilters };
}
