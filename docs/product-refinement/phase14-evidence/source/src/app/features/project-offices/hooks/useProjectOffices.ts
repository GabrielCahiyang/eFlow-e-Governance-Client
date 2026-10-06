import { createContext, useContext, useCallback, useEffect, useState, useRef, useId } from 'react';
import { supabase } from '../../../../lib/supabase';
import { fetchProjectOffices } from '../services/projectOfficeService';
import { fetchOfficeIdentities } from '../services/officeIdentityService';
import type { ProjectOfficeState } from '../types';

const empty: ProjectOfficeState = { offices: [], members: [], loading: true, error: '', refresh: async () => {} };
export const ProjectOfficeContext = createContext<ProjectOfficeState>(empty);
export const useProjectOfficeContext = () => useContext(ProjectOfficeContext);
export function useProjectOffices(projectId: string): ProjectOfficeState {
  const [state, setState] = useState<Omit<ProjectOfficeState, 'refresh'>>(empty);
  const instanceId = useId();
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const [canonical, local] = await Promise.allSettled([fetchProjectOffices(projectId), fetchOfficeIdentities(projectId)]);
    if (version !== requestVersion.current) return;
    setState(s => ({ ...s, projectId, ...(canonical.status === 'fulfilled' ? canonical.value : {}), loading: false,
      error: canonical.status === 'rejected' ? canonical.reason.message || 'Could not load project Offices.' : '',
      identities: local.status === 'fulfilled' ? local.value : [],
      identityError: local.status === 'rejected' ? local.reason.message || 'Could not load Office identities.' : '' }));
  }, [projectId]);
  useEffect(() => {
    setState(empty); void refresh();
    const channel = supabase.channel('project-offices-' + projectId + '-' + instanceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_offices', filter: 'project_id=eq.' + projectId }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_office_members' }, refresh).subscribe();
    const localChannel = supabase.channel('project-office-identities-' + projectId + '-' + instanceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_office_identities', filter: 'project_id=eq.' + projectId }, refresh).subscribe();
    return () => { ++requestVersion.current; void supabase.removeChannel(channel); void supabase.removeChannel(localChannel); };
  }, [projectId, refresh, instanceId]);
  return { ...(state.projectId === projectId ? state : empty), refresh, projectId };
}
