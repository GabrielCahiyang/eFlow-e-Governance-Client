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
  const effectiveCanReview = canReview && task.status === 'for_review' && !task.archivedAt && canUserReviewTask(task, user?.id, userProfile?.role);

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
  }, [task.id, task.latestSubmission?.id, task.status, retry]);

  return (
    <div className={compact ? "" : "rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-5 shadow-xs space-y-4"}>
      {loading && <p role="status" className="text-xs text-[var(--eflow-text-muted)]">Loading submission evidence…</p>}
      {error && <div role="alert" className="rounded-lg border border-[var(--eflow-negative-text)]/30 bg-[var(--eflow-negative-bg)] px-3 py-2 text-xs text-[var(--eflow-negative-text)]"><p>{error}</p><button type="button" className="underline font-medium mt-1" onClick={() => setRetry(value => value + 1)}>Retry evidence</button></div>}
      {!loading && !error && <SubmissionSummary task={task} attachments={attachments} />}
      {showDecision && !loading && !error && effectiveCanReview && <ReviewDecisionForm taskId={task.id} onDone={() => {setRetry(value=>value+1);onDone?.();}} />}
      {task.status === 'for_review' && !effectiveCanReview && user?.id === task.latestSubmission?.submitterId && (
        <div className="rounded-lg border border-[var(--eflow-warning-text)]/25 bg-[var(--eflow-warning-bg)] px-3 py-2 text-[12px] text-[var(--eflow-warning-text)]">
          You submitted this attempt, so another assigned reviewer must decide it.
        </div>
      )}
      {!loading && !error && <details className="work-secondary"><summary>Submission history · {submissions.length}</summary><SubmissionHistory submissions={submissions} /></details>}
    </div>
  );
}
