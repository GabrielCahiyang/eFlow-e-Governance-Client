import type {
  CollaborationDraftSnapshot,
  CollaborationOrganizationSelection,
  CollaborationParticipationRole,
} from "../types";

export function normalizeCollaborationParticipationRole(value: unknown): CollaborationParticipationRole {
  if (value === "consulted" || value === "observer") return "observer";
  if (value === "participant" || value === "governance" || value === "owner") return value;
  return "observer";
}

export function normalizeCollaborationOrganization(
  selection: CollaborationOrganizationSelection | (Omit<CollaborationOrganizationSelection, "participationRole"> & { participationRole: unknown }),
): CollaborationOrganizationSelection {
  const participationRole = normalizeCollaborationParticipationRole(selection.participationRole);
  return {
    ...selection,
    participationRole,
    staffingEnabled: participationRole === "owner" || participationRole === "participant"
      ? Boolean(selection.staffingEnabled)
      : false,
  };
}

export function normalizeCollaborationSnapshot(snapshot: CollaborationDraftSnapshot): CollaborationDraftSnapshot {
  return {
    ...snapshot,
    organizations: (snapshot.organizations || []).map(normalizeCollaborationOrganization),
  };
}
