export interface LeadershipReviewerResolution { reviewerId: string | null; reviewerRole: "head"; }
/** Ordinary office output is finalized by its Head, including the Head's own work. */
export function resolveLeadershipReviewer(
  taskLeadId: string | null | undefined, headUserId: string | null | undefined,
): LeadershipReviewerResolution | null {
  return taskLeadId ? { reviewerId: headUserId || null, reviewerRole: "head" } : null;
}
