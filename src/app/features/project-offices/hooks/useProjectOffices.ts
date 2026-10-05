import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { fetchProjectOffices } from '../services/projectOfficeService';
import type { ProjectOfficeState } from '../types';

const empty: ProjectOfficeState = { offices: [], members: [], loading: true, error: '', refresh: async () => {} };
export const ProjectOfficeContext = createContext<ProjectOfficeState>(empty);
export const useProjectOfficeContext = () => useContext(ProjectOfficeContext);
export function useProjectOffices(projectId: string): ProjectOfficeState {
  const [state, setState] = useState<Omit<ProjectOfficeState, 'refresh'>>(empty);
  const refresh = useCallback(async () => {
    try { const data = await fetchProjectOffices(projectId); setState({ ...data, loading: false, error: '' }); }
    catch (e) { setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Could not load project Offices.' })); }
  }, [projectId]);
  useEffect(() => {
    setState(empty); void refresh();
    const channel = supabase.channel('project-offices-' + projectId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_offices', filter: 'project_id=eq.' + projectId }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_office_members' }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [projectId, refresh]);
  return { ...state, refresh };
}
