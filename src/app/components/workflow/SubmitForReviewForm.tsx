import { useState } from "react";
import { CircleAlert, Paperclip, Send, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  submitTaskForReview,
  type Task,
} from "../../services/taskService";
import { useToast } from "../ui/Toast";
import {
  getTaskSubmissionReadiness,
  type SubtaskReadinessRecord,
} from "../../features/tasks/selectors/submissionReadiness";

export function SubmitForReviewForm({
  task,
  subtasks = [],
  onSubmitted,
}: {
  task: Task;
  subtasks?: SubtaskReadinessRecord[];
  onSubmitted?: () => void;
}) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const readiness = getTaskSubmissionReadiness(task, subtasks);

  const submit = async () => {
    if (!user?.id) {
      toast("You must be signed in.", "error");
      return;
    }
    if (!readiness.ready) {
      toast(
        "Every subtask must be approved before the parent task can be submitted.",
        "error",
      );
      return;
    }
    if (!note.trim()) {
      toast("Add a completion note for the reviewer.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await submitTaskForReview(task.id, {
        note,
        attachments: files,
        submitterId: user.id,
        submitterName:
          userProfile?.full_name || user.email || "Member",
      });
      toast("Task submitted for review.", "success");
      onSubmitted?.();
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Failed to submit the task.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!readiness.ready) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
        <div className="flex items-start gap-2.5">
          <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="text-[12px] font-medium text-amber-950">
              Finish subtask review first
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
              {readiness.approvedSubtasks} of {readiness.totalSubtasks} subtasks approved. The parent task can be submitted only after every subtask is approved by its reviewer.
            </p>
            {readiness.awaitingReviewSubtasks > 0 && (
              <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-white/80 px-2 py-1 text-[10.5px] font-medium text-amber-800">
                {readiness.awaitingReviewSubtasks} awaiting Team Leader review
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="text-[12px] font-medium text-blue-900">
        Ready for review?
      </div>
      <p className="mt-0.5 text-[11px] text-blue-700">
        Add a completion note and evidence. Submission moves this task to the
        review queue; only a reviewer can mark it completed.
      </p>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        placeholder="Summarize the result, completed work, and anything the reviewer should check…"
        className="mt-3 w-full resize-none rounded-lg border border-blue-200 bg-white px-3 py-2 text-[12px] text-neutral-800 outline-none focus:border-blue-400"
      />

      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-1 text-[10.5px] text-blue-800"
            >
              <Paperclip size={11} />
              <span className="max-w-[220px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() =>
                  setFiles((current) =>
                    current.filter((_, fileIndex) => fileIndex !== index),
                  )
                }
                aria-label={`Remove ${file.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-blue-800">
          <Paperclip size={13} />
          Add evidence
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(event) =>
              setFiles(Array.from(event.target.files || []))
            }
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-[11.5px] font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          <Send size={13} />
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </div>
  );
}
