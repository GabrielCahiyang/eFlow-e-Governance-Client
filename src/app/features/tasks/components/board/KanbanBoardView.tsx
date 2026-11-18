import { WorkspaceTooltip } from "../../../../components/ui/workspace/WorkspaceTooltip";
import { TaskDepartmentLabel } from "../TaskDepartmentLabel";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Crown, Hand, ListChecks } from "lucide-react";
import type { Employee } from "../../../../services/employeeService";
import type { Task, TaskStatus } from "../../../../services/taskService";
import { STATUS_ORDER, getDeadlineInfo, getHierarchyDisplay, getInitials, getTaskMemberNames, priorityMeta, statusMeta } from "./model";
import type { MondayBoardProps } from "./model";
import { RejectionNotice, ReopenNotice, SubmissionDetails } from "./TaskFeedback";
import { TaskManagementMenu } from "./TaskManagementMenu";
import { useHorizontalBoardViewport } from "./useHorizontalBoardViewport";
import { isTaskLead } from "../../selectors/leadership";

export function KanbanBoardView({
  tasks,
  employees,
  role,
  onOpenReview,
  onExecute,
  onSubmitRequest,
  onOpenTaskEditor,
  onDeleteTaskRequest,
  onArchiveTaskRequest,
  onCancelTaskRequest,
  currentUserId,
  onUndoRequest,
  readOnly = false,
  onOpenTask,
}: {
  tasks: Task[];
  employees: Employee[];
  role: "head" | "member";
  onOpenReview?: MondayBoardProps["onOpenReview"];
  onExecute?: MondayBoardProps["onExecute"];
  onSubmitRequest?: (task: Task) => void;
  onOpenTaskEditor?: (task: Task) => void;
  onDeleteTaskRequest?: (task: Task) => void;
  onArchiveTaskRequest?: (task: Task) => void;
  onCancelTaskRequest?: (task: Task) => void;
  currentUserId?: string;
  currentUserName?: string;
  onUndoRequest?: (task: Task) => void;
  readOnly?: boolean;
  onOpenTask?: (task: Task) => void;
}) {
  const {
    viewportRef,
    isPanning,
    panByPage,
    viewportPointerHandlers,
  } = useHorizontalBoardViewport();
  const employeeById = useMemo(
    () =>
      Object.fromEntries(
        employees.map((employee) => [employee.id, employee]),
      ) as Record<string, Employee>,
    [employees],
  );

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    STATUS_ORDER.forEach((s) => map.set(s, []));
    tasks.forEach((t) => {
      const bucket = map.get(t.status);
      if (bucket) bucket.push(t);
    });
    return STATUS_ORDER.map((s) => ({ status: s, tasks: map.get(s)! }));
  }, [tasks]);

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-2.5 flex items-center justify-between gap-3 rounded-[8px] border border-border bg-card px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
          <Hand size={13} className="shrink-0 text-muted-foreground" />
          <span className="truncate">Scroll horizontally to see all statuses.</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <WorkspaceTooltip content="Scroll Kanban board left"><button type="button" aria-label="Scroll Kanban board left" onClick={() => panByPage(-1)} className="rounded-[6px] border border-border bg-card p-1 text-secondary-foreground transition hover:bg-muted hover:text-foreground"><ChevronLeft size={14} /></button></WorkspaceTooltip>
          <WorkspaceTooltip content="Scroll Kanban board right"><button type="button" aria-label="Scroll Kanban board right" onClick={() => panByPage(1)} className="rounded-[6px] border border-border bg-card p-1 text-secondary-foreground transition hover:bg-muted hover:text-foreground"><ChevronRight size={14} /></button></WorkspaceTooltip>
        </div>
      </div>
      <div
        ref={viewportRef}
        aria-label="Kanban status board"
        {...viewportPointerHandlers}
        className={`flex min-h-[400px] w-full min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-4 select-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      >
      {grouped.map(({ status, tasks: items }) => {
        const meta = statusMeta[status];
        return (
          <div
            key={status}
            className="flex-shrink-0 w-[252px] flex flex-col rounded-[10px] border border-border bg-muted/40"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/80 rounded-t-[10px] shrink-0">
              <div className={`w-2 h-2 rounded-[2px] ${meta.dot}`} />
              <span className="text-[11px] font-semibold text-foreground">
                {meta.label}
              </span>
              <div className="eflow-tabular ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-[6px] border border-border bg-muted text-[10px] font-semibold text-secondary-foreground">
                {items.length}
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2">
              {items.map((task) => {
                const dlInfo = getDeadlineInfo(task);
                const pm =
                  priorityMeta[task.priority || "medium"] ||
                  priorityMeta.medium;
                const hierarchy = getHierarchyDisplay(task);
                const memberNames = getTaskMemberNames(task, employeeById);
                const leadName = task.assigneeName || memberNames[0] || "";
                const canSubmit =
                  role === "member" &&
                  task.status === "in_progress" &&
                  currentUserId &&
                  isTaskLead(task, currentUserId);
                const taskOpener = onOpenTaskEditor || onOpenTask;
                return (
                  <div
                    key={task.id}
                    className="bg-card border border-border rounded-[8px] p-3 transition-colors hover:border-primary/40 group"
                  >
                    {/* Top priority bar */}
                    <div
                      className={`h-0.5 rounded-[2px] ${pm.kanbanBar} mb-2`}
                    />

                    {taskOpener ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          taskOpener(task);
                        }}
                        className="text-left text-[12.5px] font-medium text-foreground leading-snug hover:text-primary transition"
                      >
                        {task.title}
                      </button>
                    ) : (
                      <div className="text-[12.5px] font-medium text-foreground leading-snug">
                        {task.title}
                      </div>
                    )}
                    <TaskDepartmentLabel task={task} />
                        {task.description && (
                      <div className="text-[10.5px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {task.description}
                      </div>
                    )}
                    <div className="mt-1 text-[9.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {hierarchy.path}
                    </div>
                    {role === "head" && task.status === "for_review" && (
                      <SubmissionDetails submission={task.latestSubmission} />
                    )}
                    {task.rejectionNote && (
                      <RejectionNotice
                        note={task.rejectionNote}
                        rejectedAt={task.rejectedAt}
                      />
                    )}
                    {task.status !== "completed" &&
                      task.reopenReason && (
                        <ReopenNotice
                          reason={task.reopenReason}
                          reopenedAt={task.reopenedAt}
                          reopenedByName={task.reopenedByName}
                        />
                      )}

                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {leadName && (
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-neutral-800 text-[8px] text-white flex items-center justify-center font-semibold">
                            {getInitials(leadName)}
                          </div>
                          <Crown size={9} className="text-amber-500" />
                          <span className="text-[10px] text-secondary-foreground font-normal">
                            {leadName.split(" ")[0]}
                          </span>
                        </div>
                      )}
                      {memberNames.length > 1 && (
                        <span className="text-[9.5px] text-secondary-foreground">
                          Team: {memberNames.length}
                        </span>
                      )}
                      {dlInfo && task.status !== "completed" && (
                        <span
                          className={`text-[9.5px] px-1.5 py-0.5 rounded-[6px] border ${dlInfo.cls}`}
                        >
                          {dlInfo.label}
                        </span>
                      )}
                      <span
                        className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded-[6px] border border-current/15 ${pm.badge}`}
                      >
                        {pm.label}
                      </span>
                      {(task.subtaskCount ?? 0) > 0 && (
                        <span className="eflow-tabular inline-flex items-center gap-1 rounded-[6px] border border-border bg-muted px-1.5 py-0.5 text-[9.5px] font-medium text-secondary-foreground">
                          <ListChecks size={10} className={(task.subtaskCompletedCount ?? 0) === (task.subtaskCount ?? 0) ? "text-emerald-600" : "text-muted-foreground"} />
                          {task.subtaskCompletedCount ?? 0}/{task.subtaskCount ?? 0}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-2.5 flex gap-1">
                      {!readOnly && role === "head" && task.status === "for_review" && onOpenReview && (
                        <button type="button" onClick={() => onOpenReview(task.id)}
                          className="flex-1 rounded-md border py-1 text-xs font-medium">
                          Review submission
                        </button>
                      )}
                      {!readOnly && role === "member" && !!currentUserId && task.assigneeId === currentUserId && task.status === "todo" && (
                        <button
                          onClick={() => onExecute?.(task.id)}
                          className="flex-1 rounded-[6px] bg-primary py-1 text-[10.5px] font-medium text-primary-foreground transition hover:bg-primary/90"
                        >
                          Start Work
                        </button>
                      )}
                      {!readOnly && canSubmit && (
                        <button
                          onClick={() => onSubmitRequest?.(task)}
                          className="flex-1 rounded-[6px] bg-primary py-1 text-[10.5px] font-medium text-primary-foreground transition hover:bg-primary/90"
                        >
                          Submit for Review
                        </button>
                      )}
                      {!readOnly && role === "head" && (
                        <TaskManagementMenu
                          task={task}
                          onEdit={onOpenTaskEditor}
                          onArchive={onArchiveTaskRequest}
                          onCancel={onCancelTaskRequest}
                          onDelete={onDeleteTaskRequest}
                          onReopen={onUndoRequest}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div
                  className="text-[11px] text-muted-foreground text-center py-6 italic rounded-[8px] border border-dashed border-border bg-card/40"
                >
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ─── Timeline / Gantt View ────────────────────────────────────────
