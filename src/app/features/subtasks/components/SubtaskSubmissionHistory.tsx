import { MessageSquareWarning } from "lucide-react";
import { formatDate } from "../../../components/workflow/primitives";
import type { SubtaskSubmission } from "../types";
import { SubtaskEvidenceLink } from "./SubtaskEvidenceLink";

export function SubtaskSubmissionHistory({ submissions,currentReviewerName }: { submissions: SubtaskSubmission[];reviewerFallback?:string;currentReviewerName?:string }) {
  if (submissions.length === 0) return null;
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">
        Submission history
      </div>
      <div className="space-y-3">
        {submissions.map((submission) => (
          <div key={submission.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2 text-[10.5px] text-neutral-500">
              <span>Attempt {submission.version} · {submission.submitterName}</span>
              <span className="capitalize">{submission.status.replace("_", " ")}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[11.5px] text-neutral-700">{submission.note}</p>
            <div className="mt-2 space-y-1.5">
              {submission.attachments.map((attachment) => (
                <SubtaskEvidenceLink
                  key={attachment.id || attachment.filePath}
                  fileName={attachment.fileName}
                  filePath={attachment.filePath}
                />
              ))}
            </div>
            <div className="mt-2 text-[10px] text-neutral-400">{formatDate(submission.submittedAt)}</div>
            <p className="mt-1 text-[11px] text-neutral-500">{submission.status==='pending'?`Current reviewer: ${currentReviewerName||'Current reviewer unavailable'}`:`Historical decision by ${submission.decidedByName||'Reviewer unavailable'}`}</p>
            {submission.decidedAt&&<div className="text-[10px] text-neutral-400">Decision: {formatDate(submission.decidedAt)}</div>}
            {submission.decisionFeedback && (
              <div className="mt-2 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800">
                <MessageSquareWarning size={13} className="mt-0.5 shrink-0" />
                <span>{submission.decidedByName || 'Reviewer unavailable'}: {submission.decisionFeedback}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
