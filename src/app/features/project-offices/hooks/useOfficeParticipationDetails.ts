import { useCallback, useEffect, useRef, useState } from 'react';
import type { Invitation } from '../../invitations';
import type { OfficeProposal } from '../types';
import { fetchConfirmedOfficeProposals, projectOfficeInvitations } from '../services/projectOfficeService';
export function useOfficeParticipationDetails(projectId: string, canInvite: boolean) {
  const [invitations, setInvitations] = useState<Invitation[]>([]), [proposals, setProposals] = useState<OfficeProposal[]>([]), [error, setError] = useState('');
  const version = useRef(0);
  const activeScope = useRef(projectId); activeScope.current = projectId;
  const refresh = useCallback(async () => {
    if (activeScope.current !== projectId) return;
    const request = ++version.current;
    const [invites, source] = await Promise.allSettled([canInvite ? projectOfficeInvitations(projectId) : Promise.resolve({ invitations: [] }), fetchConfirmedOfficeProposals(projectId)]);
    if (request !== version.current || activeScope.current !== projectId) return;
    if (invites.status === 'fulfilled') setInvitations(invites.value.invitations || []);
    if (source.status === 'fulfilled') setProposals(source.value);
    setError([invites, source].filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason.message || 'Office invitation history unavailable.').join(' '));
  }, [projectId, canInvite]);
  useEffect(() => { setInvitations([]); setProposals([]); setError(''); void refresh(); return () => { ++version.current; }; }, [refresh]);
  return { invitations, proposals, error, refresh };
}
