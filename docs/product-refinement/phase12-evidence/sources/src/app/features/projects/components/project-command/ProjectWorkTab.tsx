import { AlertCircle, ArrowLeft, Calendar, CheckSquare, ChevronDown, Clock, Layers, MoreVertical, Paperclip, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { UserProfile } from "../../../../types";
import { useToast } from "../../../../components/ui/Toast";
import { getTaskLeadId, isOverdue, updateTask, TASK_STATUS_LABELS, type Task, type TaskStatus } from "../../../tasks";
import { useProjectViewActions } from '../../../project-views';
import type { ProjectCommandData } from "./types";

type BoardColumn = {
  id: TaskStatus;
  label: string;
  statuses: string[];
  tone: string;
};

// Preserve canonical lifecycle states while keeping the four primary lanes.
export const FIGMA_PROJECT_BOARD_COLUMNS: BoardColumn[] = [
  { id: "todo", label: "TO DO", statuses: ["pending_assignment", "todo"], tone: "#ed5e56" },
  { id: "in_progress", label: "IN PROGRESS", statuses: ["in_progress"], tone: "#f4ae36" },
  { id: "for_review", label: "FOR REVIEW", statuses: ["for_review"], tone: "#8b6be8" },
  { id: "completed", label: "COMPLETED", statuses: ["completed"], tone: "#00b97d" },
  { id: "changes_requested", label: "CHANGES REQUESTED", statuses: ["changes_requested"], tone: "#df526d" },
  { id: "cancelled", label: "CANCELLED", statuses: ["cancelled"], tone: "#76808c" },
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
  onOpenTable,
  canManage = false,
}: {
  data: ProjectCommandData;
  profiles: UserProfile[];
  onOpenTask: (taskId: string) => void;
  onOpenTable?: () => void;
  canManage?: boolean;
}) {
  const { toast } = useToast();
  const [dragTaskId, setDragTaskId] = useState('');
  const [dropLane, setDropLane] = useState('');
  const actions = useProjectViewActions(data.project, canManage);
  const tasksByColumn = useMemo(
    () => groupProjectTasksForFigmaBoard(data.tasks),
    [data.tasks],
  );

  return (
    <section className="eflow-figma-board pv-board" aria-label="Project task board">
      {onOpenTable && <header className="eflow-project-board-header">
        <h2>Task board</h2>
        <button type="button" className="eflow-project-view-return" onClick={onOpenTable}>
          <ArrowLeft size={16} /><Table2 size={16} />Back to main table
        </button>
      </header>}
      <p className="pv-help">Drag or use Start / Resume for permitted moves. Evidence submission and approval stay in task details and Reviews.</p>
      {actions.notice && <p className="pv-error pv-board-notice" role="alert">{actions.notice}</p>}
      <div className="eflow-figma-board__columns">
        {FIGMA_PROJECT_BOARD_COLUMNS.filter(column => !['changes_requested','cancelled'].includes(column.id) || (tasksByColumn.get(column.id)?.length || 0) > 0).map((column) => (
          <section className={'eflow-figma-board__column ' + (dropLane === column.id ? 'pv-board-drop' : '')} key={column.id} aria-label={column.label + ' lane'} onDragOver={e => { if (dragTaskId) { e.preventDefault(); setDropLane(column.id); } }} onDragLeave={() => setDropLane('')} onDrop={e => { e.preventDefault(); const id=e.dataTransfer.getData('application/eflow-project-task'); const task=data.tasks.find(t=>t.id===id); setDropLane('');setDragTaskId(''); if(task) void actions.run(()=>actions.move(task,column.id)); }}>
            <header className="eflow-figma-board__column-header" style={{background:column.tone,color:'white',borderColor:column.tone}}>
              <span className="eflow-figma-board__column-title">
                <i style={{ backgroundColor: column.tone }} />
                {column.label}
              </span>
              <span className="eflow-figma-board__count">{tasksByColumn.get(column.id)?.length || 0}</span>
            </header>
            <div className="eflow-figma-board__cards">
              {(tasksByColumn.get(column.id) || []).map((task) => (
                <div key={task.id} className="pv-board-card" draggable={actions.canMove(task)&&!actions.busy} aria-label={'Board card '+task.title} onDragStart={e=>{e.dataTransfer.setData('application/eflow-project-task',task.id);e.dataTransfer.effectAllowed='move';setDragTaskId(task.id);}} onDragEnd={()=>{setDragTaskId('');setDropLane('');}}>
                <TaskBoardCard
                  canManage={actions.canEditDates(task)}
                  data={data}
                  key={task.id}
                  onManageTeam={() => onOpenTask(task.id)}
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
                <span className="pv-help">{TASK_STATUS_LABELS[task.status]}</span>
                {actions.canMove(task)&&<button className="pv-board-move" disabled={actions.busy} onClick={()=>{void actions.run(()=>actions.move(task,'in_progress'));}}>{task.status==='changes_requested'?'Resume':'Start'} {task.title}</button>}
                </div>
              ))}
              {(tasksByColumn.get(column.id) || []).length === 0 && <p className="eflow-figma-board__empty">No tasks</p>}
            </div>
          {actions.dialog}
    </section>
        ))}
      </div>


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
      data-task-inspector-source={task.id}
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
            <AlertCircle size={11} /> Updates needed
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
