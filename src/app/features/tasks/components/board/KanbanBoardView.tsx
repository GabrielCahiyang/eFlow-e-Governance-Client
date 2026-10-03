import { TaskDepartmentLabel } from "../TaskDepartmentLabel";
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Hand } from "lucide-react";
import type { Employee } from "../../../../services/employeeService";
import type { Task, TaskStatus } from "../../../../services/taskService";
import { updateTaskStatus } from "../../../../services/taskService";
import { STATUS_ORDER, SubtaskProgressChip, canDragTask, getDeadlineInfo, getDirectBoardTransitionError, getHierarchyDisplay, getInitials, getTaskMemberNames, priorityMeta, statusMeta } from "./model";
import type { MondayBoardProps } from "./model";
import { RejectionNotice, ReopenNotice, SubmissionDetails } from "./TaskFeedback";
import { TaskManagementMenu } from "./TaskManagementMenu";
import { useHorizontalBoardViewport } from "./useHorizontalBoardViewport";
import { isTaskLead } from "../../selectors/leadership";

export function KanbanBoardView({
  tasks,
  employees,
  role,
  onVerify,
  onExecute,
  onSubmitRequest,
  onOpenTaskEditor,
  onDeleteTaskRequest,
  onArchiveTaskRequest,
  onCancelTaskRequest,
  currentUserId,
  currentUserName,
  onUndoRequest,
  readOnly = false,
  onOpenTask,
}: {
  tasks: Task[];
  employees: Employee[];
  role: "head" | "member";
  onVerify?: MondayBoardProps["onVerify"];
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
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const {
    viewportRef,
    isPanning,
    panByPage,
    autoPanDuringTaskDrag,
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

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    if (readOnly) return;
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus || task.status === "completed")
      return;
    const transitionError = getDirectBoardTransitionError(
      task,
      newStatus,
      role,
      currentUserId,
    );
    if (transitionError) {
      alert(transitionError);
      return;
    }
    const actor = currentUserId
      ? { id: currentUserId, name: currentUserName }
      : undefined;
    try {
      await updateTaskStatus(taskId, newStatus, actor);
    } catch (err) {
      alert(err instanceof Error ? err.message : "That status change isn't allowed.");
    }
  };

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-[10.5px] text-neutral-500">
          <Hand size={13} className="shrink-0 text-neutral-400" />
          <span className="truncate">Drag the board left or right. Task cards still drag between status columns.</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Scroll Kanban board left" onClick={() => panByPage(-1)} className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"><ChevronLeft size={14} /></button>
          <button type="button" aria-label="Scroll Kanban board right" onClick={() => panByPage(1)} className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div
        ref={viewportRef}
        aria-label="Kanban status board"
        {...viewportPointerHandlers}
        onDragOver={(event) => autoPanDuringTaskDrag(event.clientX)}
        className={`flex min-h-[400px] w-full min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-4 select-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      >
      {grouped.map(({ status, tasks: items }) => {
        const meta = statusMeta[status];
        const isDragOver = dragOverStatus === status;
        return (
          <div
            key={status}
            className={`flex-shrink-0 w-[248px] flex flex-col rounded-2xl border transition-all ${
              isDragOver
                ? "border-blue-300 bg-blue-50/30 shadow-md"
                : "border-neutral-200 bg-neutral-50/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatus(status);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => handleDrop(e, status as TaskStatus)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-neutral-200 shrink-0">
              <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
              <span className="text-[11px] font-semibold text-neutral-700">
                {meta.label}
              </span>
              <div className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600">
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
                const isDraggable = !readOnly && canDragTask(
                  task,
                  role,
                  currentUserId,
                );
                const taskOpener = onOpenTaskEditor || onOpenTask;
                return (
                  <div
                    key={task.id}
                    draggable={isDraggable}
                    onDragStart={(e) => {
                      if (!isDraggable) return;
                      e.dataTransfer.setData("text/plain", task.id);
                      (e.currentTarget as HTMLElement).style.opacity = "0.5";
                    }}
                    onDragEnd={(e) =>
                      ((e.currentTarget as HTMLElement).style.opacity = "1")
                    }
                    className={`bg-white border border-neutral-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group ${isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                  >
                    {/* Top priority bar */}
                    <div
                      className={`h-0.5 rounded-full ${pm.kanbanBar} mb-2.5`}
                    />

                    {taskOpener ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          taskOpener(task);
                        }}
                        className="text-left text-[12px] font-medium text-neutral-900 leading-snug hover:text-violet-700 transition"
                      >
                        {task.title}
                      </button>
                    ) : (
                      <div className="text-[12px] font-medium text-neutral-900 leading-snug">
                        {task.title}
                      </div>
                    )}
                    <TaskDepartmentLabel task={task} />
                        {task.description && (
                      <div className="text-[10px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                        {task.description}
                      </div>
                    )}
                    <div className="mt-1 text-[9px] text-violet-600/80 line-clamp-2 leading-relaxed">
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
                          <span className="text-[10px] text-neutral-600 font-normal">
                            {leadName.split(" ")[0]}
                          </span>
                        </div>
                      )}
                      {memberNames.length > 1 && (
                        <span className="text-[9px] text-violet-600">
                          Team: {memberNames.length}
                        </span>
                      )}
                      {dlInfo && task.status !== "completed" && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border ${dlInfo.cls}`}
                        >
                          {dlInfo.label}
                        </span>
                      )}
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full ${pm.badge}`}
                      >
                        {pm.label}
                      </span>
                      <SubtaskProgressChip task={task} />
                    </div>

                    {/* Actions */}
                    <div className="mt-2.5 flex gap-1">
                      {!readOnly && role === "head" && task.status === "for_review" && (
                        <>
                          <button
                            onClick={() => onVerify?.(task.id, true)}
                            className="flex-1 text-[10px] bg-emerald-500 text-white py-1 rounded-lg hover:bg-emerald-600 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const msg = prompt("Reason:");
                              onVerify?.(task.id, false, msg || "Needs rework");
                            }}
                            className="flex-1 text-[10px] bg-red-500 text-white py-1 rounded-lg hover:bg-red-600 transition"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {!readOnly && role === "member" && task.status === "todo" && (
                        <button
                          onClick={() => onExecute?.(task.id)}
                          className="flex-1 rounded-lg bg-primary py-1 text-[10px] text-primary-foreground transition hover:bg-primary/90"
                        >
                          Start Work
                        </button>
                      )}
                      {!readOnly && canSubmit && (
                        <button
                          onClick={() => onSubmitRequest?.(task)}
                          className="flex-1 rounded-lg bg-primary py-1 text-[10px] text-primary-foreground transition hover:bg-primary/90"
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
                  className={`text-[11px] text-neutral-400 text-center py-8 italic rounded-xl border-2 border-dashed transition ${isDragOver ? "border-blue-300 bg-blue-50/40 text-blue-500" : "border-neutral-200"}`}
                >
                  {isDragOver ? "Drop here" : "No tasks"}
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
