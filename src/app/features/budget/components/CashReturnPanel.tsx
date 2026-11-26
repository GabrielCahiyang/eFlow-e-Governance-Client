import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { useAuth } from "../../../contexts/AuthContext";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useToast } from "../../../components/ui/Toast";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { textLengthError } from "../../../shared/inputLimits";
import { readableUiError } from "../../../shared/userFacingError";
import { subscribeWorkChanges } from "../../../shared/workChanges";
import { peso } from "./budgetUi";
import {
  fetchCashReturnClearance,
  readSavedClearanceRequest,
  saveClearanceCommand,
  verifySavedReturn,
  type CashReturnClearance,
  type SavedClearanceRequest,
} from "../services/workFinancialClearanceService";

export function CashReturnPanel({
  liquidationId,
  rootId,
  version,
  amount,
  readOnly = false,
  onSaved,
}: {
  liquidationId: string;
  rootId?: string;
  version: number;
  amount: number;
  readOnly?: boolean;
  onSaved: () => Promise<void>;
}) {
  const { user, userProfile } = useAuth();
  const actor = user?.id || userProfile?.id || "";
  const { toast } = useToast();
  const confirmation = useConfirmation();
  const scope = `cash-return:${liquidationId}:${version}`;

  const [data, setData] = useState<CashReturnClearance>();
  const [loading, setLoading] = useState(Boolean(actor && amount > 0));
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<SavedClearanceRequest>();
  const [recoveryError, setRecoveryError] = useState("");
  const [reference, setReference] = useState("");
  const [referenceTouched, setReferenceTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const referenceId = useId();
  const runVersion = useRef(0);
  const inFlight = useRef(false);

  const loadRecovery = useCallback(() => {
    if (!actor || !(amount > 0)) {
      setRecovery(undefined);
      setRecoveryError("");
      return;
    }
    try {
      setRecovery(
        verifySavedReturn(
          readSavedClearanceRequest(actor, scope),
          liquidationId,
          version,
          amount,
        ),
      );
      setRecoveryError("");
    } catch (caught) {
      setRecovery(undefined);
      setRecoveryError(
        readableUiError(
          caught,
          "The saved cash-return action could not be verified.",
          "read",
        ),
      );
    }
  }, [actor, amount, liquidationId, scope, version]);

  const refresh = useCallback(async () => {
    if (!actor || !(amount > 0)) {
      setData(undefined);
      setLoading(false);
      setError("");
      return;
    }
    const run = ++runVersion.current;
    setLoading(true);
    try {
      const next = await fetchCashReturnClearance(liquidationId);
      if (run === runVersion.current) {
        setData(next);
        setError("");
      }
    } catch (caught) {
      if (run === runVersion.current) {
        setData(undefined);
        setError(
          readableUiError(
            caught,
            "The cash return could not be verified. Refresh before deciding.",
            "read",
          ),
        );
      }
    } finally {
      if (run === runVersion.current) setLoading(false);
    }
  }, [actor, amount, liquidationId]);

  useEffect(() => {
    loadRecovery();
    void refresh();
    if (!actor || !(amount > 0) || typeof window === "undefined") {
      return () => {
        runVersion.current++;
      };
    }
    const reload = () => {
      loadRecovery();
      void refresh();
    };
    window.addEventListener("focus", reload);
    window.addEventListener("eflow:finance-updated", reload);
    window.addEventListener("eflow:expenses-updated", reload);
    const unsubscribe = rootId
      ? subscribeWorkChanges(reload, rootId)
      : undefined;
    return () => {
      runVersion.current++;
      window.removeEventListener("focus", reload);
      window.removeEventListener("eflow:finance-updated", reload);
      window.removeEventListener("eflow:expenses-updated", reload);
      unsubscribe?.();
    };
  }, [actor, amount, loadRecovery, refresh, rootId]);

  if (!(amount > 0)) return null;

  const current = loading || error ? undefined : data;
  const permitted =
    !!current &&
    current.packageVersion === version &&
    current.amount === amount;

  const send = async (kind: "acknowledge" | "approve") => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    setBusy(true);
    setActionError("");
    try {
      if (!actor) throw new Error("Sign in again.");
      const pending = recovery;
      const fresh = await fetchCashReturnClearance(liquidationId);
      if (
        !pending &&
        (fresh.packageVersion !== version ||
          fresh.amount !== amount ||
          !(kind === "acknowledge" ? fresh.canAcknowledge : fresh.canApprove))
      ) {
        throw new Error(
          "The return or your authority changed. Refresh the receipt package.",
        );
      }
      if (!pending && !reference.trim()) {
        setReferenceTouched(true);
        throw new Error("Enter the receiving reference or approval note.");
      }
      if (
        !pending &&
        !(await confirmation.confirm({
          title:
            kind === "acknowledge"
              ? "Acknowledge cash received?"
              : "Approve this cash return?",
          description:
            kind === "acknowledge"
              ? `Confirm you physically received ${peso.format(amount)}.`
              : `Confirm the ${peso.format(amount)} cash return verification.`,
          actionLabel:
            kind === "acknowledge" ? "Acknowledge receipt" : "Approve return",
          tone: "approve",
        }))
      ) {
        return;
      }
      const key = pending?.id ?? crypto.randomUUID();
      const expected = pending?.args.p_action ?? kind;
      await saveClearanceCommand<CashReturnClearance>(
        actor,
        scope,
        "record_cash_return",
        pending ?? {
          id: key,
          args: {
            p_liquidation: liquidationId,
            p_version: version,
            p_action: kind,
            p_amount: amount,
            p_reference: reference.trim(),
            p_key: key,
          },
        },
        (value): value is CashReturnClearance =>
          !!value &&
          typeof value === "object" &&
          "liquidationId" in value &&
          value.liquidationId === liquidationId &&
          "packageVersion" in value &&
          value.packageVersion === version &&
          (expected === "acknowledge"
            ? "received" in value && value.received === true
            : "approved" in value && value.approved === true),
        !!pending,
      );
      setReference("");
      setReferenceTouched(false);
      toast(
        expected === "acknowledge"
          ? "Cash return verified by Accounting."
          : "Cash return verified.",
        "success",
      );
      loadRecovery();
      await Promise.all([refresh(), onSaved()]);
    } catch (caught) {
      loadRecovery();
      setActionError(
        readableUiError(caught, "Could not record cash return.", "write"),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Unused cash return"
      className="mt-3 rounded-xl border border-border bg-muted/25 p-3.5 space-y-2.5 text-xs"
    >
      {confirmation.dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-foreground">Unused cash return</h4>
        <span className="font-semibold tabular-nums text-foreground">
          Amount to return: {peso.format(amount)}
        </span>
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
        >
          {actionError}
        </p>
      )}

      {loading && !data ? (
        <p role="status" className="text-muted-foreground">
          Checking cash return…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
        >
          <span>{error}</span>
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-background px-2 py-1 text-xs font-medium"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 ${
            current?.received || current?.approved
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-blue-200 bg-blue-50/70 text-blue-900"
          }`}
        >
          {current?.received || current?.approved
            ? `Returned cash (${peso.format(amount)}) verified by Accounting.`
            : `Accounting verifies physical receipt of the ${peso.format(amount)} unused cash return and records the receiving OR # during settlement.`}
        </p>
      )}

      {!!current?.reference && (
        <p className="text-muted-foreground">
          <strong className="text-foreground">Receiving reference: </strong>
          {current.reference}
        </p>
      )}

      {recoveryError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive space-y-1"
        >
          <p>{recoveryError}</p>
          <button
            type="button"
            className="underline font-medium"
            onClick={loadRecovery}
          >
            Retry saved return check
          </button>
        </div>
      )}

      {!readOnly &&
        permitted &&
        current.canAcknowledge &&
        !recovery &&
        !recoveryError && (() => {
          const referenceLabel = "Receiving reference";
          const referenceError = textLengthError(reference, referenceLabel, {
            required: true,
            max: 2000,
          });
          const visibleReferenceError = referenceTouched ? referenceError : "";
          const actionDisabled = busy || Boolean(referenceError);

          return (
            <div className="space-y-2 pt-1">
              <div className="block font-medium text-foreground">
                <label htmlFor={referenceId} className="block">
                  {referenceLabel}{" "}
                  <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                    *
                  </span>
                </label>
                <BoundedTextarea
                  id={referenceId}
                  required
                  aria-required="true"
                  rows={2}
                  maxLength={2000}
                  disabled={busy}
                  value={reference}
                  error={visibleReferenceError || undefined}
                  onBlur={() => setReferenceTouched(true)}
                  onChange={(event) => {
                    setReferenceTouched(true);
                    setReference(event.target.value);
                  }}
                  placeholder="Enter the official receiving OR # or receipt reference"
                  className="mt-1 block w-full rounded-lg border border-border bg-background p-2 text-xs font-normal text-foreground"
                />
              </div>
              {current.canAcknowledge && (
                <ActionBlockerGroup
                  actionLabel="Acknowledge cash received"
                  blockers={actionDisabled ? referenceError : []}
                  busy={busy}
                  size="sm"
                >
                  <WorkspaceTooltip
                    content="Confirms you physically received the returned cash."
                    disabled={actionDisabled}
                  >
                    <button
                      type="button"
                      disabled={actionDisabled}
                      onClick={() => void send("acknowledge")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} />
                      {busy ? "Saving…" : "Acknowledge cash received"}
                    </button>
                  </WorkspaceTooltip>
                </ActionBlockerGroup>
              )}
            </div>
          );
        })()}

      {!readOnly && !!recovery && (() => {
        const checkBusy = loading || busy;
        const checkDisabled = checkBusy || !!error || !!recoveryError;
        return (
          <ActionBlockerGroup
            actionLabel="Check saved return action"
            blockers={checkDisabled ? [error, recoveryError] : []}
            busy={checkBusy}
            size="sm"
          >
            <WorkspaceTooltip
              content="Verify whether the earlier cash return action was saved."
              disabled={checkDisabled}
            >
              <button
                type="button"
                disabled={checkDisabled}
                onClick={() =>
                  void send(
                    recovery.args.p_action === "approve" ? "approve" : "acknowledge",
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
              >
                <RefreshCw size={12} /> Check saved return action
              </button>
            </WorkspaceTooltip>
          </ActionBlockerGroup>
        );
      })()}
    </section>
  );
}
