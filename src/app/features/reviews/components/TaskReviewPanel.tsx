import { readableUiError } from '../../../shared/userFacingError';
import { useEffect, useState } from "react";
import type { Task } from "../../../services/taskService";
import { useAuth } from "../../../contexts/AuthContext";
import { fetchSubmissionAttachments, fetchTaskSubmissions } from "../services/reviewService";
import { canUserReviewTask } from "../selectors";
import type { ReviewAttachment, ReviewSubmission } from "../types";
import { ReviewDecisionForm } from "./ReviewDecisionForm";
import { SubmissionHistory } from "./SubmissionHistory";
import { SubmissionSummary } from "./SubmissionSummary";
import type { CashReviewFocus } from '../../budget';

export interface TaskReviewPanelProps {
  task: Task;
  onDone?: () => void;
  compact?: boolean;
  canReview?: boolean;
  showDecision?: boolean;
  onOpenFinancialReview?: (focus: CashReviewFocus) => void;
  onDecided?: (submissionId: string) => void;
}

export function TaskReviewPanel({
  task,
  onDone,
  compact,
  canReview = false,
  showDecision = true,
  onOpenFinancialReview,
  onDecided,
}: TaskReviewPanelProps) {
  const { user, userProfile } = useAuth();
  const [attachments, setAttachments] = useState<ReviewAttachment[]>([]);
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const latest = submissions[0];
  const latestSubmissionPending = latest?.status === 'pending';
  const effectiveCanReview = canReview && task.status === 'for_review' && latestSubmissionPending && !task.archivedAt &&
    (!task.latestSubmission?.id || latest.id === task.latestSubmission.id) && canUserReviewTask({ ...task,
      latestSubmission: { ...latest, attachments: [] },
    }, user?.id, userProfile?.role);

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
        setSubmissions([]); setLoading(false); setError(readableUiError(reason, "Could not load submission evidence.", 'write'));
      });
    return () => { active = false; };
  }, [task.id, task.latestSubmission?.id, task.status, task.updatedAt, user?.id, retry]);

  return (
    <div className={compact ? "" : "rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-5 shadow-xs space-y-4"}>
      {loading && <p role="status" className="text-xs text-[var(--eflow-text-muted)]">Loading submission evidence…</p>}
      {error && <div role="alert" className="rounded-lg border border-[var(--eflow-negative-text)]/30 bg-[var(--eflow-negative-bg)] px-3 py-2 text-xs text-[var(--eflow-negative-text)]"><p>{error}</p><button type="button" className="underline font-medium mt-1" onClick={() => setRetry(value => value + 1)}>Retry evidence</button></div>}
      {!loading && !error && <SubmissionSummary task={task} attachments={attachments} />}
      {showDecision && !loading && !error && effectiveCanReview && latest && <ReviewDecisionForm task={task} submission={latest} onOpenFinancialReview={onOpenFinancialReview} onDone={saved => {setRetry(value=>value+1);if(saved)onDecided?.(latest.id);onDone?.();}} />}
      {!loading && !error && task.status === 'for_review' && latest?.status === 'approved' && <p role="status">Work accepted. Financial clearance and finalization are tracked separately.</p>}
      {task.status === 'for_review' && latestSubmissionPending && !effectiveCanReview && user?.id === latest.submitterId && (
        <div className="rounded-lg border border-[var(--eflow-warning-text)]/25 bg-[var(--eflow-warning-bg)] px-3 py-2 text-[12px] text-[var(--eflow-warning-text)]">
          You submitted this attempt, so another assigned reviewer must decide it.
        </div>
      )}
      {!loading && !error && <details className="work-secondary"><summary>Submission history · {submissions.length}</summary><SubmissionHistory submissions={submissions} /></details>}
    </div>
  );
}
