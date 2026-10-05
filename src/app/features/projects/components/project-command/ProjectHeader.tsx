import type { Organization, UserProfile } from "../../../../types";
import type { Project } from "../../services/types";
import { ProjectStatusBadge } from "../../presentation/projectPresentation";
import type { ProjectCommandMetrics } from "./types";

export function ProjectHeader({
  project,
  organizations,
  profiles,
  metrics,
  hideTitle = false,
}: {
  project: Project;
  organizations: Organization[];
  profiles?: UserProfile[];
  metrics?: ProjectCommandMetrics;
  hideTitle?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
  onBack?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  onOpenProposalContext?: () => void;
  onOpenTool?: (tool: "reviews" | "activity" | "reports") => void;
  hasProposalContext?: boolean;
}) {
  const organization = organizations.find((item) => item.id === project.orgId);
  const owner = profiles?.find((p) => p.id === project.ownerId);
  const archived = project.status === "archived";

  return (
    <header className="space-y-2.5 pb-2 font-sans">
      {/* Project identity and utilities stay below the persistent workspace tabs. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Status badge */}
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} health={metrics?.scheduleHealth} />
            {organization && (
              <span className="text-xs text-neutral-600 font-medium">
                {organization.name}
              </span>
            )}
            {owner && (
              <>
                <span className="text-xs text-neutral-300">·</span>
                <span className="text-xs text-neutral-600 font-medium">
                  {owner.full_name}
                </span>
              </>
            )}
          </div>

          {/* Project Title */}
          {!hideTitle && <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            {project.title}
          </h1>}

          {/* Compact summary line in header */}
          {metrics && (
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <strong className="font-semibold text-neutral-800">{metrics.progress}% complete</strong>
              <span>·</span>
              <span>{metrics.milestoneOpen + metrics.milestoneCompleted} activities</span>
              <span>·</span>
              <span>{metrics.taskTotal} tasks</span>
              {metrics.overdue > 0 && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-red-600">
                    {metrics.overdue} overdue
                  </span>
                </>
              )}
              {metrics.awaitingReview > 0 && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-amber-600">
                    {metrics.awaitingReview} awaiting review
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {archived && (
        <div
          role="status"
          className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700"
        >
          Archived projects are read-only. History and reports remain available.
        </div>
      )}
    </header>
  );
}
