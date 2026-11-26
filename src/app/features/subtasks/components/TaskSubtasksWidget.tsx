import { readableUiError } from '../../../shared/userFacingError';
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { BoundedTextInput } from "../../../components/ui/BoundedInput";
import { DateInput } from "../../../components/ui/DateInput";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
import { getPhilippineCalendarDate, scheduledDateError } from '../../../shared/calendarDates';
import { supportsNestedWork, isCurrentWorkSnapshot, WorkTree, type WorkNode, type WorkTreeSnapshot, type WorkTreeController } from '../../nested-work';
import type {TaskInspectorOrigin} from '../../task-inspector';
import {SubitemActionModal, type SubitemActionSection} from './SubitemActionModal';
import {SubitemInspector} from './SubitemInspector';

export function TaskSubtasksWidget(props: Parameters<typeof LegacyTaskSubtasksWidget>[0] & {onInspect?:(id:string,section:'work'|'review',origin:TaskInspectorOrigin)=>void;presentation?:'standard'|'project-table';fallback?:import('react').ReactNode;controller?:WorkTreeController;createRequest?:number;createFocusTarget?:HTMLElement;executionBlocked?:boolean;collapsedIds?:Set<string>;onCollapsedIdsChange?:(next:Set<string>)=>void}) {
 const [opened,setOpened]=useState<{id:string;section:'work'|'review';origin:TaskInspectorOrigin}>();
 const [sectionModal,setSectionModal]=useState<{id:string;section:SubitemActionSection}>();
 const {user}=useAuth();
 const readOnly=!!props.readOnly||!!props.parentTask?.archivedAt||!!props.parentTask?.proposedOfficeIdentityId;
 useEffect(()=>{setOpened(undefined);setSectionModal(undefined);},[user?.id,props.taskId]);
 if(!props.parentTask||!supportsNestedWork(props.parentTask))return <LegacyTaskSubtasksWidget {...props} readOnly={readOnly}/>;
 const supplied=props.controller,data=supplied?.data;
 if(supplied&&(supplied.actorId!==(user?.id||null)||supplied.rootId!==props.taskId||data&&(data.root.id!==props.taskId||data.root.project!==props.parentTask.linkedProjectId||data.root.kind==='office'&&data.root.office!==props.parentTask.orgId||!isCurrentWorkSnapshot(data,{actorId:user?.id||null,rootId:props.taskId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision}))))return <p role="alert">We couldn't confirm access to this task's work. Close this view and open the task again.</p>;
 const open=(node:WorkNode,_tree:WorkTreeSnapshot,section:'work'|'review')=>{
  const element=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const origin:TaskInspectorOrigin={view:'Work',section:'work',returnFocus:element,restoreFocus:()=>{
   const replacement=[...document.querySelectorAll<HTMLElement>('[data-work-open]')].find(button=>button.dataset.workOpen===node.id);
   (replacement||props.createFocusTarget)?.focus();
  }};
  if(props.onInspect)props.onInspect(node.id,section,origin);else setOpened({id:node.id,section,origin});
 };
 const isProjectTable = props.presentation === 'project-table';
 return <><div hidden={!!opened && !isProjectTable}><WorkTree presentation={props.presentation} rootId={props.taskId} parentTask={props.parentTask} parentTitle={props.parentTask.title} parentStartDate={props.parentTask.startDate} controller={props.controller} createRequest={props.createRequest} createFocusTarget={props.createFocusTarget} collapsedIds={props.collapsedIds} onCollapsedIdsChange={props.onCollapsedIdsChange} executionBlocked={props.executionBlocked} readOnly={readOnly} fallback={props.fallback||<LegacyTaskSubtasksWidget {...props} readOnly={readOnly}/>} onOpenOfficeNode={(node,tree)=>open(node,tree,'work')} onReviewOfficeNode={(node,tree)=>open(node,tree,'review')} onSubtaskSection={(section,node)=>setSectionModal({id:node.id,section})}/></div>
 {opened&&<SubitemInspector key={opened.id} presentation={isProjectTable?'dialog':undefined} rootTask={props.parentTask} itemId={opened.id} controller={props.controller} initialSection={opened.section} origin={opened.origin} executionBlocked={props.executionBlocked} readOnly={readOnly} onClose={()=>setOpened(undefined)}/>}
 {sectionModal&&<SubitemActionModal key={`${sectionModal.id}:${sectionModal.section}`} rootTask={props.parentTask} itemId={sectionModal.id} section={sectionModal.section} controller={props.controller} readOnly={readOnly} executionBlocked={props.executionBlocked} onClose={()=>setSectionModal(undefined)}/>}
 </>;
}
// ─── TaskSubtasksWidget ──────────────────────────────────────────
// Standalone subtask checklist with multi-user assignment, completion toggle, and realtime updates.
// Reused across TaskDetailDrawer and MondayBoard.

import { useState, useEffect, useMemo, useRef } from "react";
import { User, Plus, X, CheckSquare, Sparkles, Check, Eye, Clock3, LockKeyhole, Unlink2, CalendarClock } from "lucide-react";
import {
  type Subtask,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  reorderSubtasks,
} from "../../../services/subtaskService";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { startTaskIfTodo, type Task } from "../../../services/taskService";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SubtaskSequenceControls } from "./sequencing/SubtaskSequenceControls";
import { formatDate } from "../../../components/workflow/primitives";
import {
  getSequentialStepNumber,
  getSubtaskPrerequisite,
  moveSequenceItem,
  moveSequenceItemToTarget,
  resequenceItems,
} from "../selectors/sequencing";
import { getSubtaskDeadlineState, parentTaskDueDate } from "../selectors/deadlines";
import { useTaskSubtasks } from "../hooks/useTaskSubtasks";

function LegacyTaskSubtasksWidget({
  taskId,
  allowedAssignees,
  canManage = false,
  readOnly = false,
  parentTask,
  startParentOnCreate = false,
}: {
  taskId: string;
  allowedAssignees?: { id: string; name: string; initials?: string }[];
  canManage?: boolean;
  readOnly?:boolean;
  parentTask?: Task;
  startParentOnCreate?: boolean;
}) {
  canManage=canManage&&!readOnly;
  const { user, userProfile } = useAuth();
  const { subtasks, setSubtasks } = useTaskSubtasks(taskId,user?.id||null);
  const [newTitle, setNewTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [newStandalone, setNewStandalone] = useState(false);
  const [newDueDate, setNewDueDate] = useState(() => parentTaskDueDate(parentTask?.deadline, parentTask?.dueDate) || "");
  const [dueInvalidText, setDueInvalidText] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [openSubtask, setOpenSubtask] = useState<Subtask | null>(null);
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const pickerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { toast } = useToast();

  const parentDue = parentTaskDueDate(parentTask?.deadline, parentTask?.dueDate);
  useEffect(() => {
    if (!newDueDate && parentDue) setNewDueDate(parentDue);
  }, [newDueDate, parentDue]);

  useEffect(() => {
    if (!pickerOpenFor) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const picker = pickerRefs.current[pickerOpenFor];
      if (picker && !picker.contains(event.target as Node)) {
        setPickerOpenFor(null);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [pickerOpenFor]);

  // Subtasks can only be delegated to members already assigned to the task.
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; initials: string }>();
    (allowedAssignees || []).forEach((m) => {
      map.set(m.id, { id: m.id, name: m.name, initials: m.initials || m.name.slice(0, 2).toUpperCase() });
    });
    return Array.from(map.values());
  }, [allowedAssignees]);

  const titleError = textLengthError(newTitle, "Subtask title", { required: true, max: INPUT_LIMITS.TITLE });
  const visibleTitleError = titleTouched ? titleError : "";
  const dueError = dueInvalidText
    ? "Enter a valid due date in MM/DD/YYYY format."
    : !newDueDate
      ? "Choose a subtask due date."
      : scheduledDateError(newDueDate, { latest: parentDue || "", label: "Subtask due date" });
  const visibleDueError = dueInvalidText || Boolean(newDueDate) ? dueError : "";
  const addBlockers = [titleError, dueError].filter(Boolean);
  const addDisabled = adding || addBlockers.length > 0;

  const handleAdd = async () => {
    setTitleTouched(true);
    if (addDisabled) return;
    setAdding(true);
    try {
      await createSubtask(taskId, newTitle.trim(), {
        source: "manual",
        position: subtasks.length,
        createdBy: user?.id,
        actorName: userProfile?.full_name || "Team Lead",
        isStandalone: newStandalone,
        dueDate: newDueDate,
      });
      const parentStarted = startParentOnCreate && parentTask?.status === "todo"
        ? await startTaskIfTodo(taskId)
        : false;
      setNewTitle("");
      setTitleTouched(false);
      setNewStandalone(false);
      setNewDueDate(parentDue || "");
      setDueInvalidText(false);
      toast(
        parentStarted
          ? "Subtask added. The task is now In Progress."
          : "Subtask added.",
        "success",
      );
    } catch (error) {
      toast(readableUiError(error, "Failed to add subtask.", 'write'), "error");
    } finally {
      setAdding(false);
    }
  };

  const completedCount = subtasks.filter((s) => s.isCompleted).length;
  const sequenceLocked = Boolean(parentTask && (
    parentTask.archivedAt
    || ["for_review", "completed", "cancelled"].includes(parentTask.status)
  ));

  const commitOrder = async (nextOrder: Subtask[]) => {
    const previous = subtasks;
    const optimistic = resequenceItems(nextOrder);
    setSubtasks(optimistic);
    setReordering(true);
    try {
      await reorderSubtasks(optimistic.map((subtask) => subtask.id));
      toast("Subtask sequence updated.", "success");
    } catch (error) {
      setSubtasks(previous);
      toast(readableUiError(error, "Could not reorder subtasks.", 'write'), "error");
    } finally {
      setReordering(false);
      setDraggedSubtaskId(null);
    }
  };

  const moveSubtask = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= subtasks.length || sequenceLocked || reordering) return;
    void commitOrder(moveSequenceItem(subtasks, index, destination));
  };

  const dropSubtask = (targetId: string) => {
    if (!draggedSubtaskId || draggedSubtaskId === targetId || sequenceLocked || reordering) return;
    void commitOrder(moveSequenceItemToTarget(subtasks, draggedSubtaskId, targetId));
  };

  const toggleStandalone = async (subtask: Subtask) => {
    try {
      await updateSubtask(
        subtask.id,
        { isStandalone: !subtask.isStandalone },
        { id: user?.id || "", name: userProfile?.full_name || "Team Lead" },
      );
      toast(
        subtask.isStandalone
          ? `“${subtask.title}” now follows the ordered sequence.`
          : `“${subtask.title}” can now run independently.`,
        "success",
      );
    } catch (error) {
      toast(readableUiError(error, "Could not change the execution rule.", 'write'), "error");
    }
  };

  return (
    <div className="min-w-0 pt-2">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 font-semibold flex items-center gap-1.5">
          <CheckSquare size={12} className="text-neutral-500" />
          Subtasks {subtasks.length > 0 && `(${completedCount}/${subtasks.length})`}
        </label>
        {subtasks.length > 0 && (
          <div className="flex-1 mx-3 h-1.5 rounded-full bg-neutral-100 overflow-hidden max-w-[140px]">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {subtasks.map((st, index) => {
          const assignedIds = st.assignedToIds || (st.assignedTo ? [st.assignedTo] : []);
          const assignedUsers = assignedIds
            .map((id) => assigneeOptions.find((e) => e.id === id))
            .filter((u): u is { id: string; name: string; initials: string } => Boolean(u));

          const isMySubtask = Boolean(user?.id && assignedIds.includes(user.id));
          const canOpenDetails = canManage || isMySubtask;
          const prerequisite = getSubtaskPrerequisite(st, subtasks);
          const stepNumber = getSequentialStepNumber(st, subtasks);
          const executionModeLocked = st.status !== "todo" || st.percentComplete > 0;
          const deadlineState = getSubtaskDeadlineState(st);

          return (
            <div
              key={st.id}
              onDragOver={(event) => {
                if (canManage && !sequenceLocked && !reordering) event.preventDefault();
              }}
              onDrop={() => dropSubtask(st.id)}
              className={`group flex min-w-0 flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors sm:flex-nowrap ${
                draggedSubtaskId === st.id
                  ? "border-blue-400 bg-blue-50 shadow-sm"
                  : prerequisite
                  ? "border-neutral-200 bg-neutral-100/80"
                  : isMySubtask
                  ? "bg-blue-50/60 border-blue-200"
                  : "bg-neutral-50/60 border-neutral-100 hover:bg-neutral-100/60"
              }`}
            >
              {canManage ? (
                <SubtaskSequenceControls
                  index={index}
                  total={subtasks.length}
                  disabled={sequenceLocked || reordering}
                  onMove={(direction) => moveSubtask(index, direction)}
                  onDragStart={() => setDraggedSubtaskId(st.id)}
                  onDragEnd={() => setDraggedSubtaskId(null)}
                />
              ) : null}
              <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide ${
                st.isStandalone
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-neutral-200 bg-white text-neutral-500"
              }`}>
                {st.isStandalone ? "Independent" : `Step ${stepNumber}`}
              </span>
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                st.isCompleted
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : st.status === "for_review"
                    ? "border-amber-300 bg-amber-50 text-amber-600"
                    : "border-neutral-300 bg-white text-transparent"
              }`}>
                {st.status === "for_review" ? <Clock3 size={9} /> : <Check size={9} />}
              </span>
              <span
                className={`min-w-0 basis-full text-[12px] font-normal sm:basis-auto sm:flex-1 ${
                  st.isCompleted ? "text-neutral-400 line-through" : "text-neutral-800"
                }`}
              >
                {st.title}
              </span>

              {prerequisite && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[8.5px] font-medium text-neutral-600"
                  title={`Complete “${prerequisite.title}” first`}
                >
                  <LockKeyhole size={9} /> {st.dependencyIds ? `Waiting for ${prerequisite.title}` : `Waiting for Step ${getSequentialStepNumber(prerequisite, subtasks)}`}
                </span>
              )}

              {st.source === "ai_extracted" && (
                <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider text-violet-600 bg-violet-50 border border-violet-200 px-1 py-0.5 rounded font-semibold shrink-0">
                  <Sparkles size={8} /> AI
                </span>
              )}

              {canManage && (
                <ActionBlockerGroup
                  actionLabel={st.isStandalone ? "Follow work order" : "Allow out of order"}
                  blockers={executionModeLocked ? "Work order can’t change after work starts." : []}
                  compact
                  size="sm"
                >
                  <WorkspaceTooltip
                    content={
                      st.isStandalone
                        ? "Make this subtask follow the order of earlier steps."
                        : "Let this subtask start without waiting for earlier steps."
                    }
                    disabled={executionModeLocked}
                  >
                    <button
                      type="button"
                      onClick={() => void toggleStandalone(st)}
                      disabled={executionModeLocked}
                      aria-label={st.isStandalone ? `Follow work order for ${st.title}` : `Allow ${st.title} out of order`}
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        st.isStandalone
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-neutral-200 bg-white text-neutral-500 hover:border-violet-300 hover:text-violet-700"
                      }`}
                    >
                      <Unlink2 size={9} /> {st.isStandalone ? "Follow work order" : "Allow out of order"}
                    </button>
                  </WorkspaceTooltip>
                </ActionBlockerGroup>
              )}

              <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-medium ${
                st.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                st.status === "for_review" ? "bg-amber-50 text-amber-700" :
                st.status === "changes_requested" ? "bg-rose-50 text-rose-700" :
                st.status === "in_progress" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
              }`}>{st.status.replace("_", " ")}</span>

              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-medium ${
                deadlineState.tone === "overdue" ? "bg-red-50 text-red-700" :
                deadlineState.tone === "due_soon" ? "bg-amber-50 text-amber-700" :
                deadlineState.tone === "completed" ? "bg-emerald-50 text-emerald-700" :
                deadlineState.tone === "none" ? "bg-neutral-100 text-neutral-500" : "bg-emerald-50 text-emerald-700"
              }`} title={st.dueDate ? `Due ${formatDate(st.dueDate)}` : "No due date assigned"}>
                <CalendarClock size={9} /> {deadlineState.label}
              </span>

              {canOpenDetails && (
                <button
                  type="button"
                  onClick={() => setOpenSubtask(st)}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-[9.5px] text-neutral-600 hover:border-neutral-400"
                >
                  <Eye size={10} /> {canManage ? "Details" : "Open"}
                </button>
              )}

              {/* Assignee Avatars / Multi-Select Picker */}
              <div
                ref={(node) => {
                  pickerRefs.current[st.id] = node;
                }}
                className="relative shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setPickerOpenFor(pickerOpenFor === st.id ? null : st.id)}
                  disabled={!canManage}
                  className="flex items-center -space-x-1.5 hover:opacity-90 transition shrink-0"
                  title={
                    assignedUsers.length > 0
                      ? `Assigned to: ${assignedUsers.map((u) => u.name).join(", ")}`
                      : "Assign subtask to team members"
                  }
                >
                  {assignedUsers.length > 0 ? (
                    assignedUsers.map((u) => (
                      <div
                        key={u.id}
                        className="w-6 h-6 rounded-full bg-neutral-900 border border-white text-white text-[9px] flex items-center justify-center font-semibold shadow-sm"
                      >
                        {u.initials}
                      </div>
                    ))
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center hover:bg-neutral-200 hover:text-neutral-600 transition">
                      <User size={12} />
                    </div>
                  )}
                </button>

                {canManage && pickerOpenFor === st.id && (
                  <div className="absolute z-30 top-7 right-0 bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 w-52 max-h-60 overflow-y-auto">
                    <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">
                      Assign Team Members
                    </div>
                    {assignedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          updateSubtask(
                            st.id,
                            { assignedToIds: [] },
                            { id: user?.id || "", name: userProfile?.full_name || "Team Lead" },
                          );
                        }}
                        className="w-full text-left px-3 py-1 text-[11px] hover:bg-red-50 text-red-600 font-medium border-b border-neutral-100 mb-1 pb-1.5"
                      >
                        Clear All Assignees
                      </button>
                    )}
                    {assigneeOptions.map((e) => {
                      const selected = assignedIds.includes(e.id);
                      return (
                        <button
                          type="button"
                          key={e.id}
                          onClick={() => {
                            const nextIds = selected
                              ? assignedIds.filter((id) => id !== e.id)
                              : [...assignedIds, e.id];
                            updateSubtask(
                              st.id,
                              { assignedToIds: nextIds },
                              { id: user?.id || "", name: userProfile?.full_name || "Team Lead" },
                            );
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-neutral-50 flex items-center justify-between gap-2 ${
                            selected ? "bg-blue-50/50 font-medium text-blue-900" : "text-neutral-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-neutral-800 text-white text-[8px] flex items-center justify-center font-semibold shrink-0">
                              {e.initials}
                            </div>
                            <span className="font-normal truncate">{e.name}</span>
                          </div>
                          {selected && <Check size={12} className="text-blue-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {canManage && (
                <WorkspaceTooltip content="Delete subtask"><button aria-label="Delete subtask"
                  type="button"
                  onClick={() => deleteSubtask(st.id)}
                  className="shrink-0 p-0.5 text-neutral-500 opacity-100 transition hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"

                >
                  <X size={12} />
                </button></WorkspaceTooltip>
              )}
            </div>
          );
        })}
      </div>

      {canManage && sequenceLocked ? (
        <p className="mt-2 text-[9.5px] text-amber-700">Sequence is locked while the parent task is under review, completed, cancelled, or archived.</p>
      ) : null}

      {canManage && <div className="mt-2 space-y-1">
        <div className="flex min-w-0 flex-wrap items-start gap-2 sm:flex-nowrap">
          <div className="min-w-0 basis-full flex-1 sm:basis-0">
            <BoundedTextInput
              aria-label="New subtask title"
              maxLength={INPUT_LIMITS.TITLE}
              value={newTitle}
              error={visibleTitleError || undefined}
              onBlur={() => setTitleTouched(true)}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="Add a subtask for team members…"
              className="h-[32px] w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] font-normal text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
            />
          </div>
          <div className="w-[145px] shrink-0">
            <DateInput
              min={getPhilippineCalendarDate()}
              value={newDueDate}
              max={parentDue}
              hasError={Boolean(visibleDueError)}
              errorMessage={visibleDueError || undefined}
              onInvalidTextChange={setDueInvalidText}
              onChange={(event) => setNewDueDate(event.target.value)}
              className="h-[32px] w-full rounded-lg border border-neutral-200 bg-white px-2 text-[10.5px] text-neutral-700 outline-none focus:border-neutral-400"
              title={parentDue ? `Subtask deadline, no later than ${formatDate(parentDue)}` : "Subtask deadline"}
              aria-label="New subtask due date"
            />
          </div>
          <WorkspaceTooltip content="This subtask can start without waiting for earlier steps. Its start date and other requirements still apply.">
            <button
              type="button"
              onClick={() => setNewStandalone((current) => !current)}
              aria-pressed={newStandalone}
              className={`h-[32px] rounded-lg border px-2.5 text-[10px] font-medium transition shrink-0 ${
                newStandalone
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300"
              }`}
            >
              <span className="inline-flex items-center gap-1"><Unlink2 size={11} /> Allow out of order</span>
            </button>
          </WorkspaceTooltip>
          <ActionBlockerGroup
            actionLabel="Add subtask"
            blockers={addBlockers}
            busy={adding}
            size="sm"
            className="shrink-0"
          >
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={addDisabled}
              className="h-[32px] px-3 rounded-lg bg-neutral-900 text-white text-[11px] font-medium disabled:opacity-40 hover:bg-neutral-800 shrink-0 inline-flex items-center gap-1"
            >
              <Plus size={13} /> Add
            </button>
          </ActionBlockerGroup>
        </div>
        {visibleDueError && <p role="alert" className="eflow-field-error text-[10.5px]">{visibleDueError}</p>}
      </div>}
      {openSubtask && (
        parentTask ? (
          <SubitemInspector
            presentation="dialog"
            rootTask={parentTask}
            itemId={openSubtask.id}
            prerequisite={getSubtaskPrerequisite(openSubtask, subtasks)}
            readOnly={readOnly || canManage}
            canManageDeadline={canManage}
            onClose={() => setOpenSubtask(null)}
          />
        ) : (
          <Modal
            isOpen
            title={openSubtask.title || "Subtask unavailable"}
            description="Parent task context could not be verified."
            width="max-w-md"
            onClose={() => setOpenSubtask(null)}
            footer={
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setOpenSubtask(null)}>
                  Close
                </Button>
              </div>
            }
          >
            <FeedbackState tone="warning" title="Open from the parent task">
              Subtask details require the parent task context. Open this item from its parent task to view or update progress.
            </FeedbackState>
          </Modal>
        )
      )}
    </div>
  );
}
