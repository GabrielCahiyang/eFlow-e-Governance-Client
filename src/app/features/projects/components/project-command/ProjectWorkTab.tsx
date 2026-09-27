import { AlertCircle, Calendar, CheckSquare, ChevronDown, Clock, Layers, MoreVertical, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import type { UserProfile } from "../../../../types";
import { useToast } from "../../../../components/ui/Toast";
import { getTaskLeadId, isOverdue, TaskTeamEditorDialog, updateTask, type Task } from "../../../tasks";
import type { ProjectCommandData } from "./types";

type BoardColumn = {
  id: "todo" | "in_progress" | "for_review" | "completed";
  label: string;
  statuses: string[];
  tone: string;
};

// The four visual lanes follow the Figma source. They deliberately group the
// richer eFlow lifecycle instead of changing it. Changes requested is still
// persisted as its own status but is shown with active work for quick triage.
export const FIGMA_PROJECT_BOARD_COLUMNS: BoardColumn[] = [
  { id: "todo", label: "TO DO", statuses: ["pending_assignment", "todo"], tone: "#ed5e56" },
  { id: "in_progress", label: "IN PROGRESS", statuses: ["in_progress", "changes_requested"], tone: "#3182f6" },
  { id: "for_review", label: "FOR REVIEW", statuses: ["for_review"], tone: "#52cc79" },
  { id: "completed", label: "DONE", statuses: ["completed", "approved", "cancelled"], tone: "#52cc79" },
];

export function groupProjectTasksForFigmaBoard(tasks: Task[]) {
  return new Map(
    FIGMA_PROJECT_BOARD_COLUMNS.map((column) => [
      column.id,
      tasks.filter((task) => column.statuses.includes(task.status)),
    ]),
  );
}

const AVATAR_PALETTE = [
  "bg-indigo-600 text-white",
  "bg-violet-600 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-teal-600 text-white",
  "bg-purple-600 text-white",
];

function getAvatarColorClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % AVATAR_PALETTE.length;
  }
  return AVATAR_PALETTE[hash];
}

export function ProjectWorkTab({
  data,
  profiles,
  onOpenTask,
  canManage = false,
}: {
  data: ProjectCommandData;
  profiles: UserProfile[];
  onOpenTask: (taskId: string) => void;
  canManage?: boolean;
}) {
  const { toast } = useToast();
  const [teamTaskId, setTeamTaskId] = useState<string | null>(null);
  const tasksByColumn = useMemo(
    () => groupProjectTasksForFigmaBoard(data.tasks),
    [data.tasks],
  );
  const teamTask = data.tasks.find((task) => task.id === teamTaskId) || null;

  return (
    <section className="eflow-figma-board" aria-label="Project task board">
      <div className="eflow-figma-board__columns">
        {FIGMA_PROJECT_BOARD_COLUMNS.map((column) => (
          <section className="eflow-figma-board__column" key={column.id}>
            <header className="eflow-figma-board__column-header">
              <span className="eflow-figma-board__column-title">
                <i style={{ backgroundColor: column.tone }} />
                {column.label}
              </span>
              <span className="eflow-figma-board__count">{tasksByColumn.get(column.id)?.length || 0}</span>
            </header>
            <div className="eflow-figma-board__cards">
              {(tasksByColumn.get(column.id) || []).map((task) => (
                <TaskBoardCard
                  canManage={canManage && data.project.status !== "archived"}
                  data={data}
                  key={task.id}
                  onManageTeam={() => setTeamTaskId(task.id)}
                  onOpen={() => onOpenTask(task.id)}
                  profiles={profiles}
                  task={task}
                  onActivityChange={async (milestoneId) => {
                    const milestone = data.milestones.find((item) => item.id === milestoneId);
                    if (!milestone) return;
                    try {
                      await updateTask(task.id, { linkedProjectId: data.project.id, milestoneId });
                      toast(`Task moved to ${milestone.title}.`, "success");
                    } catch (error: any) {
                      toast(error?.message || "Could not move the task to that activity.", "error");
                    }
                  }}
                />
              ))}
              {(tasksByColumn.get(column.id) || []).length === 0 && <p className="eflow-figma-board__empty">No tasks</p>}
            </div>
          </section>
        ))}
      </div>

      <TaskTeamEditorDialog
        task={teamTask}
        profiles={profiles}
        subtasks={teamTask ? data.facts.subtasks.filter((subtask) => subtask.taskId === teamTask.id) : []}
        responsibleOrgId={teamTask?.orgId || data.project.orgId}
        onClose={() => setTeamTaskId(null)}
      />
    </section>
  );
}

function TaskBoardCard({
  canManage,
  data,
  onManageTeam,
  onActivityChange,
  onOpen,
  profiles,
  task,
}: {
  canManage: boolean;
  data: ProjectCommandData;
  onManageTeam: () => void;
  onOpen: () => void;
  profiles: UserProfile[];
  task: Task;
  onActivityChange: (milestoneId: string) => Promise<void>;
}) {
  const assignedIds = Array.from(new Set([getTaskLeadId(task), ...(task.teamMemberIds || [])].filter(Boolean)));
  const people = assignedIds.map((id) => profiles.find((profile) => profile.id === id)).filter(Boolean) as UserProfile[];
  const visiblePeople = people.slice(0, 3);
  const remainingCount = people.length - visiblePeople.length;
  const evidenceCount = data.facts.evidence.filter((evidence) => evidence.taskId === task.id).length;
  const subtaskCount = data.facts.subtasks.filter((subtask) => subtask.taskId === task.id).length;
  const awaitingReview = data.facts.submissions.some((submission) => submission.taskId === task.id && submission.status === "pending");
  const isCompleted = task.status === "completed";
  const progress = isCompleted ? 100 : task.status === "cancelled" ? 0 : Math.max(0, Math.min(100, task.percentComplete || 0));
  const category = task.activityTitle || task.programTitle || "Project work";

  const dateValue = task.deadline || task.dueDate;
  const isOverdueTask = !isCompleted && isOverdue(task);

  return (
    <article
      className="eflow-figma-task-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {/* Top row: Activity Badge / Priority and Action Menu */}
      <div className="eflow-figma-task-card__topline">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className={`eflow-figma-task-card__tag eflow-figma-task-card__tag--${task.priority || "medium"}`}>
            <Layers size={11} className="shrink-0 opacity-75" />
            <span className="truncate">{category}</span>
          </span>
          {task.priority && task.priority !== "medium" && (
            <span className={`eflow-figma-task-card__priority eflow-figma-task-card__priority--${task.priority}`}>
              {task.priority}
            </span>
          )}
        </div>

        <button
          aria-label={`Manage ${task.title}`}
          className="eflow-figma-task-card__menu"
          onClick={(event) => {
            event.stopPropagation();
            canManage ? onManageTeam() : onOpen();
          }}
          type="button"
          title={canManage ? "Manage team & assignment" : "View details"}
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Task Content: Title & Description */}
      <div className="eflow-figma-task-card__content">
        <h3 className="eflow-figma-task-card__title">{task.title}</h3>
        {task.description && (
          <p className="eflow-figma-task-card__description">{task.description}</p>
        )}
      </div>

      {/* Signals & Due Date */}
      <div className="eflow-figma-task-card__signals">
        {task.status === "cancelled" && (
          <span className="eflow-figma-task-card__signal eflow-figma-task-card__signal--cancelled">
            Cancelled
          </span>
        )}
        {task.status === "changes_requested" && (
          <span className="eflow-figma-task-card__signal eflow-figma-task-card__signal--warning">
            <AlertCircle size={11} /> Changes requested
          </span>
        )}
        {awaitingReview && (
          <span className="eflow-figma-task-card__signal eflow-figma-task-card__signal--review">
            <Clock size={11} /> Review waiting
          </span>
        )}
        {dateValue && (
          <span className={`eflow-figma-task-card__due ${isOverdueTask ? "eflow-figma-task-card__due--overdue" : ""}`}>
            <Calendar size={12} />
            <span>{dateValue}</span>
          </span>
        )}
      </div>

      {/* In-place Activity Selector for Managers */}
      {canManage && data.milestones.length > 0 && (
        <div
          className="eflow-figma-task-card__activity-row"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="eflow-figma-task-card__activity-label">Activity</span>
          <div className="eflow-figma-task-card__activity-select-wrapper">
            <select
              value={task.milestoneId || ""}
              onChange={(event) => {
                event.stopPropagation();
                void onActivityChange(event.target.value);
              }}
            >
              <option value="">Unassigned</option>
              {data.milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="eflow-figma-task-card__activity-arrow" />
          </div>
        </div>
      )}

      {/* Progress Track */}
      <div
        className="eflow-figma-task-card__progress"
        aria-label={`${progress}% complete`}
      >
        <span
          className={`eflow-figma-task-card__progress-bar ${isCompleted ? "eflow-figma-task-card__progress-bar--complete" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Footer: Assignee Stack & Metadata */}
      <footer className="eflow-figma-task-card__footer">
        <div className="eflow-figma-task-card__people" aria-label={`${people.length} assigned team members`}>
          {visiblePeople.map((person) => {
            const name = person.full_name || person.fullName || person.email || "?";
            const initials = name
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <span
                key={person.id}
                className={`eflow-figma-task-card__avatar ${getAvatarColorClass(person.id)}`}
                title={name}
              >
                {initials}
              </span>
            );
          })}
          {remainingCount > 0 && (
            <span
              className="eflow-figma-task-card__avatar eflow-figma-task-card__avatar--more"
              title={`${remainingCount} more member${remainingCount > 1 ? "s" : ""}`}
            >
              +{remainingCount}
            </span>
          )}
          {people.length === 0 && (
            <span className="eflow-figma-task-card__unassigned">Unassigned</span>
          )}
        </div>

        <div className="eflow-figma-task-card__metadata">
          {evidenceCount > 0 && (
            <span className="eflow-figma-task-card__meta-item" title={`${evidenceCount} attachment${evidenceCount > 1 ? "s" : ""}`}>
              <Paperclip size={13} />
              <span>{evidenceCount}</span>
            </span>
          )}
          {subtaskCount > 0 && (
            <span className="eflow-figma-task-card__meta-item" title={`${task.subtaskCompletedCount || 0} of ${subtaskCount} steps completed`}>
              <CheckSquare size={13} />
              <span>{task.subtaskCompletedCount || 0}/{subtaskCount}</span>
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}
