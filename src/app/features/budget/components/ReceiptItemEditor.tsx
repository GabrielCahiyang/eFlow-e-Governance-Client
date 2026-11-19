import { useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { INPUT_LIMITS, blockInvalidNumberKey, maxDigitsForNumber } from "../../../shared/inputLimits";
import type { CashFundingLine, ReceiptItem } from "../types";
import { peso } from "./budgetUi";
import { MAX_RECEIPT_QUANTITY } from "../validation/financialValidation";
import type { ReceiptItemValidation, SourceUsageSummary } from "../validation/liquidationValidation";

export function ReceiptItemEditor({
  items,
  sources,
  sourceUsage = [],
  itemErrors = [],
  showAllErrors = false,
  exceedsReleased = false,
  onChange,
  disabled,
}: {
  items: ReceiptItem[];
  sources: CashFundingLine[];
  sourceUsage?: SourceUsageSummary[];
  itemErrors?: ReceiptItemValidation[];
  showAllErrors?: boolean;
  exceedsReleased?: boolean;
  onChange: (items: ReceiptItem[]) => void;
  disabled: boolean;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const show = (itemId: string, fieldName: string) => showAllErrors || Boolean(touched[`${itemId}:${fieldName}`]);
  const patch = (id: string, value: Partial<ReceiptItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...value } : item)));

  const sourceUsageById = new Map(sourceUsage.map((entry) => [entry.allocationLineId, entry]));

  const inputClass = (invalid: boolean) =>
    `mt-1 h-9 w-full rounded-lg border px-2.5 text-[12.5px] text-foreground transition-colors outline-none focus:ring-2 ${
      invalid
        ? "border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20"
        : "border-[var(--eflow-border,#cbd5e1)] bg-background focus:border-primary focus:ring-primary/15"
    } disabled:opacity-60`;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[var(--eflow-border,#d6e1df)] bg-muted/25 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-foreground">
            Purchased items
          </p>
          <p className="text-[11px] text-muted-foreground">
            Actual cost is the total amount paid for each line item (not per unit).
          </p>
        </div>
        <span className="rounded-md bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground border border-border">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-background/70 px-3 py-2.5 text-[12px] text-muted-foreground">
          No purchased items added yet. Click <strong>Add purchased item</strong> to record expenses from this receipt.
        </p>
      )}

      {items.map((item, index) => {
        const err = itemErrors[index];
        const qtyErr = show(item.id, "quantity") ? err?.quantity || "" : "";
        const unitErr = show(item.id, "unit") ? err?.unit || "" : "";
        const particularErr = show(item.id, "particular") ? err?.particular || "" : "";
        const purposeErr = show(item.id, "purpose") ? err?.purpose || "" : "";
        const sourceErr = show(item.id, "source") ? err?.allocationLineId || "" : "";
        // Over-limit errors always show immediately so the user cannot miss why submission is blocked.
        const amountOverErr = err?.sourceExceeded || (exceedsReleased && item.amount > 0 ? "Contributes to spending over the released cash limit." : "");
        const amountErr = amountOverErr || (show(item.id, "amount") ? err?.amount || "" : "");
        const usage = sourceUsageById.get(item.allocationLineId);

        return (
          <div
            key={item.id}
            className={`space-y-3 rounded-xl border bg-card p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
              amountOverErr ? "border-destructive/60" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <span className="text-[12px] font-semibold text-foreground">Item {index + 1}</span>
              <button
                type="button"
                aria-label={`Remove item ${index + 1}`}
                disabled={disabled}
                onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <Trash2 size={12} aria-hidden="true" />
                <span>Remove</span>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11.5px] font-medium text-foreground">
                <span className="after:ml-0.5 after:text-destructive after:content-['*']">Quantity</span>
                <input
                  aria-invalid={Boolean(qtyErr)}
                  disabled={disabled}
                  type="number"
                  min="0.001"
                  max={MAX_RECEIPT_QUANTITY}
                  step="0.001"
                  value={Number.isNaN(item.quantity) ? "" : item.quantity}
                  onKeyDown={(e) => blockInvalidNumberKey(e, { allowDecimal: true })}
                  onBlur={() => markTouched(`${item.id}:quantity`)}
                  onChange={(e) => {
                    markTouched(`${item.id}:quantity`);
                    const raw = e.target.value;
                    if (raw === "") {
                      patch(item.id, { quantity: NaN });
                      return;
                    }
                    const intDigits = raw.replace(/^-/, "").split(".")[0].replace(/^0+(?=\d)/, "");
                    if (intDigits.length > maxDigitsForNumber(MAX_RECEIPT_QUANTITY)) return;
                    patch(item.id, { quantity: Number(raw) });
                  }}
                  className={`${inputClass(Boolean(qtyErr))} tabular-nums`}
                />
                {qtyErr && <p role="alert" className="mt-1 text-[11px] font-normal text-destructive">{qtyErr}</p>}
              </label>

              <label className="block text-[11.5px] font-medium text-foreground">
                <span className="after:ml-0.5 after:text-destructive after:content-['*']">Unit</span>
                <input
                  aria-invalid={Boolean(unitErr)}
                  disabled={disabled}
                  maxLength={INPUT_LIMITS.CODE}
                  value={item.unit}
                  onBlur={() => markTouched(`${item.id}:unit`)}
                  onChange={(e) => {
                    markTouched(`${item.id}:unit`);
                    patch(item.id, { unit: e.target.value });
                  }}
                  placeholder="pcs., ream, box, pack"
                  className={inputClass(Boolean(unitErr))}
                />
                {unitErr && <p role="alert" className="mt-1 text-[11px] font-normal text-destructive">{unitErr}</p>}
              </label>

              <label className="block text-[11.5px] font-medium text-foreground sm:col-span-2">
                <span className="after:ml-0.5 after:text-destructive after:content-['*']">Particulars</span>
                <input
                  aria-invalid={Boolean(particularErr)}
                  disabled={disabled}
                  maxLength={INPUT_LIMITS.TITLE}
                  value={item.particular}
                  onBlur={() => markTouched(`${item.id}:particular`)}
                  onChange={(e) => {
                    markTouched(`${item.id}:particular`);
                    patch(item.id, { particular: e.target.value });
                  }}
                  placeholder="e.g. Packed lunch for workshop participants"
                  className={inputClass(Boolean(particularErr))}
                />
                {particularErr && <p role="alert" className="mt-1 text-[11px] font-normal text-destructive">{particularErr}</p>}
              </label>

              <label className="block text-[11.5px] font-medium text-foreground">
                <span className="after:ml-0.5 after:text-destructive after:content-['*']">Actual cost (₱)</span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] font-medium text-muted-foreground" aria-hidden="true">₱</span>
                  <MoneyInput
                    aria-invalid={Boolean(amountErr)}
                    disabled={disabled}
                    min="0.01"
                    max={INPUT_LIMITS.MONEY_MAX_LINE}
                    step="0.01"
                    value={item.amount || ""}
                    onBlur={() => markTouched(`${item.id}:amount`)}
                    onValueChange={(raw) => {
                      markTouched(`${item.id}:amount`);
                      patch(item.id, { amount: Number(raw) });
                    }}
                    className={`${inputClass(Boolean(amountErr))} mt-0 pl-6 text-right tabular-nums`}
                  />
                </div>
                {amountErr && (
                  <p role="alert" className="mt-1 flex items-start gap-1 text-[11px] font-normal text-destructive">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{amountErr}</span>
                  </p>
                )}
              </label>

              <label className="block text-[11.5px] font-medium text-foreground">
                <span className="after:ml-0.5 after:text-destructive after:content-['*']">Approved expense source</span>
                <select
                  aria-invalid={Boolean(sourceErr || usage?.exceeded)}
                  disabled={disabled}
                  value={item.allocationLineId}
                  onBlur={() => markTouched(`${item.id}:source`)}
                  onChange={(e) => {
                    markTouched(`${item.id}:source`);
                    patch(item.id, { allocationLineId: e.target.value });
                  }}
                  className={inputClass(Boolean(sourceErr || usage?.exceeded))}
                >
                  {sources.map((s, i) => (
                    <option key={s.allocationLineId} value={s.allocationLineId}>
                      {s.sourceName || `Funding line ${i + 1}`} · {peso.format(s.amount)}
                    </option>
                  ))}
                </select>
                {usage && !sourceErr && (
                  <p className={`mt-1 text-[11px] tabular-nums ${usage.exceeded ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                    {usage.exceeded
                      ? `Exceeds source limit by ${peso.format(usage.overByAmount)}`
                      : `${peso.format(usage.remainingAmount)} remaining of ${peso.format(usage.approvedAmount)}`}
                  </p>
                )}
                {sourceErr && <p role="alert" className="mt-1 text-[11px] font-normal text-destructive">{sourceErr}</p>}
              </label>

              <label className="block text-[11.5px] font-medium text-foreground sm:col-span-2">
                <span className="after:ml-0.5 after:text-destructive after:content-['*']">Purpose</span>
                <input
                  aria-invalid={Boolean(purposeErr)}
                  disabled={disabled}
                  maxLength={INPUT_LIMITS.REASON}
                  value={item.purpose}
                  onBlur={() => markTouched(`${item.id}:purpose`)}
                  onChange={(e) => {
                    markTouched(`${item.id}:purpose`);
                    patch(item.id, { purpose: e.target.value });
                  }}
                  placeholder="Why this item was purchased for the task"
                  className={inputClass(Boolean(purposeErr))}
                />
                {purposeErr && <p role="alert" className="mt-1 text-[11px] font-normal text-destructive">{purposeErr}</p>}
              </label>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...items,
            {
              id: crypto.randomUUID(),
              allocationLineId: sources[0]?.allocationLineId || "",
              quantity: 1,
              unit: "pcs.",
              particular: "",
              purpose: items[0]?.purpose || "",
              amount: 0,
            },
          ])
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/60 disabled:opacity-50"
      >
        <Plus size={13} aria-hidden="true" />
        Add purchased item
      </button>
    </div>
  );
}
