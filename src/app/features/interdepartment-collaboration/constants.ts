import type { CollaborationDraftStatus, CollaborationParticipationRole } from "./types";

export const COLLABORATION_STATUS_LABELS: Record<CollaborationDraftStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  ready_to_commit: "Ready to publish",
  committed: "Committed",
  archived: "Archived",
  deleted: "Deleted",
};

export const PARTICIPATION_ROLE_LABELS: Record<CollaborationParticipationRole, string> = {
  owner: "Owner",
  participant: "Participant",
  governance: "Governance",
  observer: "Observer",
};

export const COLLABORATION_SOURCE_BUCKET = "proposal-drafts";
export const COLLABORATION_AUTOSAVE_DELAY_MS = 900;
