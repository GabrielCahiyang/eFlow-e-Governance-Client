import { EmptyState } from '../../../components/ui/EmptyState';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { subscribeNotificationChanges } from '../../../services/notificationService';
import { useAuth } from '../../../contexts/AuthContext';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { ProjectInvitations } from './ProjectInvitations';
import '../membershipApprovalQueue.css';

type QueueRow = { project_id: string; title: string };
export function ProjectInvitationApprovalQueue({ focusProjectId }: { focusProjectId?: string }) {
  const { user, userProfile } = useAuth();
  if (!user?.id || userProfile?.role !== 'head') return null;
  return <HeadQueue key={user.id} userId={user.id} focusProjectId={focusProjectId} />;
}

function HeadQueue({ userId, focusProjectId }: { userId: string; focusProjectId?: string }) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true, generation = 0;
    async function load() {
      const request = ++generation;
      try {
        const { data, error: failure } = await supabase.rpc('r8_head_invitation_queue');
        if (!active || request !== generation) return;
        if (failure) {
          setRows([]);
          setError(failure.code === 'PGRST202' ? 'Membership approvals are unavailable in this environment.' : failure.message);
        } else { setRows(data || []); setError(''); }
      } catch (reason) {
        if (!active || request !== generation) return;
        setRows([]); setError(reason instanceof Error ? reason.message : 'Membership approvals could not be loaded.');
      } finally { if (active && request === generation) setLoading(false); }
    }
    reload.current = () => { void load(); };
    const refresh = reload.current;
    void load(); window.addEventListener('focus', refresh);
    const unsubscribe = subscribeNotificationChanges(userId, refresh);
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') refresh(); }, 15000);
    return () => { active = false; generation++; unsubscribe(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [userId]);

  return <section className="eflow-membership-approvals" aria-label="Head invitation approval Inbox">
    <header><div><h2>Membership approvals</h2><p>Review project membership requests and dispatch approved invitations. Each project’s Members / Invitations also retains these controls.</p></div></header>
    {loading && <p role="status">Loading membership approvals…</p>}
    {error && <FeedbackState tone="error" title="Membership approvals could not be loaded" onRetry={() => reload.current()}>{error}</FeedbackState>}
    {!loading && !error && !rows.length && <EmptyState fill illustration="complete" title="No membership approvals pending" description="Requests appear here for the sponsoring Office’s appointed Head. Accepted membership and invitation history remain in each project’s Members / Invitations."/>}
    {!loading && !error && focusProjectId && !rows.some(row => row.project_id === focusProjectId) && <FeedbackState tone="warning" title="Referenced membership request unavailable">It may already have been handled or be outside your current sponsoring Office access. Check the project’s Members / Invitations for available history.</FeedbackState>}
    {rows.map(row => <details key={row.project_id} open={expanded[row.project_id] ?? row.project_id === focusProjectId} onToggle={event => { const open = event.currentTarget.open; setExpanded(current => current[row.project_id] === open ? current : { ...current, [row.project_id]: open }); }}>
      <summary><span>{row.title}</span><small>Membership invitations</small></summary>
      <div className="eflow-membership-approvals__project"><ProjectInvitations project={row.project_id} onChanged={() => reload.current()} /></div>
    </details>)}
  </section>;
}
