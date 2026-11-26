import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import { verifyTask } from "../../../services/taskService";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { assertCurrentTaskReview, readTaskReviewDecision } from '../services/taskReviewDecision';
import type { Task } from '../../tasks';
import type { ReviewSubmission } from '../types';
import {
  assertWorkAcceptanceAvailable,
  fetchWorkFinancialClearance,
  isCashCompletionError,
  TaskCashClearancePanel,
  useTaskCashClearance,
  type CashReviewFocus,
} from "../../budget";

interface ReviewDecisionFormProps {
  task: Task;
  submission: ReviewSubmission;
  onDone?: (saved: boolean) => void;
  onOpenFinancialReview?: (focus: CashReviewFocus) => void;
}

export function ReviewDecisionForm(props: ReviewDecisionFormProps) {
  // Do not carry approval notes, confirmation mode, or cash errors to a new task.
  const { user } = useAuth();
  return <TaskReviewDecisionForm key={`${user?.id}:${props.task.id}:${props.submission.id}`} {...props} />;
}

function TaskReviewDecisionForm({
  task,
  submission,
  onDone,
  onOpenFinancialReview,
}: ReviewDecisionFormProps) {
  const { user, userProfile } = useAuth();
  const taskId = task.id;
  const { toast } = useToast();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverBlocked, setServerBlocked] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [attempted, setAttempted] = useState<boolean | undefined>();
  const draftGuard = useExplicitDraft('Task review decision', mode !== 'idle' || !!feedback, busy, () => { setMode('idle'); setFeedback(''); });
  const cash = useTaskCashClearance(taskId);
  const approvalDisabled = busy || cash.loading || attempted !== undefined;
  const approveTriggerDisabled = approvalDisabled || mode !== 'idle';
  const rejectTriggerDisabled = busy || attempted !== undefined || mode !== 'idle';
  const MIN_CHANGE_FEEDBACK = 5;

  const approveModalDisabledReason = busy
    ? "Submitting review decision…"
    : attempted !== undefined
      ? "Verify the previous review attempt before approving."
      : cash.loading
        ? "Checking cash clearance before approval can proceed…"
        : "";

  const approveTriggerBlockers = [
    attempted !== undefined
      ? "Verify the previous review attempt using Check current decision first."
      : "",
    mode !== 'idle'
      ? "Finish or cancel the open review confirmation dialog first."
      : "",
  ];

  const rejectTriggerBlockers = [
    attempted !== undefined
      ? "Verify the previous review attempt using Check current decision first."
      : "",
    mode !== 'idle'
      ? "Finish or cancel the open review confirmation dialog first."
      : "",
  ];

  async function confirmed(approve: boolean) {
    const clearance = approve ? await fetchWorkFinancialClearance(taskId).catch(() => undefined) : undefined;
    toast(approve ? clearance?.completed ? 'Task approved and completed.' : clearance?.cashOutstanding
      ? 'Work accepted. Financial clearance pending.' : 'Work accepted.' : 'Sent back with feedback.', approve ? 'success' : 'warning');
    setMode('idle');
    setFeedback('');
    draftGuard.markClean();
    onDone?.(true);
  }

  async function checkDecision() {
    if (!user?.id || attempted === undefined || draftGuard.pendingRef.current) return;
    draftGuard.pendingRef.current = true;
    setBusy(true);
    try {
      const state = await readTaskReviewDecision(taskId, submission.id, user.id, attempted);
      if (state === 'saved') await confirmed(attempted);
      else if (state === 'pending') { setAttempted(undefined); setDecisionError(''); }
      else { setDecisionError('The submission changed. Refresh before continuing.'); onDone?.(false); }
    } catch {
      setDecisionError('The review decision could not be verified. Check the current decision again.');
    } finally { draftGuard.pendingRef.current = false; setBusy(false); }
  }

  const decide = async () => {
    if (!user?.id || attempted !== undefined || draftGuard.pendingRef.current) return;
    const approve = mode === "approve";
    const trimmedFeedback = feedback.trim();
    if (!approve && trimmedFeedback.length < MIN_CHANGE_FEEDBACK) {
      toast(
        trimmedFeedback.length === 0
          ? "Feedback is required when requesting changes."
          : `Feedback must be at least ${MIN_CHANGE_FEEDBACK} characters when requesting changes.`,
        "error",
      );
      return;
    }

    draftGuard.pendingRef.current = true;
    setBusy(true);
    setDecisionError("");
    try {
      if (approve) {
        await assertWorkAcceptanceAvailable(taskId);
        await cash.refresh();
      }
      await assertCurrentTaskReview(task, submission, user.id, userProfile?.role);
      setAttempted(approve);
      let failure: unknown;
      try {
        await verifyTask(taskId, approve, feedback.trim() || undefined, {
          id: user.id, name: userProfile?.full_name || 'Reviewer',
        });
      } catch (error) { failure = error; }
      const state = await readTaskReviewDecision(taskId, submission.id, user.id, approve);
      if (state === 'saved') { await confirmed(approve); return; }
      if (state === 'pending' && isCashCompletionError(failure)) { setAttempted(undefined); throw failure; }
      throw new Error('The decision could not be confirmed. Check the current decision before trying again.');
    } catch (error) {
      if (approve && isCashCompletionError(error)) {
        setServerBlocked(true);
        await cash.refresh();
        toast("Approval is blocked by unresolved cash. See Cash clearance for the request and next steps.", "error");
      } else {
        const message = error instanceof Error ? error.message : "Failed to submit review.";
        setDecisionError(message);
        toast(message, "error");
      }
    } finally {
      draftGuard.pendingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div>
      <TaskCashClearancePanel
        {...cash}
        serverBlocked={serverBlocked}
        currentUserId={user?.id}
        role={userProfile?.role}
        onRefresh={() => { void cash.refresh(); }}
        onOpenFinancialReview={onOpenFinancialReview}
      />
      <div className="flex items-center gap-2">
        <ActionBlockerGroup
          actionLabel="Approve work"
          blockers={approveTriggerDisabled ? approveTriggerBlockers : []}
          busy={busy || cash.loading}
          className="flex-1"
        >
          <button
            type="button"
            onClick={() => setMode("approve")}
            disabled={approveTriggerDisabled}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[12.5px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none"
          >
            <CheckCircle2 size={14} /> Approve work
          </button>
        </ActionBlockerGroup>
        <ActionBlockerGroup
          actionLabel="Request changes"
          blockers={rejectTriggerDisabled ? rejectTriggerBlockers : []}
          busy={busy}
          className="flex-1"
        >
          <button
            type="button"
            onClick={() => setMode("reject")}
            disabled={rejectTriggerDisabled}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-2 text-[12.5px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40 disabled:pointer-events-none"
          >
            <RotateCcw size={14} /> Request changes
          </button>
        </ActionBlockerGroup>
      </div>
      {attempted!==undefined&&decisionError&&<div role="alert"><p>{decisionError}</p><button type="button" disabled={busy} onClick={()=>void checkDecision()}>Check current decision</button></div>}
      {mode!=='idle'&&attempted===undefined&&(
        <DecisionModal
          title={mode==='approve'?'Approve this submission?':'Request changes to this task?'}
          description={mode==='approve'?`Approve submission ${submission.version}? Accepting work unlocks required receipts. Outstanding cash still blocks final completion.`:`Return submission ${submission.version} and explain what the task lead needs to change.`}
          decision={mode==='approve'?'approve':'changes'}
          reason={feedback}
          onReasonChange={setFeedback}
          reasonLabel={mode==='approve'?'Approval note (optional)':'Required change feedback'}
          requireReason={mode==='reject'}
          minReasonLength={mode==='reject'?MIN_CHANGE_FEEDBACK:0}
          maxReasonLength={mode==='reject'?INPUT_LIMITS.REASON:INPUT_LIMITS.COMMENT}
          busy={busy}
          disabled={mode==='approve'&&approvalDisabled}
          disabledReason={mode==='approve'?approveModalDisabledReason:undefined}
          warningTooltip={mode==='reject'?'Returns this submission to the task lead for revisions.':undefined}
          error={decisionError}
          onConfirm={()=>void decide()}
          onCancel={()=>{if(busy)return;draftGuard.markClean();setMode('idle');setFeedback('');setDecisionError('');}}
        />
      )}
    </div>
  );
}
