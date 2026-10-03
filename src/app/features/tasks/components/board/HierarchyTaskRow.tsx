import { TaskDepartmentLabel } from "../TaskDepartmentLabel";
import type { Employee } from '../../../../services/employeeService';
import type { Task } from '../../../../services/taskService';
import { RejectionNotice, ReopenNotice, SubmissionDetails } from './TaskFeedback';
import { SubtaskProgressChip, getDeadlineInfo, getTaskMemberNames, priorityMeta, statusMeta, type MondayBoardProps } from './model';
import { TaskManagementMenu } from './TaskManagementMenu';
import { isTaskLead } from '../../selectors/leadership';

interface HierarchyTaskRowProps {
  task: Task;
  employeeById: Record<string, Employee>;
  role: 'head' | 'member';
  currentUserId?: string;
  onVerify?: MondayBoardProps['onVerify'];
  onExecute?: MondayBoardProps['onExecute'];
  onSubmitRequest?: (task: Task) => void;
  onOpenTaskEditor?: (task: Task) => void;
  onDeleteTaskRequest?: (task: Task) => void;
  onArchiveTaskRequest?: (task: Task) => void;
  onCancelTaskRequest?: (task: Task) => void;
  onUndoRequest?: (task: Task) => void;
}

export function HierarchyTaskRow({ task, employeeById, role, currentUserId, onVerify, onExecute, onSubmitRequest, onOpenTaskEditor, onDeleteTaskRequest, onArchiveTaskRequest, onCancelTaskRequest, onUndoRequest }: HierarchyTaskRowProps) {
  const pm =
                                    priorityMeta[task.priority || "medium"] ||
                                    priorityMeta.medium;
                                  const sm = statusMeta[task.status];
                                  const dlInfo = getDeadlineInfo(task);
                                  const memberNames = getTaskMemberNames(
                                    task,
                                    employeeById,
                                  );
                                  const leadName =
                                    task.assigneeName || memberNames[0] || "";
                                  const canSubmit =
                                    role === "member" &&
                                    task.status === "in_progress" &&
                                    currentUserId &&
                                    isTaskLead(task, currentUserId);
                                  return (
                                    <div key={task.id} className="px-3 py-2.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          {role === "head" &&
                                          onOpenTaskEditor ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenTaskEditor(task);
                                              }}
                                              className="break-words text-left text-[12px] font-medium leading-snug text-neutral-900 hover:text-violet-700 transition"
                                            >
                                              {task.title}
                                            </button>
                                          ) : (
                                            <div className="break-words text-[12px] font-medium leading-snug text-neutral-900">
                                              {task.title}
                                            </div>
                                          )}
                                          <TaskDepartmentLabel task={task} />
                        {task.description && (
                                            <div className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">
                                              {task.description}
                                            </div>
                                          )}
                                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                            <span
                                              className={`text-[9px] px-1.5 py-0.5 rounded-full ${pm.badge}`}
                                            >
                                              {pm.label}
                                            </span>
                                            <SubtaskProgressChip task={task} />
                                            <span
                                              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${sm.color}`}
                                            >
                                              <div
                                                className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}
                                              />
                                              {sm.label}
                                            </span>
                                            {leadName && (
                                              <span className="text-[9px] text-neutral-500">
                                                Lead: {leadName}
                                              </span>
                                            )}
                                            {memberNames.length > 1 && (
                                              <span className="text-[9px] text-violet-600">
                                                Team: {memberNames.length}
                                              </span>
                                            )}
                                            {dlInfo &&
                                              task.status !== "completed" && (
                                                <span
                                                  className={`text-[9px] px-1.5 py-0.5 rounded-full border ${dlInfo.cls}`}
                                                >
                                                  {dlInfo.label}
                                                </span>
                                              )}
                                          </div>
                                          {role === "head" &&
                                            task.status === "for_review" && (
                                              <SubmissionDetails
                                                submission={
                                                  task.latestSubmission
                                                }
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
                                                reopenedByName={
                                                  task.reopenedByName
                                                }
                                              />
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {role === "head" &&
                                            task.status === "for_review" && (
                                              <>
                                                <button
                                                  onClick={() =>
                                                    onVerify?.(task.id, true)
                                                  }
                                                  className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-md hover:bg-emerald-600 transition"
                                                >
                                                  Approve
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    const msg =
                                                      prompt("Reason:");
                                                    onVerify?.(
                                                      task.id,
                                                      false,
                                                      msg || "Needs rework",
                                                    );
                                                  }}
                                                  className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-md hover:bg-red-600 transition"
                                                >
                                                  Reject
                                                </button>
                                              </>
                                            )}
                                          {role === "member" &&
                                            task.status === "todo" && (
                                              <button
                                                onClick={() =>
                                                  onExecute?.(task.id)
                                                }
                                                className="rounded-md bg-primary px-2 py-0.5 text-[10px] text-primary-foreground transition hover:bg-primary/90"
                                              >
                                                Start
                                              </button>
                                            )}
                                          {canSubmit && (
                                            <button
                                              onClick={() =>
                                                onSubmitRequest?.(task)
                                              }
                                              className="rounded-md bg-primary px-2 py-0.5 text-[10px] text-primary-foreground transition hover:bg-primary/90"
                                            >
                                              Submit
                                            </button>
                                          )}
                                          {role === "head" && (
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
                                    </div>
                                  );
}
