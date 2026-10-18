import { supabase } from "../../../../lib/supabase";
import type {
  CollaborationOrganizationSelection,
  GovernanceAssignment,
  GovernanceAssignmentRole,
  GovernanceRecord,
  GovernanceSignoff,
  ProposalCloseout,
  ProposalCloseoutDecision,
  ProposalGovernanceState,
  TaskGovernanceMode,
} from "../types";
import { notifyCollaborationDraftsChanged } from "./collaborationDraftEvents";
import { getGovernanceLifecycleErrorMessage } from "./governanceLifecycleError";
import {governanceConfigurationError} from '../validation/governanceValidation';

const timestamp = (value: unknown) => value ? new Date(String(value)).getTime() : undefined;

export async function fetchProposalGovernanceState(draftId: string): Promise<ProposalGovernanceState> {
  const [assignments, signoffs, records, closeout, decisions] = await Promise.all([
    supabase.from("proposal_governance_assignments").select("*").eq("draft_id", draftId).order("created_at"),
    supabase.from("proposal_governance_signoffs").select("*").eq("draft_id", draftId).order("created_at", { ascending: false }),
    supabase.from("proposal_governance_records").select("*").eq("draft_id", draftId).order("updated_at", { ascending: false }),
    supabase.from("proposal_delivery_closeouts").select("*").eq("draft_id", draftId).maybeSingle(),
    supabase.from("proposal_delivery_closeout_decisions").select("*").eq("draft_id", draftId).order("created_at", { ascending: false }),
  ]);
  const error = assignments.error || signoffs.error || records.error || closeout.error || decisions.error;
  if (error) throw new Error(getGovernanceLifecycleErrorMessage(error));
  return {
    assignments: (assignments.data || []).map(mapAssignment),
    signoffs: (signoffs.data || []).map(mapSignoff),
    records: (records.data || []).map(mapRecord),
    closeout: closeout.data ? mapCloseout(closeout.data as Record<string, unknown>) : null,
    closeoutDecisions: (decisions.data || []).map(mapCloseoutDecision),
  };
}

export async function saveGovernanceConfiguration(input: {
  draftId: string;
  organizations: CollaborationOrganizationSelection[];
  assignments: Array<{ organizationId: string; userId: string; role: GovernanceAssignmentRole }>;
}) {
  const issue=governanceConfigurationError(input.organizations);if(issue)throw new Error(issue);
  const { error } = await supabase.rpc("set_proposal_governance_configuration", {
    p_draft_id: input.draftId,
    p_organizations: input.organizations,
    p_assignments: input.assignments,
  });
  if (error) throw new Error(error.message);
  notifyCollaborationDraftsChanged();
}

export async function recuseAndDelegateReview(input: {
  draftId: string;
  organizationId: string;
  reason: string;
  delegateTo?: string;
  validUntil?: string;
}) {
  const { error } = await supabase.rpc("recuse_and_delegate_collaboration_review", {
    p_draft_id: input.draftId,
    p_organization_id: input.organizationId,
    p_reason: input.reason,
    p_delegate_to: input.delegateTo || null,
    p_valid_until: input.validUntil || null,
  });
  if (error) throw new Error(error.message);
  notifyCollaborationDraftsChanged();
}

export async function saveGovernanceRecord(input: {
  draftId: string;
  organizationId: string;
  resolutionNumber?: string;
  meetingDate?: string;
  minutesFile?: File;
  endorsement?: string;
}) {
  let fileName: string | null = null;
  let filePath: string | null = null;
  if (input.minutesFile) {
    fileName = input.minutesFile.name;
    filePath = `${input.draftId}/governance/${input.organizationId}/${Date.now()}-${input.minutesFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const upload = await supabase.storage.from("proposal-drafts").upload(filePath, input.minutesFile, { upsert: false });
    if (upload.error) throw new Error(upload.error.message);
  }
  const { error } = await supabase.rpc("save_proposal_governance_record", {
    p_draft_id: input.draftId,
    p_organization_id: input.organizationId,
    p_resolution_number: input.resolutionNumber || null,
    p_meeting_date: input.meetingDate || null,
    p_minutes_file_name: fileName,
    p_minutes_file_path: filePath,
    p_endorsement: input.endorsement || null,
  });
  if (error) {
    if (filePath) await supabase.storage.from("proposal-drafts").remove([filePath]);
    throw new Error(error.message);
  }
  notifyCollaborationDraftsChanged();
}

export async function getGovernanceMinutesUrl(path: string) {
  const { data, error } = await supabase.storage.from("proposal-drafts").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not open the minutes attachment.");
  return data.signedUrl;
}

export async function requestProposalCloseout(draftId: string, note?: string) {
  const { error } = await supabase.rpc("request_proposal_closeout", { p_draft_id: draftId, p_note: note || null });
  if (error) throw new Error(getGovernanceLifecycleErrorMessage(error));
  notifyCollaborationDraftsChanged();
}

export async function decideProposalCloseout(input: {
  draftId: string;
  organizationId: string;
  decision: "approved" | "changes_requested" | "declined";
  reason?: string;
  resolutionNumber?: string;
  meetingDate?: string;
}) {
  const { error } = await supabase.rpc("decide_proposal_closeout", {
    p_draft_id: input.draftId,
    p_organization_id: input.organizationId,
    p_decision: input.decision,
    p_reason: input.reason || null,
    p_resolution_number: input.resolutionNumber || null,
    p_meeting_date: input.meetingDate || null,
  });
  if (error) throw new Error(getGovernanceLifecycleErrorMessage(error));
  notifyCollaborationDraftsChanged();
}

export async function completeProposalDelivery(draftId: string, note?: string) {
  const { error } = await supabase.rpc("complete_proposal_delivery", { p_draft_id: draftId, p_note: note || null });
  if (error) throw new Error(getGovernanceLifecycleErrorMessage(error));
  notifyCollaborationDraftsChanged();
}

export async function archiveProposalDelivery(draftId: string, reason: string) {
  const { error } = await supabase.rpc("archive_proposal_delivery", { p_draft_id: draftId, p_reason: reason });
  if (error) throw new Error(getGovernanceLifecycleErrorMessage(error));
  notifyCollaborationDraftsChanged();
}

export async function setTaskGovernanceRoute(taskId: string, mode: TaskGovernanceMode, governanceOrganizationId?: string) {
  const { error } = await supabase.rpc("set_task_governance_route", {
    p_task_id: taskId,
    p_mode: mode,
    p_governance_organization_id: governanceOrganizationId || null,
  });
  if (error) throw new Error(error.message);
}

export async function runGovernanceEscalations() {
  const { error } = await supabase.rpc("run_governance_review_escalations");
  if (error && !/function .* does not exist|schema cache/i.test(error.message)) throw new Error(error.message);
}

export function subscribeToProposalGovernance(draftId: string, callback: () => void) {
  const channel = supabase.channel(`proposal-governance-${draftId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_governance_assignments", filter: `draft_id=eq.${draftId}` }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_governance_signoffs", filter: `draft_id=eq.${draftId}` }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_governance_records", filter: `draft_id=eq.${draftId}` }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_delivery_closeouts", filter: `draft_id=eq.${draftId}` }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_delivery_closeout_decisions", filter: `draft_id=eq.${draftId}` }, callback)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

function mapAssignment(row: Record<string, unknown>): GovernanceAssignment {
  return { id: String(row.id), draftId: String(row.draft_id), organizationId: String(row.organization_id), userId: String(row.user_id), role: row.assignment_role as GovernanceAssignment["role"], assignedBy: String(row.assigned_by), delegatedBy: row.delegated_by ? String(row.delegated_by) : undefined, validUntil: timestamp(row.valid_until), createdAt: timestamp(row.created_at) || 0 };
}
function mapSignoff(row: Record<string, unknown>): GovernanceSignoff {
  return { id: String(row.id), draftId: String(row.draft_id), revisionId: String(row.revision_id), organizationId: String(row.organization_id), userId: String(row.user_id), decision: row.decision as GovernanceSignoff["decision"], reason: row.reason ? String(row.reason) : undefined, delegatedTo: row.delegated_to ? String(row.delegated_to) : undefined, createdAt: timestamp(row.created_at) || 0 };
}
function mapRecord(row: Record<string, unknown>): GovernanceRecord {
  return { id: String(row.id), draftId: String(row.draft_id), organizationId: String(row.organization_id), resolutionNumber: row.resolution_number ? String(row.resolution_number) : undefined, meetingDate: row.meeting_date ? String(row.meeting_date) : undefined, minutesFileName: row.minutes_file_name ? String(row.minutes_file_name) : undefined, minutesFilePath: row.minutes_file_path ? String(row.minutes_file_path) : undefined, endorsement: row.endorsement ? String(row.endorsement) : undefined, recordedBy: String(row.recorded_by), updatedAt: timestamp(row.updated_at) || 0 };
}
function mapCloseout(row: Record<string, unknown>): ProposalCloseout {
  return { draftId: String(row.draft_id), status: row.status as ProposalCloseout["status"], requestNote: row.request_note ? String(row.request_note) : undefined, requestedBy: row.requested_by ? String(row.requested_by) : undefined, requestedAt: timestamp(row.requested_at), approvedAt: timestamp(row.approved_at), completedBy: row.completed_by ? String(row.completed_by) : undefined, completedAt: timestamp(row.completed_at), archivedBy: row.archived_by ? String(row.archived_by) : undefined, archivedAt: timestamp(row.archived_at) };
}
function mapCloseoutDecision(row: Record<string, unknown>): ProposalCloseoutDecision {
  return { id: String(row.id), draftId: String(row.draft_id), organizationId: String(row.organization_id), decision: row.decision as ProposalCloseoutDecision["decision"], decidedBy: String(row.decided_by), reason: row.reason ? String(row.reason) : undefined, resolutionNumber: row.resolution_number ? String(row.resolution_number) : undefined, meetingDate: row.meeting_date ? String(row.meeting_date) : undefined, createdAt: timestamp(row.created_at) || 0 };
}
