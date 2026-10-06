import { useCallback, useEffect, useRef, useState } from 'react';
import { phase2Request } from '../../../shared/phase2Api';
import { listInvitations, type Invitation } from '../../invitations';
import type { OfficeMember } from '../types';
const empty = { members: [] as OfficeMember[], invitations: [] as Invitation[], office: 'your Office', loading: true, refreshing: false, teamError: '', inviteError: '' };
export function useOfficeTeam(scope: string, enabled: boolean) {
  const [state, setState] = useState(empty);
  const version = useRef(0);
  const activeScope = useRef(scope); activeScope.current = scope;
  const refresh = useCallback(async () => {
    if (!enabled || activeScope.current !== scope) return;
    const request = ++version.current;
    setState(s => ({ ...s, refreshing: true }));
    const [team, invitations] = await Promise.allSettled([
      phase2Request<{ office_name: string; members: OfficeMember[] }>('/office-team'), listInvitations(),
    ]);
    if (request !== version.current || activeScope.current !== scope) return;
    setState(s => ({ ...s, loading: false, refreshing: false,
      ...(team.status === 'fulfilled' ? { members: team.value.members, office: team.value.office_name } : {}),
      ...(invitations.status === 'fulfilled' ? { invitations: invitations.value.invitations } : {}),
      teamError: team.status === 'rejected' ? team.reason.message || 'Could not load Office members.' : '',
      inviteError: invitations.status === 'rejected' ? invitations.reason.message || 'Could not load invitations.' : '',
    }));
  }, [scope, enabled]);
  useEffect(() => { setState(empty); void refresh(); return () => { ++version.current; }; }, [refresh]);
  return { ...state, refresh };
}
