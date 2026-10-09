import { useEffect, useRef, useState } from "react";
import { requestNavigation } from '../../../shared/navigationGuard';
import { Calendar, CheckCircle2, Eye, ListChecks, LockKeyhole, Unlink2, UsersRound, X } from "lucide-react";
import type { Task } from "../../../services/taskService";
import type { Subtask } from "../../../services/subtaskService";
import { formatDate, ProgressBar, relativeDays } from "../../../components/workflow/primitives";
import {
  fetchSubtask,
  fetchSubtaskProgressUpdates,
  fetchSubtaskSubmissions,
} from "../services/subtaskWorkflowService";
import type { SubtaskProgressUpdate, SubtaskSubmission } from "../types";
import { SubtaskProgressForm } from "./SubtaskProgressForm";
import { SubtaskProgressHistory } from "./SubtaskProgressHistory";
import { SubtaskSubmissionHistory } from "./SubtaskSubmissionHistory";
import { SubtaskDeadlineEditor } from "./SubtaskDeadlineEditor";
import { SubtaskReviewerBadge } from "./SubtaskReviewerBadge";
import { useSubtaskReviewerDirectory } from "../hooks/useSubtaskReviewerDirectory";
import { WorkBudgetCard } from "../../budget";
import { InspectorPanel } from "../../../shared/motion";

const statusMeta = {
  todo: { label: "To do", tone: "bg-neutral-100 text-neutral-700" },
  in_progress: { label: "In progress", tone: "bg-blue-50 text-blue-700" },
  for_review: { label: "For review", tone: "bg-amber-50 text-amber-700" },
  changes_requested: { label: "Updates needed", tone: "bg-rose-50 text-rose-700" },
  completed: { label: "Approved", tone: "bg-emerald-50 text-emerald-700" },
} as const;

export function SubtaskWorkDrawer({
  subtask,
  parentTask,
  prerequisite,
  readOnly = false,
  canManageDeadline = false,
  currentReviewerId,
  onClose,
}: {
  subtask: Subtask | null;
  parentTask?: Task;
  prerequisite?: Subtask | null;
  readOnly?: boolean;
  canManageDeadline?: boolean;
  currentReviewerId?: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(subtask);
  const [submissions, setSubmissions] = useState<SubtaskSubmission[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<SubtaskProgressUpdate[]>([]);
  const visibleReviewer=current?.status==='for_review'&&currentReviewerId?currentReviewerId:current?.reviewerId;
  const reviewerIds = visibleReviewer ? [visibleReviewer] : [];
  const { reviewersById, loading: reviewerLoading } = useSubtaskReviewerDirectory(reviewerIds);

  const scopeRef = useRef(subtask?.id); scopeRef.current = subtask?.id;
  const close = () => void requestNavigation(onClose);
  const reload = async () => {
    if (!subtask) return;
    const [nextSubtask, nextSubmissions, nextProgressUpdates] = await Promise.all([
      fetchSubtask(subtask.id),
      fetchSubtaskSubmissions(subtask.id),
      fetchSubtaskProgressUpdates(subtask.id),
    ]);
    if (scopeRef.current !== subtask.id) return;
    setCurrent(nextSubtask);
    setSubmissions(nextSubmissions);
    setProgressUpdates(nextProgressUpdates);
  };
  useEffect(() => { setCurrent(subtask); setSubmissions([]); setProgressUpdates([]); void reload(); }, [subtask?.id]);
  if (!subtask) return null;
  if (!current) return <InspectorPanel open onClose={close} ariaLabel="Subtask unavailable" className="w-full sm:w-[460px]" layer={60}><div className="p-4 space-y-3"><h2 className="font-semibold">Subtask unavailable</h2><p role="status">This subtask was removed or is no longer accessible. Return to your current assigned work.</p><button type="button" onClick={close} className="rounded-md border px-3 py-2">Close subtask detail</button></div></InspectorPanel>;

  const status = statusMeta[current.status] || statusMeta.todo;
  const due = parentTask ? relativeDays(parentTask.deadline || parentTask.dueDate) : undefined;
  const assignedNames = current.assignedToIds
    .map((id) => {
      const index = parentTask?.teamMemberIds?.indexOf(id) ?? -1;
      return index >= 0 ? parentTask?.teamMemberNames?.[index] : undefined;
    })
    .filter((name): name is string => Boolean(name));

  return (
    <InspectorPanel
      open={Boolean(current)}
      onClose={close}
      ariaLabel={`Subtask details: ${current.title}`}
      className="w-full sm:w-[460px]"
      layer={60}
    >
        <header className="border-b border-neutral-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${status.tone}`}>{status.label}</span>
              <span className={`ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${current.isStandalone ? "bg-violet-50 text-violet-700" : "bg-neutral-100 text-neutral-600"}`}>
                {current.isStandalone ? <><Unlink2 size={10} /> Standalone</> : <>Ordered step</>}
              </span>
              <h2 className="mt-2 text-[16px] font-semibold text-neutral-900">{current.title}</h2>
              <p className="mt-0.5 truncate text-[11px] text-neutral-500">Subtask of {parentTask?.title || "parent task"}</p>
            </div>
            <button aria-label="Close subtask detail" onClick={close} className="p-1 text-neutral-400 hover:text-neutral-800"><X size={18} /></button>
          </div>

          {prerequisite && !["for_review", "completed"].includes(current.status) && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] text-amber-900">
              <LockKeyhole size={15} className="mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Waiting for an earlier step.</strong>
                <p className="mt-0.5 text-amber-700">“{prerequisite.title}” must be approved by the Team Lead before this subtask can start.</p>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-500">
              <span className="flex items-center gap-1.5"><ListChecks size={13} /> Subtask progress</span>
              <span className="font-semibold text-neutral-900">{current.percentComplete}%</span>
            </div>
            <div className="mt-2"><ProgressBar value={current.percentComplete} tone={current.status === "completed" ? "good" : "neutral"} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-neutral-400">Review rule</div>
                <div className="mt-0.5 flex items-center gap-1 text-neutral-700"><CheckCircle2 size={12} /> Independent approval required</div>
              </div>
              <div>
                <div className="text-neutral-400">Parent deadline</div>
                <div className="mt-0.5 flex items-center gap-1 text-neutral-700"><Calendar size={12} /> {formatDate(parentTask?.deadline || parentTask?.dueDate)} {due?.label ? `· ${due.label}` : ""}</div>
              </div>
            </div>
            {visibleReviewer && (
              <div className="mt-3 border-t border-neutral-200 pt-3">
                <SubtaskReviewerBadge
                  reviewer={reviewersById[visibleReviewer]}
                  status={current.status}
                  loading={reviewerLoading}
                />
              </div>
            )}
            <div className="mt-3 border-t border-neutral-200 pt-3 text-[11px]">
              <div className="text-neutral-400">Assigned contributors</div>
              <div className="mt-1 flex items-center gap-1.5 text-neutral-700">
                <UsersRound size={12} /> {assignedNames.join(", ") || "Assigned team member"}
              </div>
            </div>
          </div>

          <SubtaskDeadlineEditor
            subtask={current}
            parentTask={parentTask}
            canManage={canManageDeadline}
            onSaved={reload}
          />

          {parentTask && (
            <WorkBudgetCard
              task={parentTask}
              subtask={current}
              canManage={canManageDeadline || !readOnly}
            />
          )}

          {readOnly ? (
            <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11.5px] text-blue-800">
              <Eye size={14} className="mt-0.5 shrink-0" />
              <span><strong className="font-semibold">Team Leader view.</strong> Progress is read-only here; the assigned member owns these updates.</span>
            </div>
          ) : (
            <SubtaskProgressForm subtask={current} prerequisite={prerequisite} onSaved={reload} />
          )}
          <SubtaskProgressHistory updates={progressUpdates} />
          <SubtaskSubmissionHistory submissions={submissions} />
        </div>
    </InspectorPanel>
  );
}
