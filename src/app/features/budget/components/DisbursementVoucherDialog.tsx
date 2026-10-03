import { useRef, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import * as m from "motion/react-m";
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { BxsBox } from "../../../components/ui/boxicons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { PettyCashRelease, PettyCashRequest } from "../types";
import { markPettyCashReleased, overrideAccountingPettyCashReleaseSchedule } from "../services/budgetService";
import { motionTransition } from "../../../shared/motion/motionTokens";
import { peso } from "./budgetUi";
import { useAuth } from "../../../contexts/AuthContext";

/** Derives a human-readable, deterministic voucher code from existing IDs — no DB column needed. */
export function buildDvCode(release: PettyCashRelease, request: PettyCashRequest | undefined, fiscalYear: number) {
  if (release.voucherNumber) return release.voucherNumber;
  const year = fiscalYear;
  const num  = String(request?.requestNumber ?? 0).padStart(5, "0");
  const tail = release.id.replace(/-/g, "").slice(-4).toUpperCase();
  return `DV-${year}-${num}-${tail}`;
}

export function DisbursementVoucherDialog({
  release,
  request,
  fiscalYear,
  onClose,
  onReleased,
}: {
  release: PettyCashRelease;
  request?: PettyCashRequest;
  fiscalYear: number;
  onClose: () => void;
  onReleased: () => Promise<void>;
}) {
  const { userProfile, can } = useAuth();
  const dvCode    = buildDvCode(release, request, fiscalYear);
  const [checked, setChecked]   = useState(false);
  const [busy,    setBusy]      = useState(false);
  const [copied,  setCopied]    = useState(false);
  const [error,   setError]     = useState("");
  const [method, setMethod] = useState<"cash" | "cheque">(release.releaseMethod || "cash");
  const [chequeNumber, setChequeNumber] = useState(release.chequeNumber || "");
  const [overrideSchedule, setOverrideSchedule] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const inFlight  = useRef(false);
  const canOverrideSchedule = userProfile?.role === "accounting_staff" && can("accounting.release_cash");
  const scheduledEarly = release.scheduledDate > new Date().toISOString().slice(0, 10);

  const handleCopy = () => {
    void navigator.clipboard.writeText(dvCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const confirm = async () => {
    if (inFlight.current || !checked || !canOverrideSchedule) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (overrideSchedule) await overrideAccountingPettyCashReleaseSchedule({ releaseId: release.id, reason: overrideReason, method, chequeNumber });
      else await markPettyCashReleased(release.id, { method, chequeNumber });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The release could not be recorded.");
      inFlight.current = false;
      setBusy(false);
      return;
    }
    onClose();
    await onReleased();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !inFlight.current) onClose(); }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto bg-white sm:max-w-[620px]"
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        onInteractOutside={(e) => { if (busy) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BxsBox size={18} className="text-emerald-700" />
            Disbursement Voucher
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-neutral-500">
            Official cash release authorization and physical handover record.
          </DialogDescription>
        </DialogHeader>

        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition.productive}
          className="space-y-4 py-1"
        >
          {/* Vibe AttentionBox */}
          <AttentionBox
            type="positive"
            title="Physical Handover Record"
            text="Provide this stable voucher number to the recipient. eFlow validates it on the server before recording their acknowledgement."
          />

          {/* Voucher code display */}
          <div className="flex flex-col gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Voucher number</p>
              <span className="mt-1 block truncate font-mono text-[18px] font-bold tracking-[0.08em] text-emerald-800 sm:text-xl">{dvCode}</span>
            </div>
            <Button
              kind="tertiary"
              size="small"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-700" /> : <Copy size={13} />}
              <span className="ml-1 text-[10.5px]">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>

          {/* Release details */}
          <div className="grid gap-x-5 gap-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-[11px] text-neutral-600 sm:grid-cols-2">
            <VoucherDetail label="Recipient" value={request?.cashRecipientName || request?.requesterName || "Assigned recipient"} />
            <VoucherDetail label="Amount" value={peso.format(release.amount)} emphasis />
            <VoucherDetail label="For" value={request?.subtaskTitle || request?.taskTitle || "Funded work"} />
            <VoucherDetail label="Request" value={`PC-${String(request?.requestNumber ?? 0).padStart(5, "0")}`} />
          </div>

          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Release record</p>
            <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] text-neutral-600">
              Release method
              <select aria-label="Release method" value={method} onChange={(event) => setMethod(event.target.value as "cash" | "cheque")} disabled={busy} className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[10.5px]">
                <option value="cash">Cash handover</option>
                <option value="cheque">Cheque issuance</option>
              </select>
            </label>
              {method === "cheque" && <label className="text-[10px] text-neutral-600">Cheque number<input aria-label="Cheque number" value={chequeNumber} onChange={(event) => setChequeNumber(event.target.value)} disabled={busy} className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[10.5px]" /></label>}
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-[11.5px] leading-snug text-neutral-800">
                I confirm the {method === "cheque" ? "cheque has been physically issued to" : "cash has been physically handed over to"} the recipient.
              </span>
            </label>
          </section>

          {scheduledEarly && canOverrideSchedule && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <label className="flex cursor-pointer items-start gap-2 text-[11.5px] text-amber-950">
                <input
                  aria-label="Override release schedule"
                  type="checkbox"
                  checked={overrideSchedule}
                  onChange={(event) => setOverrideSchedule(event.target.checked)}
                  disabled={busy}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400"
                />
                <span><strong>Override schedule</strong><br />Release this tranche before {release.scheduledDate}. This does not bypass funding or the daily release limit.</span>
              </label>
              {overrideSchedule && (
                <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 border-t border-amber-200 pt-3">
                  <label className="block text-[10.5px] font-medium text-amber-950">
                    <span className="flex items-center gap-1"><AlertTriangle size={12} /> Override reason</span>
                    <textarea aria-label="Schedule override reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} disabled={busy} rows={3} maxLength={1000} placeholder="Explain why the cash must be handed over before its scheduled date…" className="mt-1.5 w-full resize-none rounded-lg border border-amber-300 bg-white p-2.5 text-[11px] text-neutral-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
                  </label>
                  <p className="mt-1 text-[9.5px] text-amber-800">At least 10 characters. Your identity, reason, original date, and release time are recorded in the financial audit trail.</p>
                </m.div>
              )}
            </div>
          )}

          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-[11px] text-rose-700">{error}</p>}
        </m.div>

        <DialogFooter className="flex items-center justify-end gap-2">
          <Button
            kind="secondary"
            size="small"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            kind="primary"
            color="positive"
            size="small"
            disabled={busy || !canOverrideSchedule || !checked || (method === "cheque" && !chequeNumber.trim()) || (overrideSchedule && overrideReason.trim().length < 10)}
            loading={busy}
            onClick={() => { void confirm(); }}
          >
            Confirm &amp; Record Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoucherDetail({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</p><p className={`mt-1 truncate text-[11.5px] ${emphasis ? "font-semibold text-emerald-700" : "font-medium text-neutral-800"}`}>{value}</p></div>;
}
