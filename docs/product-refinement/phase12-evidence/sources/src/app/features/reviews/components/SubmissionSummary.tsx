import DOMPurify from "dompurify";
import { Clock, MessageSquareWarning } from "lucide-react";
import type { Task } from "../../../services/taskService";
import { InitialsAvatar } from "../../../components/workflow/StatusBadges";
import { formatDate } from "../../../components/workflow/primitives";
import type { ReviewAttachment } from "../types";
import { SubmissionAttachments } from "./SubmissionAttachments";

export function SubmissionSummary({
  task,
  attachments,
}: {
  task: Task;
  attachments: ReviewAttachment[];
}) {
  const submission = task.latestSubmission;

  return (
    <>
      {task.rejectionNote && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
          <MessageSquareWarning size={14} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-rose-700">
              Previous feedback
            </div>
            <div className="text-[12px] text-rose-900">{task.rejectionNote}</div>
          </div>
        </div>
      )}

      {submission ? (
        <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <InitialsAvatar name={submission.submitterName} size={22} />
            <span className="text-[12.5px] font-medium text-neutral-900">
              {submission.submitterName}
            </span>
            {submission.version && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-neutral-500">
                Attempt {submission.version}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Clock size={11} /> {formatDate(submission.submittedAt)}
            </span>
          </div>
          <div className="whitespace-pre-wrap text-[12.5px] text-neutral-700 [&_p]:m-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-1.5 [&_ul]:pl-4 [&_ol]:pl-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(submission.note) }} />
        </div>
      ) : (
        <div className="mb-3 text-[12px] text-neutral-400">
          No submission note recorded.
        </div>
      )}

      <SubmissionAttachments attachments={attachments} />
    </>
  );
}
