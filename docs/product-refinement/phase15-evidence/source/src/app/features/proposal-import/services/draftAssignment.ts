export interface DraftAssignment {
  memberIds: string[];
  leadId: string | null;
}

function uniqueIds(ids: readonly string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function normalizeDraftAssignment(
  memberIds: readonly string[],
  leadId: string | null,
): DraftAssignment {
  const normalizedMemberIds = uniqueIds(memberIds);

  return {
    memberIds: normalizedMemberIds,
    leadId:
      leadId && normalizedMemberIds.includes(leadId)
        ? leadId
        : normalizedMemberIds[0] || null,
  };
}

export function toggleDraftAssignmentMember(
  assignment: DraftAssignment,
  memberId: string,
): DraftAssignment {
  const isSelected = assignment.memberIds.includes(memberId);
  const memberIds = isSelected
    ? assignment.memberIds.filter((id) => id !== memberId)
    : [...assignment.memberIds, memberId];

  return normalizeDraftAssignment(memberIds, assignment.leadId);
}

export function selectDraftAssignmentLead(
  assignment: DraftAssignment,
  leadId: string,
): DraftAssignment {
  if (!assignment.memberIds.includes(leadId)) return assignment;
  return { ...assignment, leadId };
}
