import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import {DecisionModal} from '../../../components/ui/DecisionModal';
import { verifyTask } from "../../../services/taskService";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { isCashCompletionError, TaskCashClearancePanel, useTaskCashClearance, type CashReviewFocus } from "../../budget";

interface ReviewDecisionFormProps {
  taskId: string;
  onDone?: () => void;
  onOpenFinancialReview?: (focus: CashReviewFocus) => void;
}

export function ReviewDecisionForm(props: ReviewDecisionFormProps) {
  // Do not carry approval notes, confirmation mode, or cash errors to a new task.
  return <TaskReviewDecisionForm key={props.taskId} {...props} />;
}

function TaskReviewDecisionForm({
  taskId,
  onDone,
  onOpenFinancialReview,
}: ReviewDecisionFormProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverBlocked, setServerBlocked] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const draftGuard = useExplicitDraft('Task review decision', mode !== 'idle' || !!feedback, busy, () => { setMode('idle'); setFeedback(''); });
  const cash = useTaskCashClearance(taskId);
  const approvalDisabled = busy || cash.loading || cash.blockers.length > 0;

  const decide = async () => {
    if (draftGuard.pendingRef.current) return;
    const approve = mode === "approve";
    if (!approve && !feedback.trim()) {
      toast("Feedback is required when requesting changes.", "error");
      return;
    }

    draftGuard.pendingRef.current = true;
    setBusy(true);
    setDecisionError("");
    try {
      if (approve) {
        // Refresh at confirmation as well as on mount/realtime. The database
        // guard remains authoritative if a new request races this read.
        const blockers = await cash.refresh();
        if (blockers?.length) {
          toast("Approval is blocked by open cash requests. See Cash clearance for the next steps.", "error");
          return;
        }
      }
      await verifyTask(taskId, approve, feedback.trim() || undefined, {
        id: user?.id,
        name: userProfile?.full_name || "Reviewer",
      });
      toast(
        approve ? "Task approved and completed." : "Sent back with feedback.",
        approve ? "success" : "warning",
      );
      setMode("idle");
      setFeedback("");
      draftGuard.markClean();
      onDone?.();
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
          <button
            onClick={() => setMode("approve")}
            disabled={approvalDisabled||mode!=='idle'}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[12.5px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <CheckCircle2 size={14} /> Approve
          </button>
          <button
            onClick={() => setMode("reject")}
            disabled={busy||mode!=='idle'}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-2 text-[12.5px] font-medium text-amber-900 hover:bg-amber-100"
          >
            <RotateCcw size={14} /> Request changes
          </button>
      </div>
      {mode!=='idle'&&<DecisionModal title={mode==='approve'?'Approve this task?':'Request changes to this task?'} description={mode==='approve'?'Are you sure you want to approve this task? It will be marked complete.':'Are you sure you want to return this task? Explain what needs to change so the task lead can update it.'} decision={mode==='approve'?'approve':'changes'} reason={feedback} onReasonChange={setFeedback} reasonLabel={mode==='approve'?'Approval note (optional)':'Required change feedback'} requireReason={mode==='reject'} busy={busy} disabled={mode==='approve'&&approvalDisabled} error={decisionError} onConfirm={()=>void decide()} onCancel={()=>{if(busy)return;draftGuard.markClean();setMode('idle');setFeedback('');setDecisionError('');}}/>}
    </div>
  );
}
