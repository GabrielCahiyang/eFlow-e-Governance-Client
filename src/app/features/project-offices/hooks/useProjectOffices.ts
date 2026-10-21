import { createContext, useContext, useCallback, useEffect, useState, useRef, useId, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { fetchProjectOffices } from '../services/projectOfficeService';
import { fetchOfficeIdentities } from '../services/officeIdentityService';
import { fetchOfficeWork } from '../services/officePeople';
import type { ProjectOfficeState } from '../types';
import { projectOfficeError } from '../presentation';
import { useQuietOfficeRefresh } from './useQuietOfficeRefresh';
import { ACCESS_CHANGED_EVENT } from '../../project-access';

const empty: ProjectOfficeState = { offices: [], members: [], loading: true, error: '', refresh: async () => {} };
export const ProjectOfficeContext = createContext<ProjectOfficeState>(empty);
export const useProjectOfficeContext = () => useContext(ProjectOfficeContext);
export function useProjectOffices(projectId: string): ProjectOfficeState {
  const [state, setState] = useState<Omit<ProjectOfficeState, 'refresh'>>(empty);
  const instanceId = useId();
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const [canonical, local,work] = await Promise.allSettled([fetchProjectOffices(projectId), fetchOfficeIdentities(projectId),fetchOfficeWork(projectId)]);
    if (version !== requestVersion.current) return;
    setState(s => ({ ...s, projectId, ...(canonical.status === 'fulfilled' ? canonical.value : {}), loading: false,
      error: canonical.status === 'rejected' ? projectOfficeError(canonical.reason, 'Could not load project Offices.') : '',
      identities: local.status === 'fulfilled' ? local.value : s.identities || [],
      workIdentities:work.status==='fulfilled'?Object.fromEntries(work.value.map(row=>[row.task_id,row.identity_id])):s.workIdentities||{},
      identityError: local.status === 'rejected' ? projectOfficeError(local.reason, 'Could not load Office identities.') : work.status==='rejected'?projectOfficeError(work.reason,'Could not load Office responsibilities.'):'' }));
  }, [projectId]);
  useQuietOfficeRefresh(refresh, !!(state.error || state.identityError), projectId);
  useEffect(() => {
    const changed = () => { void refresh(); };
    window.addEventListener(ACCESS_CHANGED_EVENT, changed);
    return () => window.removeEventListener(ACCESS_CHANGED_EVENT, changed);
  }, [refresh]);
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
