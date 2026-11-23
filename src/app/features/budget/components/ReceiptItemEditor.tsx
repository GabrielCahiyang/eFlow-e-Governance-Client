import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BoundedTextInput } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { fromCentavos, toCentavos } from "../../../shared/currency";
import { INPUT_LIMITS, blockInvalidNumberKey, maxDigitsForNumber } from "../../../shared/inputLimits";
import type { CashFundingLine, ReceiptItem } from "../types";
import { peso } from "./budgetUi";
import { MAX_RECEIPT_QUANTITY } from "../validation/financialValidation";
import type { ReceiptItemValidation, SourceUsageSummary } from "../validation/liquidationValidation";

function inputClass(invalid: boolean) {
  return `mt-1 h-9 w-full rounded-lg border px-2.5 text-[12.5px] text-foreground transition-colors outline-none focus:ring-2 ${
    invalid
      ? "border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/20"
      : "border-[var(--eflow-border,#cbd5e1)] bg-background focus:border-primary focus:ring-primary/15"
  } disabled:opacity-60`;
}

function ReceiptItemRow({
  item,
  index,
  sources,
  usage,
  err,
  exceedsReleased,
  disabled,
  show,
  markTouched,
  onPatch,
  onRemove,
}: {
  item: ReceiptItem;
  index: number;
  sources: CashFundingLine[];
  usage?: SourceUsageSummary;
  err?: ReceiptItemValidation;
  exceedsReleased: boolean;
  disabled: boolean;
  show: (itemId: string, fieldName: string) => boolean;
  markTouched: (key: string) => void;
  onPatch: (id: string, value: Partial<ReceiptItem>) => void;
  onRemove: () => void;
}) {
  const idPrefix = useId();
  const qtyRef = useRef<HTMLInputElement | null>(null);
  const sourceRef = useRef<HTMLSelectElement | null>(null);
  const [qtyActive, setQtyActive] = useState(false);
  const [sourceActive, setSourceActive] = useState(false);

  const qtyErr = show(item.id, "quantity") ? err?.quantity || "" : "";
  const unitErr = show(item.id, "unit") ? err?.unit || "" : "";
  const particularErr = show(item.id, "particular") ? err?.particular || "" : "";
  const purposeErr = show(item.id, "purpose") ? err?.purpose || "" : "";
  const sourceErr = show(item.id, "source") ? err?.allocationLineId || "" : "";
  const sourceOverMessage = usage?.exceeded
    ? `Exceeds source limit by ${peso.format(usage.overByAmount)}.`
    : "";
  const sourceTipMessage = sourceErr || sourceOverMessage;
  const amountOverErr =
    err?.sourceExceeded ||
    (exceedsReleased && item.amount > 0 ? "Contributes to spending over the released cash limit." : "");
  const amountErr = amountOverErr || (show(item.id, "amount") ? err?.amount || "" : "");

  const otherUsedCents = usage
    ? Math.max(
        0,
        toCentavos(usage.usedAmount) -
          toCentavos(Number.isFinite(item.amount) && item.amount > 0 ? item.amount : 0),
      )
    : 0;
  const lineAvailableMax = usage
    ? Math.max(0, fromCentavos(toCentavos(usage.approvedAmount) - otherUsedCents))
    : sources.find((s) => s.allocationLineId === item.allocationLineId)?.amount;

  const qtyId = `${idPrefix}-qty`;
  const qtyTipId = `${idPrefix}-qty-tip`;
  const unitId = `${idPrefix}-unit`;
  const particularId = `${idPrefix}-particular`;
  const amountId = `${idPrefix}-amount`;
  const sourceId = `${idPrefix}-source`;
  const sourceTipId = `${idPrefix}-source-tip`;
  const purposeId = `${idPrefix}-purpose`;

  const removeTip = disabled
    ? "Editing is locked."
    : `Remove item ${index + 1} from this receipt.`;

  return (
    <div
      className={`space-y-3 rounded-xl border bg-card p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        amountOverErr ? "border-destructive/60" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/70 pb-2">
        <span className="text-[12px] font-semibold text-foreground">Item {index + 1}</span>
        <WorkspaceTooltip content={removeTip} disabled={!removeTip}>
          <span className="inline-flex">
            <button
              type="button"
              aria-label={`Remove item ${index + 1}`}
              disabled={disabled}
              onClick={onRemove}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            >
              <Trash2 size={12} aria-hidden="true" />
              <span>Remove</span>
            </button>
          </span>
        </WorkspaceTooltip>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block text-[11.5px] font-medium text-foreground">
          <label htmlFor={qtyId}>
            Quantity{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <input
            ref={qtyRef}
            id={qtyId}
            aria-required="true"
            aria-invalid={Boolean(qtyErr) || undefined}
            aria-describedby={qtyActive && qtyErr ? qtyTipId : undefined}
            disabled={disabled}
            type="number"
            min="0.001"
            max={MAX_RECEIPT_QUANTITY}
            step="0.001"
            value={Number.isNaN(item.quantity) ? "" : item.quantity}
            onKeyDown={(e) => blockInvalidNumberKey(e, { allowDecimal: true })}
            onFocus={() => setQtyActive(true)}
            onMouseEnter={() => setQtyActive(true)}
            onMouseLeave={() => setQtyActive(false)}
            onBlur={() => {
              setQtyActive(false);
              markTouched(`${item.id}:quantity`);
            }}
            onChange={(e) => {
              markTouched(`${item.id}:quantity`);
              const raw = e.target.value;
              if (raw === "") {
                onPatch(item.id, { quantity: NaN });
                return;
              }
              const intDigits = raw.replace(/^-/, "").split(".")[0].replace(/^0+(?=\d)/, "");
              if (intDigits.length > maxDigitsForNumber(MAX_RECEIPT_QUANTITY)) return;
              onPatch(item.id, { quantity: Number(raw) });
            }}
            className={`${inputClass(Boolean(qtyErr))} tabular-nums`}
          />
          <FieldValidationTooltip
            id={qtyTipId}
            anchorRef={qtyRef}
            message={qtyErr}
            open={qtyActive && Boolean(qtyErr)}
            tone="error"
          />
          {qtyErr && <p role="alert" className="mt-1 text-[11px] font-normal text-destructive">{qtyErr}</p>}
        </div>

        <div className="block text-[11.5px] font-medium text-foreground">
          <label htmlFor={unitId}>
            Unit{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextInput
            id={unitId}
            aria-required="true"
            disabled={disabled}
            maxLength={INPUT_LIMITS.CODE}
            value={item.unit}
            error={unitErr || undefined}
            onBlur={() => markTouched(`${item.id}:unit`)}
            onChange={(e) => {
              markTouched(`${item.id}:unit`);
              onPatch(item.id, { unit: e.target.value });
            }}
            placeholder="pcs., ream, box, pack"
            className={inputClass(Boolean(unitErr))}
          />
        </div>

        <div className="block text-[11.5px] font-medium text-foreground sm:col-span-2">
          <label htmlFor={particularId}>
            Particulars{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextInput
            id={particularId}
            aria-required="true"
            disabled={disabled}
            maxLength={INPUT_LIMITS.TITLE}
            value={item.particular}
            error={particularErr || undefined}
            onBlur={() => markTouched(`${item.id}:particular`)}
            onChange={(e) => {
              markTouched(`${item.id}:particular`);
              onPatch(item.id, { particular: e.target.value });
            }}
            placeholder="e.g. Packed lunch for workshop participants"
            className={inputClass(Boolean(particularErr))}
          />
        </div>

        <div className="block text-[11.5px] font-medium text-foreground">
          <label htmlFor={amountId}>
            Actual cost (₱){" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <div className="relative mt-1">
            <span
              className="pointer-events-none absolute left-2.5 top-[18px] -translate-y-1/2 text-[12.5px] font-medium text-muted-foreground"
              aria-hidden="true"
            >
              ₱
            </span>
            <MoneyInput
              id={amountId}
              aria-required="true"
              disabled={disabled}
              min="0.01"
              max={INPUT_LIMITS.MONEY_MAX_LINE}
              availableMax={lineAvailableMax}
              showCeilingHint
              externalError={amountErr || undefined}
              step="0.01"
              value={item.amount || ""}
              onBlur={() => markTouched(`${item.id}:amount`)}
              onValueChange={(raw) => {
                markTouched(`${item.id}:amount`);
                onPatch(item.id, { amount: Number(raw) });
              }}
              className={`${inputClass(Boolean(amountErr))} mt-0 pl-6 text-right tabular-nums`}
            />
          </div>
        </div>

        <div className="block text-[11.5px] font-medium text-foreground">
          <label htmlFor={sourceId}>
            Approved expense source{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <select
            ref={sourceRef}
            id={sourceId}
            aria-required="true"
            aria-invalid={Boolean(sourceErr || usage?.exceeded) || undefined}
            aria-describedby={sourceActive && sourceTipMessage ? sourceTipId : undefined}
            disabled={disabled}
            value={item.allocationLineId}
            onFocus={() => setSourceActive(true)}
            onMouseEnter={() => setSourceActive(true)}
            onMouseLeave={() => setSourceActive(false)}
            onBlur={() => {
              setSourceActive(false);
              markTouched(`${item.id}:source`);
            }}
            onChange={(e) => {
              markTouched(`${item.id}:source`);
              onPatch(item.id, { allocationLineId: e.target.value });
            }}
            className={inputClass(Boolean(sourceErr || usage?.exceeded))}
          >
            {sources.map((s, i) => (
              <option key={s.allocationLineId} value={s.allocationLineId}>
                {s.sourceName || `Funding line ${i + 1}`} · {peso.format(s.amount)}
              </option>
            ))}
          </select>
          <FieldValidationTooltip
            id={sourceTipId}
            anchorRef={sourceRef}
            message={sourceTipMessage}
            open={sourceActive && Boolean(sourceTipMessage)}
            tone="error"
          />
          {usage && !sourceErr && (
            <p className={`mt-1 text-[11px] tabular-nums ${usage.exceeded ? "font-medium text-destructive" : "text-muted-foreground"}`}>
              {usage.exceeded
                ? `Exceeds source limit by ${peso.format(usage.overByAmount)}`
                : `${peso.format(usage.remainingAmount)} remaining of ${peso.format(usage.approvedAmount)}`}
            </p>
          )}
          {sourceErr && <p role="alert" className="mt-1 text-[11px] font-normal text-destructive">{sourceErr}</p>}
        </div>

        <div className="block text-[11.5px] font-medium text-foreground sm:col-span-2">
          <label htmlFor={purposeId}>
            Purpose{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextInput
            id={purposeId}
            aria-required="true"
            disabled={disabled}
            maxLength={INPUT_LIMITS.REASON}
            value={item.purpose}
            error={purposeErr || undefined}
            onBlur={() => markTouched(`${item.id}:purpose`)}
            onChange={(e) => {
              markTouched(`${item.id}:purpose`);
              onPatch(item.id, { purpose: e.target.value });
            }}
            placeholder="Why this item was purchased for the task"
            className={inputClass(Boolean(purposeErr))}
          />
        </div>
      </div>
    </div>
  );
}

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
  const addItemTip = disabled ? "Item editing is currently locked." : "";

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

      {items.map((item, index) => (
        <ReceiptItemRow
          key={item.id}
          item={item}
          index={index}
          sources={sources}
          usage={sourceUsageById.get(item.allocationLineId)}
          err={itemErrors[index]}
          exceedsReleased={exceedsReleased}
          disabled={disabled}
          show={show}
          markTouched={markTouched}
          onPatch={patch}
          onRemove={() => onChange(items.filter((entry) => entry.id !== item.id))}
        />
      ))}

      <WorkspaceTooltip content={addItemTip} disabled={!addItemTip}>
        <span className="inline-flex">
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
        </span>
      </WorkspaceTooltip>
    </div>
  );
}
