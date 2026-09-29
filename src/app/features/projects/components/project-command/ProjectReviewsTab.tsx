import { Button, EmptyState, Label } from "@vibe/core";
import { Open } from "@vibe/icons";
import type { ProjectCommandData } from "./types";

export function ProjectReviewsTab({
  data,
  onOpenTask,
}: {
  data: ProjectCommandData;
  onOpenTask: (taskId: string) => void;
}) {
  const rows = data.facts.submissions.filter(
    (submission) =>
      submission.status === "pending" ||
      submission.status === "changes_requested",
  );
  const pendingTasks = rows.filter(
    (row) => row.kind === "task" && row.status === "pending",
  ).length;
  const pendingSubtasks = rows.filter(
    (row) => row.kind === "subtask" && row.status === "pending",
  ).length;
  const changes = rows.filter(
    (row) => row.status === "changes_requested",
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Review Metrics */}
      <div className="eflow-health-strip">
        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Task decisions</span>
          <div className="flex items-center gap-1.5">
            <span className="eflow-health-item-value text-amber-600">
              {pendingTasks}
            </span>
            <span className="text-xs text-secondary">waiting</span>
          </div>
        </div>
        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Subtask decisions</span>
          <div className="flex items-center gap-1.5">
            <span className="eflow-health-item-value text-blue-600">
              {pendingSubtasks}
            </span>
            <span className="text-xs text-secondary">waiting</span>
          </div>
        </div>
        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Updates needed</span>
          <div className="flex items-center gap-1.5">
            <span className="eflow-health-item-value text-red-600">
              {changes}
            </span>
            <span className="text-xs text-secondary">reworking</span>
          </div>
        </div>
      </div>

      <section className="eflow-section-card">
        <header>
          <h2>Project review queue</h2>
          <p className="m-0 mt-1 text-xs text-secondary">
            Open the task review workflow to inspect evidence and record an authorized decision.
          </p>
        </header>
        <div>
          {rows.length ? (
            <div className="divide-y divide-neutral-100">
              {rows.map((submission) => {
                const task = data.tasks.find(
                  (item) => item.id === submission.taskId,
                );
                const ageHours = Math.max(
                  0,
                  Math.floor((Date.now() - submission.submittedAt) / 3_600_000),
                );
                return (
                  <div
                    key={`${submission.kind}:${submission.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-neutral-50/70 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {task?.title || "Project task"}
                      </div>
                      <div className="mt-1 text-xs text-secondary">
                        {submission.kind === "subtask"
                          ? "Leader subtask decision"
                          : "Head task decision"}{" "}
                        · Submission {submission.version} ·{" "}
                        {submission.submitterName}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label
                        text={
                          submission.status === "changes_requested"
                            ? "Updates needed"
                            : "Waiting for review"
                        }
                        color={
                          submission.status === "changes_requested"
                            ? "negative"
                            : "working_orange"
                        }
                      />
                      <span className="text-xs text-secondary">{ageHours}h ago</span>
                      <Button
                        kind="secondary"
                        size="small"
                        rightIcon={Open}
                        onClick={() => onOpenTask(submission.taskId)}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No project reviews are waiting"
              description="Approved and completed work remains in the activity history."
            />
          )}
        </div>
      </section>
    </div>
  );
}
