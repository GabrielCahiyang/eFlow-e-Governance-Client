import type {
  CollaborationApproval,
  CollaborationChangeRequest,
  CollaborationDraft,
  CollaborationDraftSnapshot,
  CollaborationMessage,
  CollaborationParticipant,
  CollaborationRevision,
} from "../types";
import { normalizeCollaborationOrganization, normalizeCollaborationSnapshot } from "../selectors/participationRole";

const time = (value: unknown) => value ? new Date(String(value)).getTime() : undefined;

export function rowToCollaborationDraft(row: Record<string, unknown>): CollaborationDraft {
  return {
    id: String(row.id),
    title: String(row.title || "Untitled proposal"),
    ownerOrgId: String(row.owner_org_id || ""),
    ownerUserId: String(row.owner_user_id || ""),
    sourceType: row.source_type === "ai_pdf" ? "ai_pdf" : "manual",
    sourceFileName: row.source_file_name ? String(row.source_file_name) : undefined,
    sourceFilePath: row.source_file_path ? String(row.source_file_path) : undefined,
    sourceFileHash: row.source_file_hash ? String(row.source_file_hash) : undefined,
    status: row.status as CollaborationDraft["status"],
    currentRevisionId: row.current_revision_id ? String(row.current_revision_id) : undefined,
    snapshot: normalizeCollaborationSnapshot((row.working_snapshot || {}) as CollaborationDraftSnapshot),
    createdBy: String(row.created_by || ""),
    createdAt: time(row.created_at) || 0,
    updatedAt: time(row.updated_at) || 0,
    committedAt: time(row.committed_at),
  };
}

export function rowToCollaborationRevision(row: Record<string, unknown>): CollaborationRevision {
  return {
    id: String(row.id), draftId: String(row.draft_id), revisionNumber: Number(row.revision_number || 0),
    snapshot: normalizeCollaborationSnapshot(row.snapshot as CollaborationDraftSnapshot), createdBy: String(row.created_by || ""),
    createdAt: time(row.created_at) || 0, changeSummary: String(row.change_summary || "Draft updated"),
  };
}

export function rowToCollaborationParticipant(row: Record<string, unknown>): CollaborationParticipant {
  return {
    draftId: String(row.draft_id),
    ...normalizeCollaborationOrganization({
      orgId: String(row.org_id),
      participationRole: row.participation_role,
      staffingEnabled: row.staffing_enabled !== false,
    }),
    requestedBy: row.requested_by ? String(row.requested_by) : undefined,
    requestedAt: time(row.requested_at),
    approvalPolicy: (row.approval_policy || "one_of") as CollaborationParticipant["approvalPolicy"],
    quorumCount: Number(row.quorum_count || 1),
    sequence: Number(row.approval_sequence || 1),
    reviewDeadlineDays: Number(row.review_deadline_days || 5),
  };
}

export function rowToCollaborationApproval(row: Record<string, unknown>): CollaborationApproval {
  return {
    id: String(row.id), draftId: String(row.draft_id), revisionId: String(row.revision_id),
    organizationId: String(row.organization_id), decision: row.decision as CollaborationApproval["decision"],
    approvedBy: String(row.approved_by), reason: row.reason ? String(row.reason) : undefined,
    createdAt: time(row.created_at) || 0,
  };
}

export function rowToCollaborationMessage(row: Record<string, unknown>): CollaborationMessage {
  const author = row.profiles as { full_name?: string } | undefined;
  return {
    id: String(row.id), draftId: String(row.draft_id), revisionId: row.revision_id ? String(row.revision_id) : undefined,
    authorId: row.author_id ? String(row.author_id) : undefined, authorOrgId: row.author_org_id ? String(row.author_org_id) : undefined,
    authorName: author?.full_name, message: String(row.message || ""), messageType: row.message_type as CollaborationMessage["messageType"],
    targetType: row.target_type as CollaborationMessage["targetType"], targetKey: row.target_key ? String(row.target_key) : undefined,
    createdAt: time(row.created_at) || 0,
  };
}

export function rowToCollaborationChangeRequest(row: Record<string, unknown>): CollaborationChangeRequest {
  return {
    id: String(row.id), draftId: String(row.draft_id), revisionId: String(row.revision_id),
    requestedBy: String(row.requested_by), requestingOrgId: String(row.requesting_org_id),
    targetType: row.target_type as CollaborationChangeRequest["targetType"], targetKey: String(row.target_key),
    reason: String(row.reason || ""), proposedChange: (row.proposed_change || {}) as Record<string, unknown>,
    status: row.status as CollaborationChangeRequest["status"], resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
    resolvedAt: time(row.resolved_at), createdAt: time(row.created_at) || 0,
  };
}
