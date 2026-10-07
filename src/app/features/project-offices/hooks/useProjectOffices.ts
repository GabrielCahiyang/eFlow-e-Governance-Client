import { createContext, useContext, useCallback, useEffect, useState, useRef, useId, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { fetchProjectOffices } from '../services/projectOfficeService';
import { fetchOfficeIdentities } from '../services/officeIdentityService';
import type { ProjectOfficeState } from '../types';
import { projectOfficeError } from '../presentation';
import { useQuietOfficeRefresh } from './useQuietOfficeRefresh';

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
    setState(s => ({ ...s, projectId, ...(canonical.status === 'fulfilled' ? canonical.value : {}), loading: canonical.status === 'rejected' && s.loading,
      error: canonical.status === 'rejected' ? projectOfficeError(canonical.reason, 'Could not load project Offices.') : '',
      identities: local.status === 'fulfilled' ? local.value : s.identities || [],
      identityError: local.status === 'rejected' ? projectOfficeError(local.reason, 'Could not load Office identities.') : '' }));
  }, [projectId]);
  useQuietOfficeRefresh(refresh, !!(state.error || state.identityError), projectId);
  useEffect(() => {
    setState(empty); void refresh();
    const channel = supabase.channel('project-offices-' + projectId + '-' + instanceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_offices', filter: 'project_id=eq.' + projectId }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_office_members' }, refresh).subscribe();
    const localChannel = supabase.channel('project-office-identities-' + projectId + '-' + instanceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_office_identities', filter: 'project_id=eq.' + projectId }, refresh).subscribe();
    return () => { ++requestVersion.current; void supabase.removeChannel(channel); void supabase.removeChannel(localChannel); };
  }, [projectId, refresh, instanceId]);
  return useMemo(() => {
    const current = state.projectId === projectId ? state : empty;
    const removed = new Set((current.identities || []).filter(i => i.provenance.removed).map(i => i.project_office_id));
    return { ...current, offices: current.offices.filter(o => !removed.has(o.id)),
      identities: (current.identities || []).filter(i => !i.provenance.removed), refresh, projectId };
  }, [state, projectId, refresh]);
}
