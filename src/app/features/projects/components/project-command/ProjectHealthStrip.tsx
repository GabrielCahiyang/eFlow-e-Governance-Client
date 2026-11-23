import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ProjectScheduleLabel, ProjectUnifiedStatus } from "../../presentation/projectPresentation";
import type { Project } from "../../services/types";
import type { ProjectCommandMetrics } from "./types";

export function ProjectHealthStrip({
  metrics,
  project,
}: {
  metrics: ProjectCommandMetrics;
  project?: Project;
}) {
  const totalAttention =
    metrics.overdue + metrics.blocked + metrics.changesRequested;

  return (
    <div className="space-y-2">
      {metrics.completionRecommended && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">
              Project completion is ready for review.
            </span>{" "}
            All linked tasks are approved, but the project is still active.
            Review its activities and mark it completed when appropriate.
          </div>
        </div>
      )}
      {!metrics.completionRecommended &&
        metrics.scheduleHealth === "overdue" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">
                The project target date has passed.
              </span>{" "}
              Outstanding tasks, reviews, or activities still need attention.
            </div>
          </div>
        )}

      {/* Single Compact Operational Pulse Strip */}
      <div className="eflow-health-strip">
        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Progress</span>
          <div className="flex items-center gap-2">
            <span className="eflow-health-item-value">{metrics.progress}%</span>
            <span className="text-xs text-secondary">
              ({metrics.taskCompleted}/{metrics.taskTotal} tasks)
            </span>
          </div>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Status</span>
          <div>
            {project ? (
              <ProjectUnifiedStatus project={project} health={metrics.scheduleHealth} layout="inline" />
            ) : (
              <ProjectScheduleLabel health={metrics.scheduleHealth} />
            )}
          </div>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Activities</span>
          <div className="flex items-center gap-2">
            <span className="eflow-health-item-value">
              {metrics.milestoneOpen} open
            </span>
            <span className="text-xs text-secondary">
              ({metrics.milestoneCompleted} done)
            </span>
          </div>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Needs attention</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`eflow-health-item-value ${totalAttention > 0 ? "text-amber-600" : "text-neutral-900"}`}
            >
              {totalAttention}
            </span>
            {totalAttention > 0 && (
              <span className="text-xs text-secondary">
                ({metrics.overdue} overdue · {metrics.blocked} blocked)
              </span>
            )}
          </div>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Review queue</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`eflow-health-item-value ${metrics.awaitingReview > 0 ? "text-blue-600" : "text-neutral-900"}`}
            >
              {metrics.awaitingReview}
            </span>
            {metrics.changesRequested > 0 && (
              <span className="text-xs text-secondary">
                ({metrics.changesRequested} returned)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
