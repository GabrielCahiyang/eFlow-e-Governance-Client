import { supabase } from "../../../../lib/supabase";
import type { CollaborationDraft } from "../types";
import { rowToCollaborationApproval, rowToCollaborationParticipant } from "./collaborationMappers";

/** Batch reads retain the caller's existing Supabase visibility rules. */
export async function fetchApprovalPortfolio(drafts: CollaborationDraft[]) {
  if (!drafts.length) return { participants: [], approvals: [] };
  const revisionIds = drafts.flatMap((draft) => draft.currentRevisionId ? [draft.currentRevisionId] : []);
  const [participants, approvals] = await Promise.all([
    supabase.from("proposal_collaboration_orgs").select("*").in("draft_id", drafts.map((draft) => draft.id)),
    revisionIds.length ? supabase.from("proposal_collaboration_approvals").select("*").in("revision_id", revisionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (participants.error || approvals.error) throw new Error((participants.error || approvals.error)!.message);
  return {
    participants: (participants.data || []).map((row) => rowToCollaborationParticipant(row as Record<string, unknown>)),
    approvals: (approvals.data || []).map((row) => rowToCollaborationApproval(row as Record<string, unknown>)),
  };
}
