import {
  CheckCircle2,
  Clock3,
  FileText,
  History,
  ListChecks,
  UsersRound,
} from "lucide-react";
import type { Task } from "../../../services/taskService";
import { ProgressBar } from "../../../components/workflow/primitives";
import {
  SubtaskProgressHistory,
  SubtaskSubmissionHistory,
} from "../../subtasks";
import type { TaskSubtaskReviewEvidence } from "../types";

const STATUS = {
  todo: { label: "To do", tone: "bg-neutral-100 text-neutral-600" },
  in_progress: { label: "In progress", tone: "bg-blue-50 text-blue-700" },
  for_review: { label: "For leader review", tone: "bg-amber-50 text-amber-700" },
  changes_requested: { label: "Updates needed", tone: "bg-rose-50 text-rose-700" },
  completed: { label: "Leader approved", tone: "bg-emerald-50 text-emerald-700" },
} as const;

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wider text-neutral-400">{icon}{label}</div>
      <div className="mt-0.5 text-[17px] font-semibold text-neutral-900 tabular-nums">{value}</div>
    </div>
  );
}

function contributorNames(task: Task, ids: string[]): string[] {
  return ids.map((id) => {
    const index = task.teamMemberIds?.indexOf(id) ?? -1;
    return index >= 0 ? task.teamMemberNames?.[index] : undefined;
  }).filter((name): name is string => Boolean(name));
}

export function TaskSubtaskEvidenceSection({
  task,
  evidence,
  loading,
  error,
}: {
  task: Task;
  evidence: TaskSubtaskReviewEvidence[];
  loading: boolean;
  error?: string;
}) {
  const approvedCount = evidence.filter(({ subtask }) => subtask.status === "completed").length;
  const updateCount = evidence.reduce((total, item) => total + item.progressUpdates.length, 0);
  const evidenceCount = evidence.reduce(
    (total, item) => total
      + item.progressUpdates.filter((update) => update.attachmentPath).length
      + item.submissions.reduce((sum, submission) => sum + submission.attachments.length, 0),
    0,
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <ListChecks size={16} />
        </span>
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-900">Subtask execution record</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">Every contributor update, blocker, next step, attachment, evidence attempt, and Team Leader decision is shown below.</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Metric label="Subtasks" value={evidence.length} icon={<ListChecks size={11} />} />
        <Metric label="Lead approved" value={approvedCount} icon={<CheckCircle2 size={11} />} />
        <Metric label="Updates" value={updateCount} icon={<History size={11} />} />
        <Metric label="Evidence files" value={evidenceCount} icon={<FileText size={11} />} />
      </div>

      {loading ? (
        <div className="mt-3 space-y-3">
          {[0, 1].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-neutral-100" />)}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[11.5px] text-rose-700">{error}</div>
      ) : evidence.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-5 text-center text-[11.5px] text-neutral-500">
          This task has no subtasks. Review the parent submission and activity history below.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {evidence.map(({ subtask, progressUpdates, submissions }, index) => {
            const status = STATUS[subtask.status] || STATUS.todo;
            const names = contributorNames(task, subtask.assignedToIds);
            return (
              <article key={subtask.id} className="overflow-hidden rounded-xl border border-neutral-200">
                <header className="border-b border-neutral-100 bg-neutral-50/80 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[9.5px] uppercase tracking-wider text-neutral-400">Step {subtask.position + 1} · {index + 1} of {evidence.length}</div>
                      <h4 className="mt-0.5 text-[13px] font-semibold text-neutral-900">{subtask.title}</h4>
                      <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-neutral-500">
                        <UsersRound size={12} /> {names.join(", ") || "Assigned team member"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[9.5px] font-medium ${status.tone}`}>{status.label}</span>
                      <span className="text-[12px] font-semibold text-neutral-800 tabular-nums">{subtask.percentComplete}%</span>
                    </div>
                  </div>
                  <div className="mt-2"><ProgressBar value={subtask.percentComplete} tone={subtask.status === "completed" ? "good" : "neutral"} /></div>
                </header>

                <div className="grid gap-3 p-3 xl:grid-cols-2">
                  <SubtaskProgressHistory updates={progressUpdates} />
                  {submissions.length > 0 ? (
                    <SubtaskSubmissionHistory submissions={submissions} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500"><Clock3 size={12} /> Submission history</div>
                      <div className="mt-3 text-[11.5px] text-neutral-400">No evidence submission was recorded for this subtask.</div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
