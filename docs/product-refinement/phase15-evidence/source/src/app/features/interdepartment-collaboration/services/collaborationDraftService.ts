import { supabase } from "../../../../lib/supabase";
import { COLLABORATION_SOURCE_BUCKET } from "../constants";
import type { CollaborationDraft, CollaborationDraftSnapshot, CollaborationOrganizationSelection, CollaborationRevision, CollaborationSourceType } from "../types";
import { rowToCollaborationDraft, rowToCollaborationParticipant, rowToCollaborationRevision } from "./collaborationMappers";
import { notifyCollaborationDraftsChanged, subscribeToLocalCollaborationDraftChanges } from "./collaborationDraftEvents";
import { normalizeCollaborationOrganization, normalizeCollaborationSnapshot } from "../selectors/participationRole";

function databaseUpgradeError(error: { code?: string; message: string }) {
  if (error.code === "PGRST202" || error.message.includes("collaboration")) {
    return new Error("The inter-office collaboration database migrations have not been applied yet.");
  }
  return new Error(error.message);
}

export async function fetchCollaborationDrafts(): Promise<CollaborationDraft[]> {
  const { data, error } = await supabase.from("proposal_collaboration_drafts").select("*").neq("status", "deleted").order("updated_at", { ascending: false });
  if (error) throw databaseUpgradeError(error);
  const drafts = (data || []).map((row) => rowToCollaborationDraft(row as Record<string, unknown>));
  const revisionIds = drafts.map((draft) => draft.currentRevisionId).filter((id): id is string => Boolean(id));
  if (revisionIds.length === 0) return drafts.map((draft) => ({ ...draft, approvedOrganizations: 0, requiredOrganizations: draft.snapshot.organizations.filter((item) => item.participationRole === "participant" || item.participationRole === "governance").length }));
  const [revisionResult, approvalResult] = await Promise.all([
    supabase.from("proposal_collaboration_revisions").select("id,revision_number").in("id", revisionIds),
    supabase.from("proposal_collaboration_approvals").select("revision_id,organization_id,decision").in("revision_id", revisionIds),
  ]);
  if (revisionResult.error) throw databaseUpgradeError(revisionResult.error);
  if (approvalResult.error) throw databaseUpgradeError(approvalResult.error);
  const revisionNumberById = new Map((revisionResult.data || []).map((row) => [String(row.id), Number(row.revision_number)]));
  const ownerOrgByRevision = new Map(drafts.filter((draft) => draft.currentRevisionId).map((draft) => [draft.currentRevisionId!, draft.ownerOrgId]));
  const approvedByRevision = new Map<string, number>();
  (approvalResult.data || []).forEach((row) => {
    if (row.decision !== "approved") return;
    const id = String(row.revision_id);
    if (String(row.organization_id) === ownerOrgByRevision.get(id)) return;
    approvedByRevision.set(id, (approvedByRevision.get(id) || 0) + 1);
  });
  return drafts.map((draft) => ({
    ...draft,
    currentRevisionNumber: draft.currentRevisionId ? revisionNumberById.get(draft.currentRevisionId) : undefined,
    approvedOrganizations: draft.currentRevisionId ? approvedByRevision.get(draft.currentRevisionId) || 0 : 0,
    requiredOrganizations: draft.snapshot.organizations.filter((item) => item.participationRole === "participant" || item.participationRole === "governance").length,
  }));
}

export async function fetchCollaborationDraft(draftId: string) {
  const [draftResult, participantResult, revisionResult] = await Promise.all([
    // A primary-key lookup cannot legitimately return multiple rows. Using
    // maybeSingle distinguishes an absent/RLS-hidden draft from a cardinality
    // problem instead of surfacing PostgREST's misleading coercion error.
    supabase.from("proposal_collaboration_drafts").select("*").eq("id", draftId).maybeSingle(),
    supabase.from("proposal_collaboration_orgs").select("*").eq("draft_id", draftId).order("created_at"),
    supabase.from("proposal_collaboration_revisions").select("*").eq("draft_id", draftId).order("revision_number", { ascending: false }),
  ]);
  if (draftResult.error) throw databaseUpgradeError(draftResult.error);
  if (!draftResult.data) throw new Error("This proposal could not be found or your account does not have access to its Source & governance workspace.");
  if (participantResult.error) throw participantResult.error;
  if (revisionResult.error) throw revisionResult.error;
  return {
    draft: rowToCollaborationDraft(draftResult.data as Record<string, unknown>),
    participants: (participantResult.data || []).map((row) => rowToCollaborationParticipant(row as Record<string, unknown>)),
    revisions: (revisionResult.data || []).map((row) => rowToCollaborationRevision(row as Record<string, unknown>)),
  };
}

export async function createCollaborationDraft(input: {
  title: string;
  ownerOrgId: string;
  sourceType: CollaborationSourceType;
  snapshot: CollaborationDraftSnapshot;
  sourceFile?: File;
}): Promise<CollaborationDraft> {
  const normalizedSnapshot = normalizeCollaborationSnapshot(input.snapshot);
  // Older live installations accepted only participant/governance during the
  // creation transaction. Create with a compatible scope, then immediately
  // publish the full additive participation levels through the new RPC.
  const hasAdvisoryOrganizations = normalizedSnapshot.organizations.some((item) => item.participationRole === "observer");
  const compatibleSnapshot: CollaborationDraftSnapshot = hasAdvisoryOrganizations ? {
    ...normalizedSnapshot,
    organizations: normalizedSnapshot.organizations.map((item) => item.participationRole === "observer"
      ? { ...item, participationRole: "participant", staffingEnabled: false }
      : item),
  } : normalizedSnapshot;
  const { data, error } = await supabase.rpc("create_collaboration_draft", {
    p_title: input.title,
    p_owner_org_id: input.ownerOrgId,
    p_source_type: input.sourceType,
    p_source_file_name: input.sourceFile?.name || null,
    p_source_file_path: null,
    p_source_file_hash: null,
    p_snapshot: compatibleSnapshot,
  });
  if (error) throw databaseUpgradeError(error);
  const draft = rowToCollaborationDraft((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
  if (hasAdvisoryOrganizations) {
    try { await setCollaborationOrganizations(draft.id, normalizedSnapshot.organizations, normalizedSnapshot); }
    catch (scopeError) { await softDeleteFailedSourceDraft(draft.id).catch(() => undefined); throw scopeError; }
  }
  if (input.sourceFile) {
    try {
      await uploadCollaborationSource(draft.id, input.sourceFile, { cleanupOnMetadataFailure: true });
    } catch (uploadError) {
      await softDeleteFailedSourceDraft(draft.id).catch(() => undefined);
      throw uploadError;
    }
  }
  notifyCollaborationDraftsChanged();
  return { ...draft, snapshot: normalizedSnapshot };
}

export async function autosaveCollaborationDraft(
  draftId: string,
  title: string,
  snapshot: CollaborationDraftSnapshot,
): Promise<CollaborationDraft> {
  const { data, error } = await supabase.rpc("autosave_collaboration_draft", {
    p_draft_id: draftId,
    p_title: title,
    p_snapshot: normalizeCollaborationSnapshot(snapshot),
  });
  if (error) throw databaseUpgradeError(error);
  const draft = rowToCollaborationDraft((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
  notifyCollaborationDraftsChanged();
  return draft;
}

async function softDeleteFailedSourceDraft(draftId: string) {
  const { error } = await supabase.rpc("soft_delete_collaboration_draft", {
    p_draft_id: draftId,
    p_reason: "Source document upload failed during draft creation",
  });
  if (error) throw error;
}

export async function uploadCollaborationSource(draftId: string, file: File, options: { cleanupOnMetadataFailure?: boolean } = {}) {
  const bytes = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `${draftId}/source.pdf`;
  const { error: uploadError } = await supabase.storage.from(COLLABORATION_SOURCE_BUCKET).upload(path, file, { upsert: true, contentType: "application/pdf" });
  if (uploadError) throw uploadError;
  const { error } = await supabase.rpc("set_collaboration_source_document", {
    p_draft_id: draftId, p_source_file_name: file.name, p_source_file_path: path, p_source_file_hash: hash,
  });
  if (error) {
    if (options.cleanupOnMetadataFailure) await supabase.storage.from(COLLABORATION_SOURCE_BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }
  notifyCollaborationDraftsChanged();
}

export async function getCollaborationSourceUrl(path: string) {
  const { data, error } = await supabase.storage.from(COLLABORATION_SOURCE_BUCKET).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function saveCollaborationRevision(draftId: string, snapshot: CollaborationDraftSnapshot, changeSummary: string): Promise<CollaborationRevision> {
  const normalizedSnapshot = normalizeCollaborationSnapshot(snapshot);
  const { data, error } = await supabase.rpc("save_collaboration_revision", {
    p_draft_id: draftId, p_snapshot: normalizedSnapshot, p_change_summary: changeSummary,
  });
  if (error) throw databaseUpgradeError(error);
  const revision = rowToCollaborationRevision((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
  notifyCollaborationDraftsChanged();
  return revision;
}

export async function saveCollaborationStaffingRevision(
  draftId: string,
  organizationId: string,
  snapshot: CollaborationDraftSnapshot,
  changeSummary: string,
): Promise<CollaborationRevision> {
  const normalizedSnapshot = normalizeCollaborationSnapshot(snapshot);
  const { data, error } = await supabase.rpc("save_collaboration_staffing_revision", {
    p_draft_id: draftId,
    p_organization_id: organizationId,
    p_snapshot: normalizedSnapshot,
    p_change_summary: changeSummary,
  });
  if (error) throw databaseUpgradeError(error);
  const revision = rowToCollaborationRevision((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
  notifyCollaborationDraftsChanged();
  return revision;
}

export async function setCollaborationOrganizations(
  draftId: string,
  organizations: CollaborationOrganizationSelection[],
  snapshot: CollaborationDraftSnapshot,
): Promise<CollaborationRevision> {
  const normalizedOrganizations = organizations.map(normalizeCollaborationOrganization);
  const normalizedSnapshot = normalizeCollaborationSnapshot(snapshot);
  const { data, error } = await supabase.rpc("set_collaboration_organizations", {
    p_draft_id: draftId,
    p_organizations: normalizedOrganizations.filter((item) => item.participationRole !== "owner"),
    p_snapshot: normalizedSnapshot,
    p_change_summary: "Collaboration scope updated",
  });
  if (error) throw databaseUpgradeError(error);
  const revision = rowToCollaborationRevision((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
  notifyCollaborationDraftsChanged();
  return revision;
}

export async function deleteCollaborationDraft(draftId: string, reason: string) {
  const { error } = await supabase.rpc("soft_delete_collaboration_draft", { p_draft_id: draftId, p_reason: reason });
  if (error) throw error;
  notifyCollaborationDraftsChanged();
}

export async function fetchMyCollaborationMemberships(userId: string) {
  const { data, error } = await supabase.from("organization_memberships")
    .select("organization_id,membership_role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    organizationId: String(row.organization_id),
    membershipRole: String(row.membership_role) as "member" | "primary_approver" | "backup_approver",
  }));
}

export function subscribeToCollaborationDraftChanges(callback: () => void) {
  const unsubscribeLocal = subscribeToLocalCollaborationDraftChanges(callback);
  const channel = supabase.channel(`collaboration-drafts-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_collaboration_drafts" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_collaboration_orgs" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "proposal_collaboration_approvals" }, callback)
    .subscribe();
  return () => {
    unsubscribeLocal();
    void supabase.removeChannel(channel);
  };
}
