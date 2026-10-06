import { useMemo } from 'react';
import { useCollaborationDraft } from '../../interdepartment-collaboration';

/** Reuse the persisted Office review request and its configured review window. */
export function useProjectReviewDates(draftId?: string) {
  const { draft, participants, approvals, loading, error } = useCollaborationDraft(draftId || null);
  const dates = useMemo(() => participants.flatMap(participant => {
    if (!participant.requestedAt || ['owner', 'observer'].includes(participant.participationRole)) return [];
    const dueAt = participant.requestedAt + participant.reviewDeadlineDays * 86400000;
    if (!Number.isFinite(dueAt)) return [];
    const due = new Date(dueAt);
    const latest = approvals.filter(a => a.organizationId === participant.orgId && a.revisionId === draft?.currentRevisionId).sort((a,b) => b.createdAt-a.createdAt)[0];
    const pending = draft?.status === 'in_review' && !latest;
    const status = latest?.decision === 'approved' ? 'completed' : latest?.decision === 'changes_requested' ? 'changes_requested' : latest?.decision === 'declined' ? 'cancelled' : 'for_review';
    return [{ id: participant.orgId, date: `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`, status, pending, overdue: pending && dueAt < Date.now() }];
  }), [draft, participants, approvals]);
  return { dates, loading, error };
}
