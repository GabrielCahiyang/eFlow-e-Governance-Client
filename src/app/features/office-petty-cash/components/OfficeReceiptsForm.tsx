import { useState } from 'react';
import { DateInput } from '../../../components/ui/DateInput';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { uploadOfficeReceipt } from '../services/officeCash';
import {
  OFFICE_PETTY_MAX_RECEIPTS,
  OFFICE_PETTY_RECEIPT_LIMIT,
  getLiquidationDueStatus,
  type OfficeReceiptsValidationResult,
} from '../validation/officeCashValidation';
import type { OfficeCashRequest, OfficeReceipt } from '../types';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

interface OfficeReceiptsFormProps {
  request: OfficeCashRequest;
  transactionDate: string;
  receipts: OfficeReceipt[];
  refundReceiptNumber: string;
  refundDate: string;
  validation: OfficeReceiptsValidationResult;
  locked: boolean;
  onReceiptsChange: (next: OfficeReceipt[]) => void;
  onRefundReceiptNumberChange: (value: string) => void;
  onRefundDateChange: (value: string) => void;
  onUploadingChange: (uploading: boolean) => void;
  onUploadError: (message: string) => void;
}

export function OfficeReceiptsForm({
  request,
  transactionDate,
  receipts,
  refundReceiptNumber,
  refundDate,
  validation,
  locked,
  onReceiptsChange,
  onRefundReceiptNumberChange,
  onRefundDateChange,
  onUploadingChange,
  onUploadError,
}: OfficeReceiptsFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  const dueStatus = getLiquidationDueStatus(request.liquidation_due_at);

  const updateReceipt = (index: number, patch: Partial<OfficeReceipt>) => {
    onReceiptsChange(receipts.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="opc-receipts-section">
      {dueStatus && (
        <div
          className={`opc-banner ${dueStatus.isOverdue ? 'opc-banner--warning' : 'opc-banner--info'}`}
          role={dueStatus.isOverdue ? 'alert' : 'status'}
        >
          <strong>Liquidation window:</strong> {dueStatus.label}.
        </div>
      )}

      <div className="opc-reconcile" aria-label="Receipt reconciliation summary">
        <div>
          <span>Released cash</span>
          <strong>{peso.format(validation.releasedAmount)}</strong>
        </div>
        <div>
          <span>Total receipts</span>
          <strong className={validation.exceedsReleased ? 'opc-text-negative' : undefined}>
            {peso.format(validation.receiptTotal)}
          </strong>
        </div>
        <div>
          <span>Unspent cash to return</span>
          <strong className={validation.requiresCashReturn ? 'opc-text-primary' : undefined}>
            {peso.format(validation.unusedCash)}
          </strong>
        </div>
      </div>

      <p className="opc-hint">
        Each receipt must be at most {peso.format(OFFICE_PETTY_RECEIPT_LIMIT)}. If nothing was spent, submit without
        receipts and return the full advance.
      </p>

      {receipts.map((receipt, index) => {
        const itemError = validation.receipts[index];
        return (
          <fieldset key={index} className={itemError?.duplicate ? 'opc-fieldset--error' : undefined}>
            <legend>Receipt {index + 1}</legend>
            {itemError?.duplicate && (
              <p className="opc-field-error" role="alert">
                {itemError.duplicate}
              </p>
            )}
            <div className="opc-grid-2">
              <label>
                Vendor
                <input
                  value={receipt.vendor}
                  maxLength={200}
                  disabled={locked}
                  aria-invalid={Boolean(touched[`r:${index}:vendor`] && itemError?.vendor)}
                  onBlur={() => markTouched(`r:${index}:vendor`)}
                  onChange={(event) => {
                    markTouched(`r:${index}:vendor`);
                    updateReceipt(index, { vendor: event.target.value });
                  }}
                />
                {touched[`r:${index}:vendor`] && itemError?.vendor && (
                  <span className="opc-field-error">{itemError.vendor}</span>
                )}
              </label>
              <label>
                Receipt number
                <input
                  value={receipt.number}
                  maxLength={100}
                  disabled={locked}
                  aria-invalid={Boolean(touched[`r:${index}:number`] && itemError?.number)}
                  onBlur={() => markTouched(`r:${index}:number`)}
                  onChange={(event) => {
                    markTouched(`r:${index}:number`);
                    updateReceipt(index, { number: event.target.value });
                  }}
                />
                {touched[`r:${index}:number`] && itemError?.number && (
                  <span className="opc-field-error">{itemError.number}</span>
                )}
              </label>
              <label>
                Date
                <DateInput
                  max={transactionDate}
                  value={receipt.date}
                  disabled={locked}
                  onChange={(event) => {
                    markTouched(`r:${index}:date`);
                    updateReceipt(index, { date: event.target.value });
                  }}
                />
                {touched[`r:${index}:date`] && itemError?.date && (
                  <span className="opc-field-error">{itemError.date}</span>
                )}
              </label>
              <label>
                Amount (maximum ₱5,000)
                <MoneyInput
                  value={receipt.amount}
                  disabled={locked}
                  onValueChange={(value) => {
                    markTouched(`r:${index}:amount`);
                    updateReceipt(index, { amount: Number(value) });
                  }}
                />
                {(touched[`r:${index}:amount`] || receipt.amount > OFFICE_PETTY_RECEIPT_LIMIT) && itemError?.amount && (
                  <span className="opc-field-error">{itemError.amount}</span>
                )}
              </label>
            </div>
            <label>
              Expense description (optional)
              <input
                value={receipt.description ?? ''}
                maxLength={300}
                placeholder="e.g. Bond paper and printer ink"
                disabled={locked}
                onChange={(event) => updateReceipt(index, { description: event.target.value })}
              />
              {itemError?.description && <span className="opc-field-error">{itemError.description}</span>}
            </label>
            <label>
              {receipt.path ? 'Receipt attached' : 'Attach receipt · PDF / image, up to 10 MB'}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={locked}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  markTouched(`r:${index}:path`);
                  onUploadingChange(true);
                  onUploadError('');
                  try {
                    const path = await uploadOfficeReceipt(request.id, file);
                    updateReceipt(index, { path });
                  } catch (reason) {
                    onUploadError((reason as Error).message);
                  } finally {
                    onUploadingChange(false);
                  }
                }}
              />
              {touched[`r:${index}:path`] && itemError?.path && (
                <span className="opc-field-error">{itemError.path}</span>
              )}
            </label>
            <div>
              <button
                type="button"
                disabled={locked}
                onClick={() => onReceiptsChange(receipts.filter((_, idx) => idx !== index))}
              >
                Remove receipt
              </button>
            </div>
          </fieldset>
        );
      })}

      <div>
        <button
          type="button"
          disabled={locked || receipts.length >= OFFICE_PETTY_MAX_RECEIPTS}
          onClick={() =>
            onReceiptsChange([
              ...receipts,
              { vendor: '', number: '', date: transactionDate, amount: 0, path: '', description: '' },
            ])
          }
        >
          Add receipt
        </button>
      </div>

      {validation.requiresCashReturn && (
        <section className="opc-return-card" aria-label="Return unused cash">
          <div className="opc-return-card__header">
            <strong>Return unused cash · {peso.format(validation.unusedCash)}</strong>
            <span>Required when spending is less than released cash</span>
          </div>
          <div className="opc-grid-2">
            <label>
              Official refund receipt number
              <input
                value={refundReceiptNumber}
                maxLength={100}
                placeholder="e.g. OR-REF-2026-01"
                disabled={locked}
                aria-invalid={Boolean(touched.refundNumber && validation.refundReceiptNumberError)}
                onBlur={() => markTouched('refundNumber')}
                onChange={(event) => {
                  markTouched('refundNumber');
                  onRefundReceiptNumberChange(event.target.value);
                }}
              />
              {touched.refundNumber && validation.refundReceiptNumberError && (
                <span className="opc-field-error">{validation.refundReceiptNumberError}</span>
              )}
            </label>
            <label>
              Cash return date
              <DateInput
                max={transactionDate}
                value={refundDate}
                disabled={locked}
                onChange={(event) => {
                  markTouched('refundDate');
                  onRefundDateChange(event.target.value);
                }}
              />
              {touched.refundDate && validation.refundDateError && (
                <span className="opc-field-error">{validation.refundDateError}</span>
              )}
            </label>
          </div>
          <p className="opc-hint">
            Returning <strong>{peso.format(validation.unusedCash)}</strong> requires Accounting to acknowledge physical
            receipt and the Office Head to approve the return before settlement credits it back to the office petty cash
            fund.
          </p>
        </section>
      )}
    </div>
  );
}
