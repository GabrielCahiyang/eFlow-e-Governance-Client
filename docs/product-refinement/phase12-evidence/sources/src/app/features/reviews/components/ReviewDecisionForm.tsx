import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
        "success",
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
      {decisionError && <p role="alert" className="mb-3 text-xs text-rose-700">{decisionError}</p>}
      {mode === "idle" ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("approve")}
            disabled={approvalDisabled}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[12.5px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <CheckCircle2 size={14} /> Approve
          </button>
          <button
            onClick={() => setMode("reject")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white py-2 text-[12.5px] font-medium text-rose-700 hover:bg-rose-50"
          >
            <XCircle size={14} /> Request changes
          </button>
        </div>
      ) : (
        <div>
          <textarea
            disabled={busy}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={3}
            placeholder={mode === "approve" ? "Optional approval note…" : "Required: explain what needs to change…"}
            className={`mb-2 w-full resize-none rounded-lg border px-3 py-2 text-[12.5px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none ${
              mode === "reject" ? "border-rose-200 focus:border-rose-400" : "border-neutral-200 focus:border-neutral-400"
            }`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={decide}
              disabled={mode === "approve" ? approvalDisabled : busy}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium text-white disabled:opacity-40 ${
                mode === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : mode === "approve" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {mode === "approve" ? "Confirm approval" : "Send back for changes"}
            </button>
            <button
              disabled={busy}
              onClick={() => { setMode("idle"); setFeedback(""); }}
              className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
