import { useEffect, useState } from "react";
import type { Task } from "../../../services/taskService";
import { useAuth } from "../../../contexts/AuthContext";
import { fetchSubmissionAttachments, fetchTaskSubmissions } from "../services/reviewService";
import { canUserReviewTask } from "../selectors";
import type { ReviewAttachment, ReviewSubmission } from "../types";
import { ReviewDecisionForm } from "./ReviewDecisionForm";
import { SubmissionHistory } from "./SubmissionHistory";
import { SubmissionSummary } from "./SubmissionSummary";

export interface TaskReviewPanelProps {
  task: Task;
  onDone?: () => void;
  compact?: boolean;
  canReview?: boolean;
  showDecision?: boolean;
}

export function TaskReviewPanel({
  task,
  onDone,
  compact,
  canReview = false,
  showDecision = true,
}: TaskReviewPanelProps) {
  const { user, userProfile } = useAuth();
  const [attachments, setAttachments] = useState<ReviewAttachment[]>([]);
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const effectiveCanReview = canReview && canUserReviewTask(task, user?.id, userProfile?.role);

  useEffect(() => {
    let active = true;
    setAttachments([]); setSubmissions([]); setLoading(true); setError('');
    Promise.all([
      fetchSubmissionAttachments(task.id, task.latestSubmission?.id),
      fetchTaskSubmissions(task.id),
    ])
      .then(([nextAttachments, nextSubmissions]) => {
        if (!active) return;
        setAttachments(nextAttachments);
        setSubmissions(nextSubmissions); setLoading(false);
      })
      .catch(reason => {
        if (!active) return;
        setAttachments([]);
        setSubmissions([]); setLoading(false); setError(reason instanceof Error ? reason.message : 'Could not load submission evidence.');
      });
    return () => { active = false; };
  }, [task.id, task.latestSubmission?.id, retry]);

  return (
    <div className={compact ? "" : "rounded-xl border border-neutral-200 bg-white p-4"}>
      {loading && <p role="status">Loading submission evidence…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry evidence</button></div>}
      {!loading && !error && <SubmissionSummary task={task} attachments={attachments} />}
      {showDecision && !loading && !error && effectiveCanReview && <ReviewDecisionForm taskId={task.id} onDone={onDone} />}
      {!effectiveCanReview && user?.id === task.latestSubmission?.submitterId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          You submitted this attempt, so another assigned reviewer must decide it.
        </div>
      )}
      {!loading && !error && <SubmissionHistory submissions={submissions} />}
    </div>
  );
}
