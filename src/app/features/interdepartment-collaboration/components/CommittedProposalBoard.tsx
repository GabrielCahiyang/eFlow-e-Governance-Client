import * as React from "react";
import { TextField } from "@vibe/core";
import { Workflow } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import type { UserProfile } from "../../../types";
import {
  getTaskTeamMemberIds,
  ScopedTaskKanban,
  TaskDetailDrawer,
} from "../../tasks";
import type { CommittedProposalDeliverySummary } from "../selectors/deliveryProgress";
import {
  countOverdueDeliveryTasks,
  filterCommittedProposalBoardTasks,
} from "../selectors/deliveryBoard";

export function CommittedProposalBoard({
  delivery,
  profiles,
  readOnly = false,
}: {
  delivery: CommittedProposalDeliverySummary;
  profiles: UserProfile[];
  readOnly?: boolean;
}) {
  const { user, userProfile } = useAuth();
  const [query, setQuery] = React.useState("");
  const [projectId, setProjectId] = React.useState("all");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
    null,
  );
  const currentUserId = user?.id || userProfile?.id || "";
  const boardRole = [
    "head",
    "head",
  ].includes(userProfile?.role || "")
    ? "head"
    : "member";

  const visibleTasks = React.useMemo(() => {
    return filterCommittedProposalBoardTasks(
      delivery.tasks,
      query,
      projectId,
    );
  }, [delivery.tasks, projectId, query]);

  const selectedTask = selectedTaskId
    ? delivery.tasks.find((task) => task.id === selectedTaskId) || null
    : null;
  const canPostProgress = Boolean(
    !readOnly &&
      selectedTask &&
      currentUserId &&
      getTaskTeamMemberIds(selectedTask).includes(currentUserId),
  );
  const overdueCount = countOverdueDeliveryTasks(delivery.tasks);

  return (
    <div className="space-y-4">
      {/* Board Pulse Strip */}
      <div className="eflow-health-strip">
        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Remaining tasks</span>
          <span className="eflow-health-item-value">
            {delivery.remainingTaskCount}
          </span>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">In review</span>
          <div className="flex items-center gap-1.5">
            <span className="eflow-health-item-value text-blue-600">
              {delivery.awaitingReviewCount}
            </span>
            <span className="text-xs text-secondary">waiting</span>
          </div>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Approved tasks</span>
          <div className="flex items-center gap-1.5">
            <span className="eflow-health-item-value text-emerald-600">
              {delivery.completedTaskCount}
            </span>
            <span className="text-xs text-secondary">
              ({delivery.progress}%)
            </span>
          </div>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Overdue</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`eflow-health-item-value ${overdueCount > 0 ? "text-red-600" : "text-neutral-900"}`}
            >
              {overdueCount}
            </span>
          </div>
        </div>
      </div>

      <section className="eflow-section-card">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Delivery Kanban board</h2>
            <p className="m-0 mt-1 text-xs text-secondary">
              Live task execution board grouped by status across all operational projects in this proposal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-64">
              <TextField
                value={query}
                onChange={setQuery}
                placeholder="Search delivery tasks…"
                inputAriaLabel="Search proposal tasks"
              />
            </div>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="eflow-control"
              aria-label="Filter by project"
            >
              <option value="all">All proposal projects</option>
              {delivery.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="p-4">
          {visibleTasks.length > 0 ? (
            <ScopedTaskKanban
              tasks={visibleTasks}
              profiles={profiles}
              role={boardRole}
              currentUserId={currentUserId}
              currentUserName={
                userProfile?.full_name || userProfile?.fullName || ""
              }
              readOnly={readOnly}
              onOpenTask={(task) => setSelectedTaskId(task.id)}
            />
          ) : (
            <div className="py-16 text-center">
              <Workflow size={28} className="mx-auto text-neutral-300" />
              <div className="mt-3 text-sm font-semibold text-neutral-800">
                No matching delivery tasks
              </div>
              <p className="mt-1 text-xs text-secondary">
                Clear the search query or select another project filter.
              </p>
            </div>
          )}
        </div>
      </section>

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          canReview={false}
          canPostProgress={canPostProgress}
          canDiscuss={true}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
