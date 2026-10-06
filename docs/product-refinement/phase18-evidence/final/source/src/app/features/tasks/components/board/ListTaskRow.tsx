import { TaskDepartmentLabel } from "../TaskDepartmentLabel";
import { Avatar } from '@vibe/core';
import { Clock, Crown } from 'lucide-react';
import type { Employee } from '../../../../services/employeeService';
import type { Task } from '../../../../services/taskService';
import { RejectionNotice, ReopenNotice, SubmissionDetails } from './TaskFeedback';
import { SubtaskProgressChip, canDragTask, getDeadlineInfo, getHierarchyDisplay, getTaskMemberNames, priorityMeta, type MondayBoardProps } from './model';
import { TaskManagementMenu } from './TaskManagementMenu';
import { TaskStatusLabel } from '../../presentation/TaskStatusLabel';
import { isTaskLead } from '../../selectors/leadership';

interface ListTaskRowProps {
  task: Task;
  role: 'head' | 'member';
  employeeById: Record<string, Employee>;
  currentUserId?: string;
  onEditTeam: (task: Task) => void;
  onOpenTaskEditor?: (task: Task) => void;
  onDeleteTaskRequest?: (task: Task) => void;
  onArchiveTaskRequest?: (task: Task) => void;
  onCancelTaskRequest?: (task: Task) => void;
  onSubmitRequest?: (task: Task) => void;
  onUndoRequest?: (task: Task) => void;
  onVerify?: MondayBoardProps['onVerify'];
  onExecute?: MondayBoardProps['onExecute'];
}

export function ListTaskRow({ task, role, employeeById, currentUserId, onEditTeam, onOpenTaskEditor, onDeleteTaskRequest, onArchiveTaskRequest, onCancelTaskRequest, onSubmitRequest, onUndoRequest, onVerify, onExecute }: ListTaskRowProps) {
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
                  const hasActions =
                    role === "head" ||
                    (role === "member" &&
                      (task.status === "todo" || Boolean(canSubmit)));
                  const isDraggable = canDragTask(
                    task,
                    role,
                    currentUserId,
                  );
                  return (
                    <div
                      key={task.id}
                      draggable={isDraggable}
                      onDragStart={(e) => {
                        if (!isDraggable) return;
                        e.dataTransfer.setData("text/plain", task.id);
                        (e.currentTarget as HTMLElement).style.opacity = "0.5";
                      }}
                      onDragEnd={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = "1";
                      }}
                      className={`eflow-task-row grid grid-cols-[20px_1fr_180px_90px_150px_120px_132px] gap-0 px-4 py-3 border-b border-neutral-100 last:border-0 items-center hover:bg-neutral-50/70 transition group ${isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                    >
                      {/* Priority bar */}
                      <div
                        className={`w-1 h-8 rounded-full ${pm.bar}`}
                        style={{ marginLeft: "2px" }}
                      />

                      {/* Task info */}
                      <div className="pl-3 pr-4 min-w-0">
                        {role === "head" && onOpenTaskEditor ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTaskEditor(task);
                            }}
                            className="break-words text-left text-[13px] font-medium leading-snug text-neutral-900 hover:text-violet-700 transition"
                          >
                            {task.title}
                          </button>
                        ) : (
                          <div className="break-words text-[13px] font-medium leading-snug text-neutral-900">
                            {task.title}
                          </div>
                        )}
                        <TaskDepartmentLabel task={task} />
                        {task.description && (
                          <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                            {task.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                          {task.tags && task.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="bg-neutral-100 text-neutral-500 text-[10px] px-1.5 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          <SubtaskProgressChip task={task} />
                        </div>
                        <div className="mt-1 break-words text-[10px] leading-relaxed text-violet-700">
                          {hierarchy.path}
                        </div>
                        {role === "head" &&
                          task.status === "for_review" && (
                            <SubmissionDetails
                              submission={task.latestSubmission}
                            />
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
                        {task.status === "completed" && task.auditHash && (
                          <div
                            className="mt-1 text-[9px] text-neutral-400"
                            title={task.auditHash}
                          >
                            🔒 Audit: {task.auditHash.substring(0, 8)}…
                          </div>
                        )}
                      </div>

                      {/* Team */}
                      <div className="eflow-task-row__team pr-4 min-w-0">
                        {leadName || task.teamName ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Avatar text={leadName || task.teamName || "Unassigned"} size="small" />
                              {leadName && (
                                <Crown size={10} className="text-amber-500" />
                              )}
                              <span className="text-[11px] font-medium text-neutral-800 truncate">
                                {leadName || "Unassigned"}
                              </span>
                            </div>
                            {task.teamName && (
                              <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                                {task.teamName}
                              </div>
                            )}
                            {task.recommendationSource === "llm" && (
                              <span className="text-[8px] uppercase tracking-wider text-violet-500">AI Reasoned</span>
                            )}
                            {task.recommendationSource === "fallback" && (
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400">Auto-Matched</span>
                            )}
                            {memberNames.length > 1 && (
                              <div className="text-[10px] text-violet-600 mt-0.5 truncate">
                                Team: {memberNames.slice(0, 3).join(", ")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-[11px] text-neutral-400 italic">
                              Unassigned
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Priority */}
                      <div className="eflow-task-row__priority flex justify-center">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pm.badge}`}
                        >
                          {pm.label}
                        </span>
                      </div>

                      {/* Due date */}
                      <div className="eflow-task-row__due">
                        <div className="text-[12px] font-normal text-neutral-700">
                          {task.deadline || task.dueDate || "—"}
                        </div>
                        {dlInfo && task.status !== "completed" && (
                          <div
                            className={`inline-flex items-center gap-1 text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full border ${dlInfo.cls}`}
                          >
                            <Clock size={9} />
                            {dlInfo.label}
                          </div>
                        )}
                      </div>

                      {/* Status stays informational; workflow controls are in Actions. */}
                      <div className="eflow-task-row__status flex items-center justify-center">
                        <TaskStatusLabel status={task.status} />
                      </div>

                      {/* One contextual menu keeps row actions quiet and consistent. */}
                      <div className="eflow-task-row__actions flex items-center justify-center">
                        {hasActions ? (
                          <TaskManagementMenu
                            task={task}
                            onApprove={role === "head" && task.status === "for_review" ? () => onVerify?.(task.id, true) : undefined}
                            onReject={role === "head" && task.status === "for_review" ? () => {
                              const msg = prompt("Reason for rejection:");
                              onVerify?.(task.id, false, msg || "Needs rework");
                            } : undefined}
                            onStart={role === "member" && task.status === "todo" ? () => onExecute?.(task.id) : undefined}
                            onSubmit={canSubmit ? () => onSubmitRequest?.(task) : undefined}
                            onEdit={role === "head" ? onOpenTaskEditor : undefined}
                            onEditTeam={role === "head" ? onEditTeam : undefined}
                            onArchive={role === "head" ? onArchiveTaskRequest : undefined}
                            onCancel={role === "head" ? onCancelTaskRequest : undefined}
                            onDelete={role === "head" ? onDeleteTaskRequest : undefined}
                            onReopen={role === "head" ? onUndoRequest : undefined}
                            menuPlacement={
                              task.status === "completed" || task.status === "cancelled"
                                ? "top"
                                : "bottom"
                            }
                          />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </div>
                    </div>
                  );
}
