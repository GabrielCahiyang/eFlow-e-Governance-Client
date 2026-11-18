import { Search as VibeSearch } from "@vibe/core";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Employee } from "../../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../../services/employeeNotesService";
import type { Task, TaskStatus, UpdateTaskPayload } from "../../../../services/taskService";
import { getTaskMemberIds, statusMeta, uniqueValues } from "./model";
import type { MondayBoardProps } from "./model";
import { AssignmentModal } from "./AssignmentModal";
import { useListBoardController } from "./useListBoardController";
import { ListTaskRow } from "./ListTaskRow";
import { motionTransition } from "../../../../shared/motion";
import './taskList.css';

export function ListBoardView({
  tasks,
  role,
  employees,
  employeeNotes,
  onAssign,
  onUpdateTask,
  onOpenReview,
  onExecute,
  onSubmitRequest,
  onOpenTaskEditor,
  onDeleteTaskRequest,
  onArchiveTaskRequest,
  onCancelTaskRequest,
  departmentFilter,
  currentUserId,
  currentUserName,
  onUndoRequest,
}: {
  tasks: Task[];
  role: "head" | "member";
  employees: Employee[];
  employeeNotes?: EmployeeNotesMap;
  onAssign?: MondayBoardProps["onAssign"];
  onUpdateTask?: MondayBoardProps["onUpdateTask"];
  onOpenReview?: MondayBoardProps["onOpenReview"];
  onExecute?: MondayBoardProps["onExecute"];
  onSubmitRequest?: (task: Task) => void;
  onOpenTaskEditor?: (task: Task) => void;
  onDeleteTaskRequest?: (task: Task) => void;
  onArchiveTaskRequest?: (task: Task) => void;
  onCancelTaskRequest?: (task: Task) => void;
  departmentFilter?: string;
  currentUserId?: string;
  currentUserName?: string;
  onUndoRequest?: (task: Task) => void;
}) {
  const {
    collapsedGroups, setCollapsedGroups, searchQuery, setSearchQuery,
    dragOverStatus, setDragOverStatus, listAssignModal, setListAssignModal,
    employeeById, filteredTasks, grouped, handleDrop,
  } = useListBoardController({ tasks, employees, role, currentUserId, currentUserName });

  return (
    <div className="eflow-task-list w-full min-w-0 flex flex-col">
      {/* Search bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <VibeSearch
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery("")}
          placeholder="Search tasks, teams, tags…"
          inputAriaLabel="Search tasks"
          showClearIcon
          size="small"
          className="w-full max-w-[380px]"
        />
        <div className="eflow-tabular text-[12px] font-medium text-muted-foreground">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        {/* Header row */}
        <div className="eflow-task-table-header sticky top-0 z-10 border-b border-border bg-muted/40 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <div data-column="marker" />
          <div data-column="task" className="pl-3">Task</div>
          <div data-column="team">Team / Lead</div>
          <div data-column="priority" className="text-center">Priority</div>
          <div data-column="due">Due Date</div>
          <div data-column="status" className="text-center">Status</div>
          <div data-column="actions" className="text-center">Actions</div>
        </div>

        {grouped.map(({ status, tasks: items }) => {
          const meta = statusMeta[status];
          const collapsed = collapsedGroups.has(status);
          return (
            <div
              key={status}
              className={`transition-colors ${dragOverStatus === status ? "bg-accent/40" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => handleDrop(e, status as TaskStatus)}
            >
              {/* Group header */}
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-controls={`task-group-${status}`}
                onClick={() =>
                  setCollapsedGroups((prev) => {
                    const next = new Set(prev);
                    next.has(status) ? next.delete(status) : next.add(status);
                    return next;
                  })
                }
                className="w-full flex items-center gap-2 px-3.5 py-2 bg-muted/40 border-y border-border hover:bg-muted/70 transition text-left"
              >
                {collapsed ? (
                  <ChevronRight size={12} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={12} className="text-muted-foreground" />
                )}
                <div className={`w-2 h-2 rounded-[2px] ${meta.dot}`} />
                <span className="text-[11px] font-semibold text-foreground">
                  {meta.label}
                </span>
                <span className="eflow-tabular text-[11px] text-muted-foreground">
                  ({items.length})
                </span>
                {dragOverStatus === status && (
                  <span className="ml-auto rounded-[6px] border border-primary/30 bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    Drop here
                  </span>
                )}
              </button>

              <AnimatePresence initial={false}>
              {!collapsed && (
                <m.div
                  id={`task-group-${status}`}
                  key={`task-group-${status}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={motionTransition.productive}
                >
                {items.map((task) => (
                  <ListTaskRow
                    key={task.id}
                    task={task}
                    role={role}
                    employeeById={employeeById}
                    currentUserId={currentUserId}
                    onEditTeam={(selectedTask) => setListAssignModal({ open: true, task: selectedTask })}
                    onOpenTaskEditor={onOpenTaskEditor}
                    onDeleteTaskRequest={onDeleteTaskRequest}
                    onArchiveTaskRequest={onArchiveTaskRequest}
                    onCancelTaskRequest={onCancelTaskRequest}
                    onSubmitRequest={onSubmitRequest}
                    onUndoRequest={onUndoRequest}
                    onOpenReview={onOpenReview}
                    onExecute={onExecute}
                  />
                ))}

              {items.length === 0 && (
                <div className="px-4 py-4 text-[12px] text-neutral-300 italic text-center">
                  Drop tasks here or no tasks in this status.
                </div>
              )}
                </m.div>
              )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* List view assign modal */}
      {listAssignModal.open && listAssignModal.task && (
        <AssignmentModal
          open={listAssignModal.open}
          onClose={() => setListAssignModal({ open: false, task: null })}
          employees={employees}
          employeeNotes={employeeNotes}
          selectedIds={getTaskMemberIds(listAssignModal.task)}
          leadId={
            listAssignModal.task.assigneeId ||
            getTaskMemberIds(listAssignModal.task)[0] ||
            null
          }
          onConfirm={async (memberIds, leadId) => {
            if (!listAssignModal.task) return;
            const normalizedMemberIds = uniqueValues(memberIds);
            const resolvedLeadId =
              (leadId && normalizedMemberIds.includes(leadId) && leadId) ||
              normalizedMemberIds[0] ||
              "";
            const lead = employees.find(
              (employee) => employee.id === resolvedLeadId,
            );
            const teamMemberNames = normalizedMemberIds
              .map(
                (id) =>
                  employees.find((employee) => employee.id === id)?.name || "",
              )
              .filter(Boolean);

            if (onUpdateTask) {
              const payload: UpdateTaskPayload = {
                teamMemberIds: normalizedMemberIds,
                teamMemberNames,
                assigneeId: resolvedLeadId,
                assigneeName: lead?.name || "",
                recommendedEmployeeIds: normalizedMemberIds,
                teamId: normalizedMemberIds.length
                  ? lead?.department ||
                    listAssignModal.task.teamId ||
                    departmentFilter ||
                    ""
                  : "",
                teamName: normalizedMemberIds.length
                  ? lead?.departmentName ||
                    lead?.department ||
                    listAssignModal.task.teamName ||
                    departmentFilter ||
                    ""
                  : "",
              };
              if (
                listAssignModal.task.status === "pending_assignment" &&
                normalizedMemberIds.length > 0
              ) {
                payload.status = "todo";
              }
              await onUpdateTask(listAssignModal.task.id, payload);
              return;
            }

            if (onAssign && lead && listAssignModal.task) {
              onAssign(listAssignModal.task.id, lead.id, lead.name, {
                teamMemberIds: normalizedMemberIds,
                teamMemberNames,
              });
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Kanban Board View ────────────────────────────────────────────
