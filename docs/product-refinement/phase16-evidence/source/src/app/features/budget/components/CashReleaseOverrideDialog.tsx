import { useId, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { PettyCashRelease, PettyCashRequest } from "../types";
import { overridePettyCashReleaseSchedule } from "../services/budgetService";
import { peso } from "./budgetUi";

import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { fetchDepartmentBudgetBundle } from "../services/budgetService";
import {
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialErrorMessage,
} from "../financialReceipts";
export function CashReleaseOverrideDialog({
  release,
  request,
  dailyLimit,
  fiscalYear = new Date().getFullYear(),
  onClose,
  onReleased,
}: {
  release: PettyCashRelease;
  request?: PettyCashRequest;
  dailyLimit?: number;
  fiscalYear?: number;
  onClose: () => void;
  onReleased: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const reasonId = useId();
  const draft = useExplicitDraft(
    "Release handover",
    !financialOutcome(`release:${release.id}`) && Boolean(reason.trim()),
    busy,
    () => {},
  );
  const close = () => {
    void requestNavigation(onClose);
  };
  const key = `release:${release.id}`;
  const [receipt, setReceipt] = useState("");
  const verify = async () => {
    if (inFlight.current || !request) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const current = await fetchDepartmentBudgetBundle(
        release.orgId,
        fiscalYear,
      );
      const row = current.releases.find((item) => item.id === release.id);
      if (row?.status === "released") {
        recordFinancialOutcome(key, "saved");
        setReceipt(
          `Release ${row.voucherNumber || row.id} confirmed. Do not repeat the handover.`,
        );
        await onReleased();
      } else
        setError(
          "The release is pending or unavailable. Its outcome is not confirmed. Review financial history before another handover.",
        );
    } catch (caught) {
      setError(financialErrorMessage(caught));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (inFlight.current || reason.trim().length < 10) return;
    if (financialOutcome(key)) {
      setError(
        "A previous release has a saved or uncertain result. Verify financial records before continuing.",
      );
      return;
    }
    inFlight.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setError("");
    try {
      await overridePettyCashReleaseSchedule(release.id, reason.trim());
    } catch (caught) {
      if (financialFailureIsUncertain(caught))
        recordFinancialOutcome(key, "uncertain");
      setError(
        financialErrorMessage(caught) +
          (financialOutcome(key) === "uncertain"
            ? " Outcome uncertain. Verify before repeating a handover."
            : " Your entries are retained."),
      );
      inFlight.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
      return;
    }
    // A refresh failure after commit must not invite a duplicate release.
    recordFinancialOutcome(key, "saved");
    draft.markClean();
    setReceipt("Release recorded. Refreshing financial records.");
    try {
      await onReleased();
      onClose();
    } catch (caught) {
      setError(
        financialErrorMessage(caught) +
          " Release already recorded. Do not repeat it.",
      );
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !inFlight.current) close();
      }}
    >
      <DialogContent
        className="bg-white sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        {receipt && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">
            {receipt}
          </p>
        )}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={18} className="text-amber-600" /> Confirm
            schedule override?
          </DialogTitle>
          <DialogDescription>
            Record this approved cash tranche as released now, even if the
            scheduled date has not arrived.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>
            PC-{String(request?.requestNumber || 0).padStart(5, "0")} ·{" "}
            {peso.format(release.amount)}
          </strong>
          <p className="mt-1">
            {[request?.taskTitle, request?.subtaskTitle]
              .filter(Boolean)
              .join(" → ") || "Funded work"}
          </p>
          <p className="mt-1">
            Recipient:{" "}
            {request?.cashRecipientName ||
              request?.requesterName ||
              "Assigned recipient"}
          </p>
          <p className="mt-1">Original schedule: {release.scheduledDate}</p>
        </div>
        <p className="text-sm text-neutral-600">
          This overrides the date only—not the{" "}
          {dailyLimit ? `${peso.format(dailyLimit)} ` : ""}daily ceiling,
          funding approval, or receipt requirements. Today's scheduled releases
          keep their reserved room. Your identity, reason, and release time will
          be audited.
        </p>
        <div>
          <label
            htmlFor={reasonId}
            className="text-sm font-medium text-neutral-900"
          >
            Override reason
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy}
            maxLength={1000}
            rows={3}
            placeholder="Explain why this cash must be released before its scheduled date…"
            className="mt-1 w-full resize-none rounded-lg border border-neutral-300 p-2 text-sm disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-neutral-500">
            At least 10 characters. Confirm only when the cash is actually being
            handed over.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
        {financialOutcome(key) === "uncertain" && (
          <button
            type="button"
            className="rounded-lg border p-3 text-sm"
            disabled={busy}
            onClick={() => void verify()}
          >
            Verify release outcome
          </button>
        )}
        <DialogFooter>
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              busy ||
              Boolean(financialOutcome(key)) ||
              reason.trim().length < 10
            }
            onClick={() => {
              void confirm();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Confirm
            override & release
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
