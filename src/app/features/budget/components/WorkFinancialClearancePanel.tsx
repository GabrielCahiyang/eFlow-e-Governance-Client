import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useToast } from "../../../components/ui/Toast";
import { readableUiError } from "../../../shared/userFacingError";
import { subscribeWorkChanges } from "../../../shared/workChanges";
import { subscribeCashRequestChanges } from '../services/cashRequestUpdates';
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
}: {
  root: string;
  node?: string | null;
  readOnly?: boolean;
  leadName?: string | null;
  onSaved?: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const actor = user?.id || "";
  const { toast } = useToast();
  const confirmation = useConfirmation();
  const normalizedNode = node ?? null;
  const scope = `finalize-clearance:${root}:${normalizedNode ?? "task"}`;

  const [data, setData] = useState<WorkFinancialClearance>();
  const [loading, setLoading] = useState(Boolean(actor));
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<SavedClearanceRequest>();
  const [recoveryError, setRecoveryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const version = useRef(0);
  const inFlight = useRef(false);

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
      setLoading(false);
      setError("");
      return;
    }
    const run = ++version.current;
    setLoading(true);
    try {
      const next = await fetchWorkFinancialClearance(root, normalizedNode);
      if (run === version.current) {
        setData(next);
        setError("");
      }
    } catch (caught) {
      if (run === version.current) {
        setData(undefined);
        setError(
          readableUiError(
            caught,
            "Financial clearance could not be verified. Refresh before continuing.",
            "read",
          ),
        );
      }
    } finally {
      if (run === version.current) setLoading(false);
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
    const unsubscribe = subscribeWorkChanges(reload, root);
    const unsubscribeCash = subscribeCashRequestChanges(root, reload);
    const interval = window.setInterval(() => { if (document.visibilityState !== 'hidden') reload(); }, 60_000);
    return () => {
      version.current++;
      window.removeEventListener("focus", reload);
      window.removeEventListener("eflow:work-updated", reload);
      window.removeEventListener("eflow:finance-updated", reload);
      window.removeEventListener("eflow:expenses-updated", reload);
      unsubscribe();
      unsubscribeCash();
      window.clearInterval(interval);
    };
  }, [actor, loadRecovery, refresh, root]);

  const current = error || loading ? undefined : data;
  if (!error && !recoveryError && !current?.workAccepted && !recovery) {
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
      if (!recovery && !fresh.canFinalize) {
        throw new Error(
          "Financial clearance or your authority changed. Refresh this work.",
        );
      }
      if (
        !recovery &&
        !(await confirmation.confirm({
          title: "Mark this work complete?",
          description:
            "Work acceptance and financial clearance will be checked again. Unused funding stays with this project.",
          actionLabel: "Mark as complete",
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

  return (
    <section
      aria-label="Financial clearance"
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      {confirmation.dialog}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Financial clearance
        </h3>
        {error && (
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
          >
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {actionError}
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-xs ${
            current?.cashOutstanding
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {current?.completed
            ? "Completion confirmed."
            : current?.cashOutstanding
              ? "Work accepted. Required receipts, cash returns and settlement must be cleared before completion."
              : !readOnly && (current?.canFinalize || recovery)
                ? "Work accepted and financial clearance confirmed. Click Mark as complete to finalize this work."
                : leadName
                  ? `Work accepted and financial clearance confirmed. Waiting for ${leadName} (the authorized lead) to mark this work complete.`
                  : "Work accepted and financial clearance confirmed. The authorized lead can mark this work complete."}
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

      {!readOnly && (current?.canFinalize || recovery) && (
        <button
          type="button"
          disabled={loading || !!error || !!recoveryError || busy}
          onClick={() => void finalize()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          {busy
            ? "Saving…"
            : recovery
              ? "Check saved completion"
              : "Mark as complete"}
        </button>
      )}
    </section>
  );
}
