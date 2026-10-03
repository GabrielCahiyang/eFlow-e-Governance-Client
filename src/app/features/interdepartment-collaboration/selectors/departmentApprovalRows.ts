import type { CollaborationApproval, CollaborationParticipant } from "../types";

export function departmentApprovalRows(participants: CollaborationParticipant[], approvals: CollaborationApproval[], currentRevisionId?: string) {
  return participants.map((participant) => {
    const approval = currentRevisionId ? approvals.filter((item) => item.revisionId === currentRevisionId && item.organizationId === participant.orgId)
      .sort((a, b) => b.createdAt - a.createdAt)[0] : undefined;
    const status = participant.participationRole === "owner" ? "Lead office"
      : participant.participationRole === "observer" ? "Approval not required"
      : approval?.decision === "approved" ? "Approved"
      : approval?.decision === "changes_requested" ? "Updates needed"
      : approval?.decision === "declined" ? "Declined"
      : participant.requestedAt ? "Waiting for approval" : "Not requested";
    const rule = participant.participationRole === "owner" || participant.participationRole === "observer" ? "—"
      : participant.approvalPolicy === "all" ? "All authorized approvers"
      : participant.approvalPolicy === "quorum" ? `${participant.quorumCount} authorized approvals`
      : "One authorized approver";
    return { participant, approval, status, rule };
  });
}
