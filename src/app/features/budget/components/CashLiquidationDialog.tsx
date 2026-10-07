import { useRef, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import * as m from "motion/react-m";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { PettyCashRequest, ReceiptDraft } from "../types";
import { submitPettyCashLiquidation } from "../services/budgetService";
import { peso } from "./budgetUi";
import { ReceiptItemEditor } from "./ReceiptItemEditor";
import { moneyCents } from "../selectors/budgetSections";
import {
  getPhilippineCalendarDate,
  isLiquidationCurrentlyOverdue,
} from "../selectors/cashWorkflowRules";

export function CashLiquidationDialog({ request, orgId, perReceiptLimit, liquidationDueDays, allowReceiptOverride, onClose, onSaved }: {
  request: PettyCashRequest;
  orgId: string;
  perReceiptLimit: number;
  liquidationDueDays: number;
  allowReceiptOverride: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const approved = request.releasedAmount || 0;
  const sources=request.fundingLines||[];
  const itemized=sources.length>0;
  const [enteredSpent, setSpent] = useState(approved);
  const [note, setNote] = useState("");
  const [receipts, setReceipts] = useState<ReceiptDraft[]>([{...blankReceipt(itemized?0:approved),...(itemized?{items:[]}: {})}]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refundReceiptNumber, setRefundReceiptNumber] = useState("");
  const [refundDate, setRefundDate] = useState(getPhilippineCalendarDate());
  const idempotencyKey = useRef(crypto.randomUUID());
  const receiptTotal = receipts.reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
  const spent=itemized?receiptTotal:enteredSpent;
  const overdue = isLiquidationCurrentlyOverdue(request);
  const update = (id: string, patch: Partial<ReceiptDraft>) => setReceipts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await submitPettyCashLiquidation({ orgId, requestId: request.id, spent, note, receipts, refundReceiptNumber, refundDate, idempotencyKey: idempotencyKey.current });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Receipts could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  const invalid = busy || spent < 0 || spent > approved || Math.abs(receiptTotal - spent) > .009 || !note.trim()
    || (approved - spent > .009 && (!refundReceiptNumber.trim() || !refundDate))
    || receipts.some((item) => !item.vendor.trim() || (!item.description.trim()&&!item.items?.length) || !item.file
      || item.items?.some(i=>i.quantity<=0||!i.unit.trim()||!i.particular.trim()||!i.purpose.trim()||i.amount<=0||!sources.some(s=>s.allocationLineId===i.allocationLineId))
      || (item.amount > perReceiptLimit && (!allowReceiptOverride || !item.overrideReason?.trim())));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Cash liquidation</div>
          <DialogTitle className="text-[18px]">Upload receipts and return balance</DialogTitle>
          <DialogDescription className="tabular-nums">
            Released {peso.format(approved)} · unused cash {peso.format(Math.max(0, approved - spent))}
          </DialogDescription>
        </DialogHeader>

        <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          <AttentionBox type="primary" title="Immutable receipt record" text="After submission, receipt rows and uploaded evidence are locked. Corrections are recorded as a new liquidation version so the audit history stays intact." />
          <AttentionBox
            type={overdue ? "warning" : "primary"}
            title={overdue ? "Late liquidation · Head approval required" : `${liquidationDueDays}-day liquidation window`}
            text={overdue
              ? `The receipt deadline was ${request.liquidationDueAt ? new Date(request.liquidationDueAt).toLocaleDateString() : "already reached"}. You may still submit this package, but only the Head can approve and settle it.`
              : `Upload the complete receipt package by ${request.liquidationDueAt ? new Date(request.liquidationDueAt).toLocaleDateString() : `the ${liquidationDueDays}-day deadline after full release`}.`}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {itemized?<div className="text-[12px]">Actual spending from purchased items<output className="mt-2 block text-[16px] font-semibold">{peso.format(spent)}</output></div>:<Field label="Actual amount spent" type="number" value={spent} onChange={(value) => setSpent(Number(value))} inputClassName="text-right tabular-nums" />}
            <div className="rounded-lg border border-border bg-muted/35 p-3 text-right">
              <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Receipt total</div>
              <div className={`mt-1 text-[16px] font-semibold tabular-nums ${Math.abs(receiptTotal - spent) > .009 ? "text-destructive" : "text-primary"}`}>{peso.format(receiptTotal)}</div>
            </div>
          </div>

          <div className="space-y-3">
            {receipts.map((receipt, index) => (
              <div key={receipt.id} className="rounded-lg border border-border bg-card p-3 shadow-[0_2px_4px_-3px_rgba(0,0,0,0.12)]">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-foreground">Receipt {index + 1}</div>
                  <button type="button" aria-label={`Remove receipt ${index + 1}`} disabled={receipts.length === 1} onClick={() => setReceipts((current) => current.filter((item) => item.id !== receipt.id))} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Vendor / payee" value={receipt.vendor} onChange={(value) => update(receipt.id, { vendor: value })} />
                  <Field label="OR/AR number" value={receipt.receiptNumber} onChange={(value) => update(receipt.id, { receiptNumber: value })} />
                  <Field label="Receipt date" type="date" value={receipt.receiptDate} onChange={(value) => update(receipt.id, { receiptDate: value })} />
                  {itemized?<div className="text-[12px]">Receipt total<output className="mt-2 block font-semibold">{peso.format(receipt.amount)}</output></div>:<Field label="Amount" type="number" value={receipt.amount || ""} onChange={(value) => update(receipt.id, { amount: Number(value) })} inputClassName="text-right tabular-nums" />}
                  <label className="sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Expense description</span>
                    <Input value={receipt.description} onChange={(event) => update(receipt.id, { description: event.target.value })} className="mt-1 h-9 text-[12px]" />
                  </label>
                  {receipt.amount > perReceiptLimit && (
                    <label className="sm:col-span-2">
                      <span className="text-[11px] font-medium text-amber-800">Threshold exception · above {peso.format(perReceiptLimit)}</span>
                      <Textarea disabled={!allowReceiptOverride} value={receipt.overrideReason || ""} onChange={(event) => update(receipt.id, { overrideReason: event.target.value })} rows={2} placeholder={allowReceiptOverride ? "Explain why the larger receipt was necessary." : "Office policy does not allow an override."} className="mt-1 min-h-0 border-amber-200 bg-amber-50 text-[12px] disabled:opacity-60" />
                    </label>
                  )}
                  <label className="sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Receipt image or PDF</span>
                    <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => update(receipt.id, { file: event.target.files?.[0] })} className="mt-1 h-auto py-1 text-[11px]" />
                  </label>
                </div>
                {itemized&&<ReceiptItemEditor items={receipt.items||[]} sources={sources} disabled={busy} onChange={items=>update(receipt.id,{items,amount:items.reduce((sum,i)=>sum+(Number.isFinite(i.amount)&&i.amount<=90000000000?moneyCents(i.amount):0),0)/100})}/>}
              </div>
            ))}
          </div>

          <Button kind="secondary" size="small" onClick={() => setReceipts((current) => [...current, {...blankReceipt(0),...(itemized?{items:[]}: {})}])}><Plus size={13} className="mr-1" /> Add receipt</Button>

          {approved - spent > .009 && (
            <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:grid-cols-2">
              <Field label="Official refund receipt number" value={refundReceiptNumber} onChange={setRefundReceiptNumber} />
              <Field label="Cash return date" type="date" value={refundDate} onChange={setRefundDate} />
              <p className="sm:col-span-2 text-[11px] leading-5 text-primary">Returned change of <span className="font-semibold tabular-nums">{peso.format(approved - spent)}</span> will post as a debit to Cash and a credit that clears the member advance.</p>
            </m.div>
          )}

          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">Liquidation note</span>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="What was purchased and how much cash is being returned?" className="mt-1 text-[12px]" />
          </label>
          {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[12px] text-destructive">{error}</div>}
        </m.div>

        <DialogFooter className="border-t border-border px-5 py-4 sm:justify-end">
          <Button kind="secondary" size="small" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button kind="primary" size="small" disabled={invalid} loading={busy} onClick={() => void submit()}><FileText size={13} className="mr-1" /> Submit liquidation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function blankReceipt(amount: number): ReceiptDraft {
  return { id: crypto.randomUUID(), vendor: "", receiptNumber: "", receiptDate: getPhilippineCalendarDate(), description: "", amount };
}

function Field({ label, value, onChange, type = "text", inputClassName = "" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; inputClassName?: string }) {
  return <label><span className="text-[11px] font-medium text-muted-foreground">{label}</span><Input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 h-9 text-[12px] ${inputClassName}`} /></label>;
}
