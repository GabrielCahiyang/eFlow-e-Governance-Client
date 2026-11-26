import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Upload, X } from "lucide-react";
import { BoundedTextInput } from "../../../components/ui/BoundedInput";
import { Modal, ModalButton } from "../../../components/ui/Modal";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { useAuth } from "../../../contexts/AuthContext";
import { getPhilippineCalendarDate, historicalDateError } from "../../../shared/calendarDates";
import { attachmentError } from "../../../shared/fileValidation";
import { readableUiError } from "../../../shared/userFacingError";
import { toCents } from "../selectors/subtaskDistribution";
import {
  recordAssignmentReceipt,
  submitSubtaskCashClearance,
} from "../services/workCashAssignmentService";
import type { ReceiptItem, WorkCashAssignment } from "../types";
import { peso } from "./budgetUi";

const OFFICE_PETTY_MAX_RECEIPT = 5000;

export interface AssignmentReceiptDialogProps {
  assignment: WorkCashAssignment;
  workTitle: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
}

export function AssignmentReceiptDialog({
  assignment,
  workTitle,
  onSaved,
  onClose,
}: AssignmentReceiptDialogProps) {
  const { user } = useAuth();
  const actor = user?.id ?? "";
  const isOfficeCash = assignment.sourceKind === "office_petty_cash";
  const today = getPhilippineCalendarDate();
  const maxAllowed = isOfficeCash
    ? Math.min(assignment.unspentAmount, OFFICE_PETTY_MAX_RECEIPT)
    : assignment.unspentAmount;

  const [vendor, setVendor] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [allocationLineId, setAllocationLineId] = useState(
    assignment.fundingLines[0]?.allocationLineId || "",
  );
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("lot");
  const [file, setFile] = useState<File | undefined>();
  const canSubmitDirectlyToAccounting = Boolean(
    assignment.subtaskId || assignment.sourceKind === "office_petty_cash",
  );
  const [submitToAccountingNow, setSubmitToAccountingNow] = useState(
    canSubmitDirectlyToAccounting,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasFundingLines = !isOfficeCash && assignment.fundingLines.length > 0;

  const validationError = useMemo(() => {
    if (!vendor.trim()) return "Enter the vendor or payee name.";
    if (isOfficeCash && !receiptNumber.trim()) {
      return "Enter the OR / receipt number for office petty cash.";
    }
    const dateErr = historicalDateError(receiptDate, "Receipt date");
    if (dateErr) return dateErr;
    const trimmed = amount.trim();
    if (!trimmed || !/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
      return "Enter a valid receipt amount up to two decimal places.";
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) {
      return "Enter a receipt amount greater than ₱0.00.";
    }
    if (isOfficeCash && toCents(num) > toCents(OFFICE_PETTY_MAX_RECEIPT)) {
      return `Office petty cash receipts cannot exceed ${peso.format(OFFICE_PETTY_MAX_RECEIPT)} per receipt.`;
    }
    if (toCents(num) > toCents(assignment.unspentAmount)) {
      return `Receipt exceeds the ${peso.format(assignment.unspentAmount)} remaining on this assignment.`;
    }
    if (!description.trim()) return "Describe what was purchased.";
    if (hasFundingLines && !allocationLineId) {
      return "Choose the approved funding account for this expense.";
    }
    if (!file) return "Attach a receipt photo (JPG, PNG, WebP) or PDF.";
    const fileErr = attachmentError([file], {
      extensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    });
    if (fileErr) return fileErr;
    return "";
  }, [
    vendor,
    isOfficeCash,
    receiptNumber,
    receiptDate,
    amount,
    assignment.unspentAmount,
    description,
    hasFundingLines,
    allocationLineId,
    file,
  ]);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy || !actor) return;
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!file) return;

    const numericAmount = Math.round(Number(amount) * 100) / 100;
    const parsedQty = Number(quantity);
    const safeQty = Number.isFinite(parsedQty) && parsedQty > 0 ? Math.round(parsedQty * 1000) / 1000 : 1;

    const items: ReceiptItem[] | undefined = hasFundingLines && allocationLineId
      ? [
          {
            id: crypto.randomUUID(),
            allocationLineId,
            quantity: safeQty,
            unit: unit.trim() || "lot",
            particular: description.trim(),
            purpose: `${workTitle} — ${description.trim()}`.slice(0, 200),
            amount: numericAmount,
          },
        ]
      : undefined;

    setBusy(true);
    setError("");
    try {
      await recordAssignmentReceipt({
        assignment,
        actor,
        vendor: vendor.trim(),
        receiptNumber: receiptNumber.trim() || undefined,
        receiptDate,
        description: description.trim(),
        amount: numericAmount,
        items,
        file,
      });
      if (canSubmitDirectlyToAccounting && submitToAccountingNow) {
        await submitSubtaskCashClearance({
          taskId: assignment.taskId,
          subtaskId: assignment.subtaskId ?? null,
          note: description.trim(),
        });
      }
      await onSaved();
      onClose();
    } catch (caught) {
      setError(readableUiError(caught, "Could not save this receipt.", "write"));
    } finally {
      setBusy(false);
    }
  };

  const enteredNum = /^\d+(?:\.\d{1,2})?$/.test(amount.trim()) ? Number(amount.trim()) : 0;
  const leftoverAfterThisReceipt = Math.max(
    0,
    Math.round((assignment.unspentAmount - (Number.isFinite(enteredNum) ? enteredNum : 0)) * 100) / 100,
  );

  return (
    <Modal
      isOpen
      title="Submit receipt"
      description={`${workTitle} · ${assignment.sourceLabel}`}
      width="max-w-xl"
      preventClose={busy}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <ModalButton disabled={busy} onClick={onClose}>
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={busy || Boolean(validationError)}
          >
            {busy
              ? "Submitting…"
              : canSubmitDirectlyToAccounting && submitToAccountingNow
                ? "Submit to Accounting"
                : "Save receipt"}
          </ModalButton>
        </div>
      }
    >
      <form id="assignment-receipt-form" onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/25 p-3 text-[12px]">
          <div>
            <span className="block text-[11px] text-muted-foreground">Assigned</span>
            <strong className="tabular-nums text-foreground">{peso.format(assignment.amount)}</strong>
          </div>
          <div>
            <span className="block text-[11px] text-muted-foreground">Logged receipts</span>
            <strong className="tabular-nums text-foreground">{peso.format(assignment.recordedSpent)}</strong>
          </div>
          <div>
            <span className="block text-[11px] text-muted-foreground">Remaining</span>
            <strong className="tabular-nums text-primary">{peso.format(assignment.unspentAmount)}</strong>
          </div>
        </div>

        <p className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-[11.5px] text-blue-950">
          This receipt automatically rolls up into{" "}
          <strong>{assignment.sourceLabel}</strong>’s liquidation package so Accounting settles everything in one pass.
          {isOfficeCash ? " Office petty cash receipts are capped at ₱5,000.00 each." : ""}
        </p>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[12px] font-medium text-foreground">
            <span>Vendor / payee *</span>
            <BoundedTextInput
              type="text"
              required
              maxLength={200}
              disabled={busy}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. National Book Store"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px]"
            />
          </label>

          <label className="grid gap-1 text-[12px] font-medium text-foreground">
            <span>OR / Receipt number {isOfficeCash ? "*" : "(optional)"}</span>
            <BoundedTextInput
              type="text"
              required={isOfficeCash}
              maxLength={100}
              disabled={busy}
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. OR-00142"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px]"
            />
          </label>

          <label className="grid gap-1 text-[12px] font-medium text-foreground">
            <span>Receipt date *</span>
            <input
              type="date"
              required
              max={today}
              disabled={busy}
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-[12.5px]"
            />
          </label>

          <label className="grid gap-1 text-[12px] font-medium text-foreground">
            <span>Amount (PHP) · max {peso.format(maxAllowed)} *</span>
            <MoneyInput
              required
              value={amount}
              min={0.01}
              max={maxAllowed}
              disabled={busy}
              onValueChange={(raw) => {
                setAmount(raw);
                setError("");
              }}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px] tabular-nums"
            />
          </label>
        </div>

        <label className="grid gap-1 text-[12px] font-medium text-foreground">
          <span>What was purchased *</span>
          <BoundedTextInput
            type="text"
            required
            maxLength={300}
            disabled={busy}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Bond paper, ink cartridge, transport fare"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px]"
          />
        </label>

        {hasFundingLines && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-[12px] font-medium text-foreground sm:col-span-1">
              <span>Expense account *</span>
              {assignment.allocationLineId && assignment.fundingLines.length === 1 ? (
                <div className="flex h-9 items-center truncate rounded-lg border border-border bg-muted/40 px-2.5 text-[12px] font-medium text-foreground">
                  <span className="truncate">
                    {assignment.fundingLines[0].sourceName || "Approved account"}
                  </span>
                </div>
              ) : (
                <select
                  value={allocationLineId}
                  disabled={busy}
                  onChange={(e) => setAllocationLineId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2.5 text-[12px]"
                >
                  {assignment.fundingLines.map((line) => (
                    <option key={line.allocationLineId} value={line.allocationLineId}>
                      {line.sourceName || "Approved account"} ({peso.format(line.amount)})
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="grid gap-1 text-[12px] font-medium text-foreground">
              <span>Quantity</span>
              <input
                type="number"
                min="0.001"
                step="any"
                disabled={busy}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-[12.5px]"
              />
            </label>
            <label className="grid gap-1 text-[12px] font-medium text-foreground">
              <span>Unit</span>
              <input
                type="text"
                maxLength={40}
                disabled={busy}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs, lot, box"
                className="h-9 rounded-lg border border-border bg-background px-3 text-[12.5px]"
              />
            </label>
          </div>
        )}

        <div>
          <span className="text-[12px] font-medium text-foreground">Receipt photo or PDF *</span>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-[12px]">
              <Upload size={14} className="shrink-0 text-primary" aria-hidden="true" />
              {file ? (
                <span className="truncate font-medium text-foreground">{file.name}</span>
              ) : (
                <span className="text-muted-foreground">JPG, PNG, WebP, or PDF up to 10 MB</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                aria-label="Receipt photo or PDF"
                type="file"
                disabled={busy}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0]);
                  setError("");
                }}
                className="w-[180px] text-[11.5px]"
              />
              {file && !busy && (
                <button
                  type="button"
                  aria-label="Remove selected file"
                  onClick={() => setFile(undefined)}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {canSubmitDirectlyToAccounting && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[12px]">
            <input
              type="checkbox"
              checked={submitToAccountingNow}
              disabled={busy}
              onChange={(e) => setSubmitToAccountingNow(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border accent-[var(--eflow-primary)]"
            />
            <span className="leading-relaxed text-foreground">
              <strong>Final receipt — submit to Accounting for approval now</strong>
              <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                {leftoverAfterThisReceipt > 0
                  ? `Sends receipts to Accounting and automatically returns the remaining ${peso.format(leftoverAfterThisReceipt)} back to the task cash pool (with audit trail). Uncheck if you have more receipts to add first.`
                  : "Sends your receipts directly to the Accounting Officer for verification. Uncheck only if you need to attach additional receipts."}
              </span>
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}
