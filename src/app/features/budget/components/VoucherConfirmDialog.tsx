import { readableUiError } from '../../../shared/userFacingError';
import { useRef, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import * as m from "motion/react-m";
import { CheckCircle2 } from "lucide-react";
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
import { acknowledgePettyCashRelease } from "../services/budgetService";
import { motionTransition } from "../../../shared/motion/motionTokens";
import { buildDvCode } from "./DisbursementVoucherDialog";
import { peso } from "./budgetUi";
import { formatFundingRequestCode } from "../selectors/cashWorkflowRules";

export function VoucherConfirmDialog({
  release,
  request,
  fiscalYear,
  onClose,
  onAcknowledged,
}: {
  release: PettyCashRelease;
  request?: PettyCashRequest;
  fiscalYear: number;
  onClose: () => void;
  onAcknowledged: () => Promise<void>;
}) {
  const expected   = buildDvCode(release, request, fiscalYear);
  const [input,    setInput]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");
  const inFlight   = useRef(false);

  const normalise = (s: string) => s.trim().toUpperCase();
  const matches   = normalise(input) === normalise(expected);

  const confirm = async () => {
    if (inFlight.current || !matches) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await acknowledgePettyCashRelease(release.id, expected);
    } catch (caught) {
      setError(readableUiError(caught, "Acknowledgement could not be recorded.", 'write'));
      inFlight.current = false;
      setBusy(false);
      return;
    }
    onClose();
    await onAcknowledged();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !inFlight.current) onClose(); }}>
      <DialogContent
        className="bg-white sm:max-w-md"
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        onInteractOutside={(e) => { if (busy) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BxsBox size={18} className="text-blue-600" />
            Confirm Cash Receipt
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-neutral-500">
            Acknowledge physical receipt of allocated petty cash funds.
          </DialogDescription>
        </DialogHeader>

        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition.productive}
          className="space-y-3.5 py-1"
        >
          <AttentionBox
            type="neutral"
            title="Voucher Verification"
            text="Enter the Disbursement Voucher number provided by the releasing officer to complete your receipt acknowledgement."
          />

          {/* Release details */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-600 space-y-1">
            <div><span className="font-medium text-neutral-800">Amount: </span>{peso.format(release.amount)}</div>
            <div><span className="font-medium text-neutral-800">For: </span>{request?.subtaskTitle || request?.taskTitle || "Funded work"}</div>
            <div><span className="font-medium text-neutral-800">Request: </span>{formatFundingRequestCode(request?.requestNumber)}</div>
          </div>

          {/* Voucher input */}
          <div>
            <label className="text-[11px] font-medium text-neutral-900">Voucher Number</label>
            <div className="relative mt-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder="DV-2026-00042-A3F1"
                className={`w-full rounded-xl border px-3 py-2 font-mono text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal disabled:opacity-50 transition ${
                  matches
                    ? "border-emerald-500 bg-emerald-50/40 text-emerald-900 focus:border-emerald-600 focus:outline-none"
                    : "border-neutral-300 focus:border-blue-500 focus:outline-none"
                }`}
                autoComplete="off"
                spellCheck={false}
              />
              {matches && (
                <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />
              )}
            </div>
            <p className="mt-1 text-[10px] text-neutral-400">Case-insensitive format: DV-YYYY-NNNNN-XXXX</p>
          </div>

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
            size="small"
            disabled={busy || !matches}
            loading={busy}
            onClick={() => { void confirm(); }}
          >
            Confirm Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
