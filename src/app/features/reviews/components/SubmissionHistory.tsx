import { formatDate } from "../../../components/workflow/primitives";
import type { ReviewSubmission } from "../types";

const statusLabel: Record<ReviewSubmission["status"], string> = {
  pending: "Pending review",
  approved: "Approved",
  changes_requested: "Updates needed",
};

export function SubmissionHistory({
  submissions,
}: {
  submissions: ReviewSubmission[];
}) {
  if (!submissions.length) return <p>No submissions recorded.</p>;

  return (
      <div className="mt-2 space-y-2" aria-label="Recorded submission attempts">
        {submissions.map((submission) => (
          <div key={submission.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
            <div className="flex items-center justify-between gap-2 text-[10.5px] text-neutral-500">
              <span>Attempt {submission.version} · {submission.submitterName}</span>
              <span>{statusLabel[submission.status]}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-neutral-700">{submission.note}</div>
            <div className="mt-1 text-[10px] text-neutral-400">{formatDate(submission.submittedAt)}</div>
            {submission.status !== 'pending' && <div className="mt-1 text-[11px] text-neutral-600">Decision by {submission.decidedByName || 'Assigned reviewer'}{submission.decidedAt ? ` · ${formatDate(submission.decidedAt)}` : ''}</div>}
            {submission.decisionFeedback && (
              <div className="mt-1.5 rounded bg-white px-2 py-1 text-[10.5px] text-neutral-600">
                {submission.decidedByName || "Reviewer"}: {submission.decisionFeedback}
              </div>
            )}
          </div>
        ))}
      </div>
  );
}
