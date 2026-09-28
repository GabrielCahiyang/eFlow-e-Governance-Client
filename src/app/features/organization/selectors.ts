import type { Organization, UserProfile } from "../../types";
import {
  resolveLeadershipReviewer,
  type LeadershipReviewerResolution,
} from "../../shared/organizationLeadership";

export type { LeadershipReviewerResolution } from "../../shared/organizationLeadership";

export function resolveOrganizationLeadershipReviewer(
  organization: Pick<Organization, "head_user_id" | "assistant_head_user_id">,
  taskLeadId: string | null | undefined,
): LeadershipReviewerResolution | null {
  return resolveLeadershipReviewer(
    taskLeadId,
    organization.head_user_id,
    organization.assistant_head_user_id,
  );
}

export function getLeadershipCandidates(
  profiles: UserProfile[],
  organizations: Organization[],
  organizationId?: string,
  allowSecondaryOrganizationLeadership = false,
): UserProfile[] {
  const assignedElsewhere = new Set(
    organizations
      .filter((organization) => organization.id !== organizationId)
      .flatMap((organization) => [
        organization.head_user_id,
        organization.assistant_head_user_id,
      ])
      .filter((id): id is string => Boolean(id)),
  );

  return profiles.filter(
    (profile) =>
      profile.is_active &&
      profile.role !== "super_admin" &&
      profile.role !== "admin" &&
      // A normal Head or Assistant Head is selected from the organization
      // they already belong to. This deliberately does not move people out of
      // another office as a side-effect of assigning leadership.
      (allowSecondaryOrganizationLeadership || profile.org_id === organizationId) &&
      (allowSecondaryOrganizationLeadership || !assignedElsewhere.has(profile.id)),
  );
}

export function filterLeadershipCandidates(
  candidates: UserProfile[],
  query: string,
  organizations: Organization[],
): UserProfile[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return candidates;

  const organizationNames = new Map(
    organizations.map((organization) => [organization.id, organization.name]),
  );

  return candidates.filter((candidate) => {
    const organizationName = candidate.org_name ||
      (candidate.org_id ? organizationNames.get(candidate.org_id) : "") || "";
    const searchableText = [
      candidate.full_name,
      candidate.email,
      candidate.employee_id,
      candidate.role,
      organizationName,
    ].join(" ").toLocaleLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
