import { supportsNestedWork, WorkTree, type WorkNode, type WorkTreeSnapshot } from '../../nested-work';
import { fetchSubtask } from '../services/subtaskWorkflowService';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { requestNavigation } from '../../../shared/navigationGuard';
import { SubtaskReviewInbox } from '../../reviews';

export function TaskSubtasksWidget(props: Parameters<typeof LegacyTaskSubtasksWidget>[0] & {fallback?:import('react').ReactNode}) {
 const [opened,setOpened]=useState<{item:Subtask;node:WorkNode;prerequisite:Subtask|null}>(),[review,setReview]=useState<WorkNode>(),[error,setError]=useState('');
 const {user}=useAuth();
 const scope=useRef(`${user?.id}:${props.taskId}`);scope.current=`${user?.id}:${props.taskId}`;
 useEffect(()=>{setOpened(undefined);setReview(undefined);setError('');},[user?.id,props.taskId]);
 if(!props.parentTask||!supportsNestedWork(props.parentTask))return <LegacyTaskSubtasksWidget {...props}/>;
 async function open(node:WorkNode,tree:WorkTreeSnapshot){const key=scope.current;try{
  const rows=tree.nodes.map(n=>({id:n.id,taskId:props.taskId,parentSubtaskId:n.parent_subtask_id||undefined,siblingOrder:n.sibling_order,position:n.sibling_order,title:n.title,isCompleted:n.status==='completed',isStandalone:n.is_standalone}));
  const current=rows.find(n=>n.id===node.id)!;const prior=getSubtaskPrerequisite(current,rows);
  const [item,prerequisite]=await Promise.all([fetchSubtask(node.id),prior?fetchSubtask(prior.id):Promise.resolve(null)]);
  if(scope.current===key&&item)setOpened({item,node,prerequisite});
 }catch(reason){if(scope.current===key)setError((reason as Error).message);}}
 return <><WorkTree rootId={props.taskId} fallback={props.fallback||<LegacyTaskSubtasksWidget {...props}/>} onOpenOfficeNode={(node,tree)=>void open(node,tree)} onReviewOfficeNode={setReview}/>
 {error&&<p role="alert">{error}</p>}
 {opened&&<SubtaskWorkDrawer subtask={opened.item} currentReviewerId={opened.node.current_reviewer||undefined} prerequisite={opened.prerequisite} parentTask={props.parentTask} readOnly={!opened.node.can_work} canManageDeadline={false} onClose={()=>setOpened(undefined)}/>}
 {review&&<FeatureDialog title="Subitem evidence review" onClose={()=>void requestNavigation(()=>setReview(undefined))}><SubtaskReviewInbox embedded onShowTasks={()=>setReview(undefined)} focus={{notificationId:`r7:${review.id}`,kind:'subtask_review',taskId:props.taskId,entityId:review.id}}/></FeatureDialog>}
 </>;
}
// ─── TaskSubtasksWidget ──────────────────────────────────────────
// Standalone subtask checklist with multi-user assignment, completion toggle, and realtime updates.
// Reused across TaskDetailDrawer, YouAreLeadingView, and MondayBoard.

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
import { SubtaskWorkDrawer } from "./SubtaskWorkDrawer";
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
  parentTask,
  startParentOnCreate = false,
}: {
  taskId: string;
  allowedAssignees?: { id: string; name: string; initials?: string }[];
  canManage?: boolean;
  parentTask?: Task;
  startParentOnCreate?: boolean;
}) {
  const { subtasks, setSubtasks } = useTaskSubtasks(taskId);
  const [newTitle, setNewTitle] = useState("");
  const [newStandalone, setNewStandalone] = useState(false);
  const [newDueDate, setNewDueDate] = useState(() => parentTaskDueDate(parentTask?.deadline, parentTask?.dueDate) || "");
  const [adding, setAdding] = useState(false);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [openSubtask, setOpenSubtask] = useState<Subtask | null>(null);
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const pickerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { user, userProfile } = useAuth();
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

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDueDate) return;
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
      setNewStandalone(false);
      setNewDueDate(parentDue || "");
      toast(
        parentStarted
          ? "Subtask added. The task is now In Progress."
          : "Subtask added.",
        "success",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to add subtask.", "error");
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
      toast(error instanceof Error ? error.message : "Could not reorder subtasks.", "error");
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
      toast(error instanceof Error ? error.message : "Could not change the execution rule.", "error");
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
                {st.isStandalone ? "Standalone" : `Step ${stepNumber}`}
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
                  <LockKeyhole size={9} /> Waiting for Step {getSequentialStepNumber(prerequisite, subtasks)}
                </span>
              )}

              {st.source === "ai_extracted" && (
                <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider text-violet-600 bg-violet-50 border border-violet-200 px-1 py-0.5 rounded font-semibold shrink-0">
                  <Sparkles size={8} /> AI
                </span>
              )}

              {canManage && (
                <button
                  type="button"
                  onClick={() => void toggleStandalone(st)}
                  disabled={executionModeLocked}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    st.isStandalone
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-neutral-200 bg-white text-neutral-500 hover:border-violet-300 hover:text-violet-700"
                  }`}
                  title={executionModeLocked
                    ? "Execution mode is locked after work starts"
                    : st.isStandalone
                      ? "Make this an ordered prerequisite step"
                      : "Allow this subtask to run without earlier prerequisites"}
                >
                  <Unlink2 size={9} /> {st.isStandalone ? "Independent" : "Make standalone"}
                </button>
              )}

              <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-medium ${
                st.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                st.status === "for_review" ? "bg-amber-50 text-amber-700" :
                st.status === "changes_requested" ? "bg-rose-50 text-rose-700" :
                st.status === "in_progress" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-500"
              }`}>{st.status.replace("_", " ")}</span>

              <span className="text-[9.5px] font-medium tabular-nums text-neutral-500">
                {st.percentComplete}%
              </span>

              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-medium ${
                deadlineState.tone === "overdue" ? "bg-red-50 text-red-700" :
                deadlineState.tone === "due_soon" ? "bg-amber-50 text-amber-700" :
                deadlineState.tone === "completed" ? "bg-emerald-50 text-emerald-700" :
                deadlineState.tone === "none" ? "bg-neutral-100 text-neutral-500" : "bg-blue-50 text-blue-700"
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
                <button
                  type="button"
                  onClick={() => deleteSubtask(st.id)}
                  className="shrink-0 p-0.5 text-neutral-500 opacity-100 transition hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                  title="Delete subtask"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canManage && sequenceLocked ? (
        <p className="mt-2 text-[9.5px] text-amber-700">Sequence is locked while the parent task is under review, completed, cancelled, or archived.</p>
      ) : null}

      {canManage && <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a subtask for team members…"
          className="h-[32px] min-w-0 basis-full flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] font-normal text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400 sm:basis-0"
        />
        <input
          type="date"
          value={newDueDate}
          max={parentDue}
          onChange={(event) => setNewDueDate(event.target.value)}
          className="h-[32px] w-[145px] rounded-lg border border-neutral-200 bg-white px-2 text-[10.5px] text-neutral-700 outline-none focus:border-neutral-400"
          title={parentDue ? `Subtask deadline, no later than ${formatDate(parentDue)}` : "Subtask deadline"}
          aria-label="New subtask due date"
        />
        <button
          type="button"
          onClick={() => setNewStandalone((current) => !current)}
          aria-pressed={newStandalone}
          className={`h-[32px] rounded-lg border px-2.5 text-[10px] font-medium transition ${
            newStandalone
              ? "border-violet-300 bg-violet-50 text-violet-700"
              : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300"
          }`}
          title="Standalone subtasks can start immediately and do not block the ordered sequence"
        >
          <span className="inline-flex items-center gap-1"><Unlink2 size={11} /> Standalone</span>
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !newTitle.trim() || !newDueDate}
          className="h-[32px] px-3 rounded-lg bg-neutral-900 text-white text-[11px] font-medium disabled:opacity-40 hover:bg-neutral-800 shrink-0 inline-flex items-center gap-1"
        >
          <Plus size={13} /> Add
        </button>
      </div>}
      <SubtaskWorkDrawer
        subtask={openSubtask}
        parentTask={parentTask}
        prerequisite={openSubtask ? getSubtaskPrerequisite(openSubtask, subtasks) : null}
        readOnly={canManage}
        canManageDeadline={canManage}
        onClose={() => setOpenSubtask(null)}
      />
    </div>
  );
}
