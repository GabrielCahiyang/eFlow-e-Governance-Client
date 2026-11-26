import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useToast } from "../../../components/ui/Toast";
import { readableUiError } from "../../../shared/userFacingError";
import { subscribeWorkChanges } from "../../../shared/workChanges";
import { subscribeCashRequestChanges } from "../services/cashRequestUpdates";
import {
  fetchWorkFinancialClearance,
  readSavedClearanceRequest,
  saveClearanceCommand,
  verifySavedCompletion,
  type SavedClearanceRequest,
  type WorkFinancialClearance,
} from "../services/workFinancialClearanceService";

export function WorkFinancialClearancePanel({
  root,
  node,
  readOnly = false,
  leadName,
  onSaved,
  onStatusChange,
}: {
  root: string;
  node?: string | null;
  readOnly?: boolean;
  leadName?: string | null;
  onSaved?: () => void | Promise<void>;
  onStatusChange?: (
    status:
      | {
          workAccepted: boolean;
          completionSubmitted?: boolean;
          cashOutstanding: boolean;
          completed: boolean;
        }
      | undefined,
  ) => void;
}) {
  const { user } = useAuth();
  const actor = user?.id || "";
  const { toast } = useToast();
  const confirmation = useConfirmation();
  const normalizedNode = node ?? null;
  const scope = `finalize-clearance:${root}:${normalizedNode ?? "task"}`;

  const [data, setData] = useState<WorkFinancialClearance>();
  const [initialLoading, setInitialLoading] = useState(Boolean(actor));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<SavedClearanceRequest>();
  const [recoveryError, setRecoveryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const version = useRef(0);
  const hasLoadedOnce = useRef(false);
  const inFlight = useRef(false);

  // Reset only when switching to a different task/subtask target
  useEffect(() => {
    hasLoadedOnce.current = false;
    setData(undefined);
    setError("");
    setInitialLoading(Boolean(actor));
  }, [actor, root, normalizedNode]);

  const loadRecovery = useCallback(() => {
    if (!actor) {
      setRecovery(undefined);
      setRecoveryError("");
      return;
    }
    try {
      setRecovery(
        verifySavedCompletion(
          readSavedClearanceRequest(actor, scope),
          root,
          normalizedNode,
        ),
      );
      setRecoveryError("");
    } catch (caught) {
      setRecovery(undefined);
      setRecoveryError(
        readableUiError(
          caught,
          "The saved completion could not be verified.",
          "read",
        ),
      );
    }
  }, [actor, normalizedNode, root, scope]);

  const refresh = useCallback(async () => {
    if (!actor) {
      setData(undefined);
      setInitialLoading(false);
      setRefreshing(false);
      setError("");
      return;
    }
    const run = ++version.current;
    if (!hasLoadedOnce.current) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const next = await fetchWorkFinancialClearance(root, normalizedNode);
      if (run === version.current) {
        hasLoadedOnce.current = true;
        setData(next);
        setError("");
      }
    } catch (caught) {
      if (run === version.current) {
        // Keep last verified snapshot if a background refresh fails transiently
        if (!hasLoadedOnce.current) {
          setData(undefined);
        }
        setError(
          readableUiError(
            caught,
            "Financial clearance could not be verified. Refresh before continuing.",
            "read",
          ),
        );
      }
    } finally {
      if (run === version.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [actor, normalizedNode, root]);

  useEffect(() => {
    loadRecovery();
    void refresh();
    if (!actor || typeof window === "undefined") {
      return () => {
        version.current++;
      };
    }
    const reload = () => {
      loadRecovery();
      void refresh();
    };
    window.addEventListener("focus", reload);
    window.addEventListener("eflow:work-updated", reload);
    window.addEventListener("eflow:finance-updated", reload);
    window.addEventListener("eflow:expenses-updated", reload);
    window.addEventListener("eflow:subtask-budget-changed", reload);
    const unsubscribe = subscribeWorkChanges(reload, root);
    const unsubscribeCash = subscribeCashRequestChanges(root, reload);
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") reload();
    }, 60_000);
    return () => {
      version.current++;
      window.removeEventListener("focus", reload);
      window.removeEventListener("eflow:work-updated", reload);
      window.removeEventListener("eflow:finance-updated", reload);
      window.removeEventListener("eflow:expenses-updated", reload);
      window.removeEventListener("eflow:subtask-budget-changed", reload);
      unsubscribe();
      unsubscribeCash();
      window.clearInterval(interval);
    };
  }, [actor, loadRecovery, refresh, root]);

  // Keep previous data mounted across background refreshes so the panel NEVER flickers!
  const current = data;
  const isSubmittedOrAccepted = Boolean(
    current?.completionSubmitted || current?.workAccepted,
  );

  useEffect(() => {
    if (initialLoading && !current) return;
    onStatusChange?.(
      current
        ? {
            workAccepted: Boolean(current.workAccepted || current.completionSubmitted),
            completionSubmitted: Boolean(
              current.completionSubmitted || current.workAccepted,
            ),
            cashOutstanding: current.cashOutstanding,
            completed: current.completed,
          }
        : undefined,
    );
  }, [
    initialLoading,
    current?.workAccepted,
    current?.completionSubmitted,
    current?.cashOutstanding,
    current?.completed,
    onStatusChange,
  ]);

  if (!error && !recoveryError && !isSubmittedOrAccepted && !recovery) {
    return null;
  }

  const finalize = async () => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    setBusy(true);
    setActionError("");
    try {
      if (!actor) throw new Error("Sign in again.");
      const fresh = await fetchWorkFinancialClearance(root, normalizedNode);
      if (!recovery && fresh.completed) {
        setData(fresh);
        await Promise.resolve(onSaved?.());
        return;
      }
      if (!recovery && !fresh.canFinalize) {
        throw new Error(
          "Financial clearance or your authority changed. Refresh this work.",
        );
      }
      if (
        !recovery &&
        !(await confirmation.confirm({
          title: "Finalize completed work?",
          description:
            "Work approval and Accounting financial clearance are both confirmed. Unused funding returns to this project.",
          actionLabel: "Finalize completion",
          tone: "approve",
        }))
      ) {
        return;
      }
      await saveClearanceCommand<WorkFinancialClearance>(
        actor,
        scope,
        "finalize_cleared_work",
        recovery ?? {
          id: crypto.randomUUID(),
          args: { p_root: root, p_node: normalizedNode },
        },
        (value): value is WorkFinancialClearance =>
          !!value &&
          typeof value === "object" &&
          "rootId" in value &&
          value.rootId === root &&
          "nodeId" in value &&
          value.nodeId === normalizedNode &&
          "completed" in value &&
          value.completed === true,
        !!recovery,
      );
      toast("Work completed.", "success");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("eflow:work-updated", { detail: { taskId: root } }),
        );
        window.dispatchEvent(new Event("eflow:project-setup"));
        window.dispatchEvent(new Event("eflow:finance-updated"));
        window.dispatchEvent(new Event("eflow:expenses-updated"));
      }
      loadRecovery();
      await Promise.all([refresh(), Promise.resolve(onSaved?.())]);
    } catch (caught) {
      loadRecovery();
      setActionError(
        readableUiError(caught, "Could not finalize this work.", "write"),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const workApproved = Boolean(
    current?.completed ||
      current?.workAccepted ||
      current?.workReviewState === "approved",
  );
  const financeState = current?.completed
    ? "cleared"
    : current?.financeState ??
      (current?.cashOutstanding ? "awaiting_receipts" : "cleared");

  const headerBadge = current?.completed
    ? { label: "Completed", className: "border-emerald-200 bg-emerald-50 text-emerald-900" }
    : financeState === "changes_requested"
      ? { label: "Receipt corrections needed", className: "border-rose-200 bg-rose-50 text-rose-800" }
      : financeState === "pending_accounting"
        ? { label: "Awaiting Accounting", className: "border-amber-200 bg-amber-50 text-amber-900" }
        : financeState === "awaiting_receipts"
          ? { label: "Submit receipts", className: "border-amber-200 bg-amber-50 text-amber-900" }
          : !workApproved
            ? { label: "Awaiting work approval", className: "border-amber-200 bg-amber-50 text-amber-900" }
            : { label: "Cleared", className: "border-emerald-200 bg-emerald-50 text-emerald-900" };

  const summaryMessage = current?.completed
    ? "Work approval and Accounting financial clearance are both complete."
    : current?.financeMessage
      ? current.financeMessage
      : current?.cashOutstanding
        ? normalizedNode
          ? "Submit receipts in Funding details so Accounting can review and approve this subtask's spending."
          : "Submit receipts and any unused cash return in Task funding so Accounting can settle the released cash."
        : !workApproved
          ? normalizedNode
            ? "Receipts are cleared — waiting for Task Lead work approval to auto-complete."
            : "Financial settlement is complete — waiting for Project Reviewer approval to auto-complete."
          : leadName
            ? `All approvals complete. ${leadName} can finalize if not yet auto-completed.`
            : "All approvals complete.";

  return (
    <section
      aria-label="Financial clearance"
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      {confirmation.dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Completion &amp; financial clearance
          </h3>
          {current && (
            <span
              className={`rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold ${headerBadge.className}`}
            >
              {headerBadge.label}
            </span>
          )}
        </div>
        {error && (
          <button
            type="button"
            disabled={initialLoading || refreshing || busy}
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
          >
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>

      {/* Dual-Gate Approval Checklist */}
      {current && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              workApproved
                ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                : "border-amber-200 bg-amber-50/70 text-amber-950"
            }`}
          >
            {workApproved ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-700" />
            ) : (
              <Clock3 size={14} className="mt-0.5 shrink-0 text-amber-700" />
            )}
            <div className="min-w-0">
              <div className="font-semibold">
                {normalizedNode ? "1. Task Lead approval" : "1. Reviewer approval"}
              </div>
              <div className="text-[11px] opacity-85">
                {workApproved ? "Approved" : "Pending review"}
              </div>
            </div>
          </div>

          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              financeState === "cleared"
                ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                : financeState === "changes_requested"
                  ? "border-rose-200 bg-rose-50/70 text-rose-950"
                  : "border-amber-200 bg-amber-50/70 text-amber-950"
            }`}
          >
            {financeState === "cleared" ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-700" />
            ) : financeState === "changes_requested" ? (
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-700" />
            ) : (
              <Clock3 size={14} className="mt-0.5 shrink-0 text-amber-700" />
            )}
            <div className="min-w-0">
              <div className="font-semibold">2. Accounting settlement</div>
              <div className="text-[11px] opacity-85">
                {financeState === "cleared"
                  ? "Cleared"
                  : financeState === "pending_accounting"
                    ? "Pending Accounting approval"
                    : financeState === "changes_requested"
                      ? "Corrections requested"
                      : "Submit receipts in Funding details"}
              </div>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {actionError}
        </p>
      )}

      {error && !current ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            current?.completed || (!current?.cashOutstanding && workApproved)
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : financeState === "changes_requested"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {summaryMessage}
          {!current?.completed && current?.cashOutstanding && (
            <span className="mt-1 block font-medium opacity-90">
              Once both approvals are complete, this {normalizedNode ? "subtask" : "task"} is automatically marked as completed.
            </span>
          )}
        </p>
      )}

      {recoveryError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-1"
        >
          <p>{recoveryError}</p>
          <button
            type="button"
            className="underline font-medium"
            onClick={loadRecovery}
          >
            Retry saved completion check
          </button>
        </div>
      )}

      {!readOnly && ((current?.canFinalize && !current?.completed) || recovery) && (
        <button
          type="button"
          disabled={initialLoading || !!recoveryError || busy}
          onClick={() => void finalize()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--eflow-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--eflow-primary-hover)] disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          {busy
            ? "Saving…"
            : recovery
              ? "Check saved completion"
              : "Finalize completion"}
        </button>
      )}
    </section>
  );
}
