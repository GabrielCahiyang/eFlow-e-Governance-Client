import { useEffect, useId, useState } from 'react';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { DateInput } from '../../../components/ui/DateInput';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { exceedsCentavos } from '../../../shared/currency';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
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
  onInvalidDateChange?: (invalid: boolean) => void;
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
  onInvalidDateChange,
}: OfficeReceiptsFormProps) {
  const idPrefix = useId();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [invalidDates, setInvalidDates] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  const setDateInvalid = (key: string, invalid: boolean) => {
    setInvalidDates((prev) => {
      if (Boolean(prev[key]) === invalid) return prev;
      return { ...prev, [key]: invalid };
    });
  };
  const dueStatus = getLiquidationDueStatus(request.liquidation_due_at);

  useEffect(() => {
    if (!onInvalidDateChange) return;
    const anyReceiptDateInvalid = receipts.some((_, idx) => Boolean(invalidDates[`r:${idx}:date`]));
    const refundDateInvalid = validation.requiresCashReturn && Boolean(invalidDates.refundDate);
    onInvalidDateChange(anyReceiptDateInvalid || refundDateInvalid);
  }, [invalidDates, receipts, validation.requiresCashReturn, onInvalidDateChange]);

  const updateReceipt = (index: number, patch: Partial<OfficeReceipt>) => {
    onReceiptsChange(receipts.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addDisabled = locked || receipts.length >= OFFICE_PETTY_MAX_RECEIPTS;
  const addTooltip = locked
    ? 'Wait for the current action or upload to finish.'
    : receipts.length >= OFFICE_PETTY_MAX_RECEIPTS
      ? `Maximum of ${OFFICE_PETTY_MAX_RECEIPTS} receipts reached.`
      : '';

  const refundNumberId = `${idPrefix}-refund-number`;
  const refundDateId = `${idPrefix}-refund-date`;
  const refundNumberError = touched.refundNumber ? validation.refundReceiptNumberError || undefined : undefined;
  const refundDateError = invalidDates.refundDate
    ? 'Enter a valid cash return date in MM/DD/YYYY format.'
    : touched.refundDate || Boolean(refundDate && refundDate > transactionDate)
      ? validation.refundDateError || ''
      : '';

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
        const vendorId = `${idPrefix}-r-${index}-vendor`;
        const numberId = `${idPrefix}-r-${index}-number`;
        const dateId = `${idPrefix}-r-${index}-date`;
        const amountId = `${idPrefix}-r-${index}-amount`;
        const descId = `${idPrefix}-r-${index}-desc`;
        const fileId = `${idPrefix}-r-${index}-file`;

        const vendorErr = touched[`r:${index}:vendor`] ? itemError?.vendor || undefined : undefined;
        const numberErr = touched[`r:${index}:number`] ? itemError?.number || undefined : undefined;
        const dateInvalid = Boolean(invalidDates[`r:${index}:date`]);
        const dateErr = dateInvalid
          ? 'Enter a valid receipt date in MM/DD/YYYY format.'
          : touched[`r:${index}:date`] || Boolean(receipt.date && receipt.date > transactionDate)
            ? itemError?.date || ''
            : '';
        const overReceiptLimit = exceedsCentavos(receipt.amount, OFFICE_PETTY_RECEIPT_LIMIT);
        const amountErr =
          touched[`r:${index}:amount`] || overReceiptLimit ? itemError?.amount || undefined : undefined;
        const fileErr = touched[`r:${index}:path`] ? itemError?.path || '' : '';
        const removeTooltip = locked
          ? 'Wait for the current action or upload to finish.'
          : `Remove receipt ${index + 1} from this liquidation draft.`;

        return (
          <fieldset key={index} className={itemError?.duplicate ? 'opc-fieldset--error' : undefined}>
            <legend>
              Receipt {index + 1}
              {receipt.originLabel ? ` · From ${receipt.originLabel}` : ''}
            </legend>
            {itemError?.duplicate && (
              <p className="opc-field-error" role="alert">
                {itemError.duplicate}
              </p>
            )}
            <div className="opc-grid-2">
              <div className="opc-field">
                <label htmlFor={vendorId}>
                  Vendor{' '}
                  <span className="opc-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <BoundedTextInput
                  id={vendorId}
                  value={receipt.vendor}
                  maxLength={200}
                  disabled={locked}
                  aria-required="true"
                  error={vendorErr}
                  onBlur={() => markTouched(`r:${index}:vendor`)}
                  onChange={(event) => {
                    markTouched(`r:${index}:vendor`);
                    updateReceipt(index, { vendor: event.target.value });
                  }}
                />
              </div>
              <div className="opc-field">
                <label htmlFor={numberId}>
                  Receipt number{' '}
                  <span className="opc-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <BoundedTextInput
                  id={numberId}
                  value={receipt.number}
                  maxLength={100}
                  disabled={locked}
                  aria-required="true"
                  error={numberErr}
                  onBlur={() => markTouched(`r:${index}:number`)}
                  onChange={(event) => {
                    markTouched(`r:${index}:number`);
                    updateReceipt(index, { number: event.target.value });
                  }}
                />
              </div>
              <div className="opc-field">
                <label htmlFor={dateId}>
                  Date{' '}
                  <span className="opc-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <DateInput
                  id={dateId}
                  max={transactionDate}
                  value={receipt.date}
                  disabled={locked}
                  aria-required="true"
                  hasError={Boolean(dateErr)}
                  errorMessage={dateErr || undefined}
                  onInvalidTextChange={(invalid) => setDateInvalid(`r:${index}:date`, invalid)}
                  onBlur={() => markTouched(`r:${index}:date`)}
                  onChange={(event) => {
                    markTouched(`r:${index}:date`);
                    updateReceipt(index, { date: event.target.value });
                  }}
                />
                {dateErr && (
                  <span className="opc-field-error" role="alert">
                    {dateErr}
                  </span>
                )}
              </div>
              <div className="opc-field">
                <label htmlFor={amountId}>
                  Amount (maximum ₱5,000){' '}
                  <span className="opc-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <MoneyInput
                  id={amountId}
                  value={receipt.amount}
                  max={INPUT_LIMITS.MONEY_MAX_LINE}
                  availableMax={OFFICE_PETTY_RECEIPT_LIMIT}
                  showCeilingHint
                  externalError={amountErr}
                  disabled={locked}
                  aria-required="true"
                  onBlur={() => markTouched(`r:${index}:amount`)}
                  onValueChange={(value) => {
                    markTouched(`r:${index}:amount`);
                    updateReceipt(index, { amount: Number(value) });
                  }}
                />
              </div>
            </div>
            <div className="opc-field">
              <label htmlFor={descId}>Expense description (optional)</label>
              <BoundedTextInput
                id={descId}
                value={receipt.description ?? ''}
                maxLength={300}
                placeholder="e.g. Bond paper and printer ink"
                disabled={locked}
                error={itemError?.description || undefined}
                onChange={(event) => updateReceipt(index, { description: event.target.value })}
              />
            </div>
            <div className="opc-field">
              <label htmlFor={fileId}>
                {receipt.path ? 'Receipt attached' : 'Attach receipt · PDF / image, up to 10 MB'}{' '}
                <span className="opc-required" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id={fileId}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={locked}
                aria-required="true"
                aria-invalid={Boolean(fileErr) || undefined}
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
              {fileErr && (
                <span className="opc-field-error" role="alert">
                  {fileErr}
                </span>
              )}
            </div>
            <div>
              <WorkspaceTooltip content={removeTooltip} disabled={!removeTooltip}>
                <span className="inline-flex">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setInvalidDates((prev) => {
                        const next = { ...prev };
                        delete next[`r:${index}:date`];
                        return next;
                      });
                      onReceiptsChange(receipts.filter((_, idx) => idx !== index));
                    }}
                  >
                    Remove receipt
                  </button>
                </span>
              </WorkspaceTooltip>
            </div>
          </fieldset>
        );
      })}

      <div>
        <WorkspaceTooltip content={addTooltip} disabled={!addTooltip}>
          <span className="inline-flex">
            <button
              type="button"
              disabled={addDisabled}
              onClick={() =>
                onReceiptsChange([
                  ...receipts,
                  { vendor: '', number: '', date: transactionDate, amount: 0, path: '', description: '' },
                ])
              }
            >
              Add receipt
            </button>
          </span>
        </WorkspaceTooltip>
      </div>

      {validation.requiresCashReturn && (
        <section className="opc-return-card" aria-label="Return unused cash">
          <div className="opc-return-card__header">
            <strong>Return unused cash · {peso.format(validation.unusedCash)}</strong>
            <span>Required when spending is less than released cash</span>
          </div>
          <div className="opc-grid-2">
            <div className="opc-field">
              <label htmlFor={refundNumberId}>
                Official refund receipt number{' '}
                <span className="opc-required" aria-hidden="true">
                  *
                </span>
              </label>
              <BoundedTextInput
                id={refundNumberId}
                value={refundReceiptNumber}
                maxLength={100}
                placeholder="e.g. OR-REF-2026-01"
                disabled={locked}
                aria-required="true"
                error={refundNumberError}
                onBlur={() => markTouched('refundNumber')}
                onChange={(event) => {
                  markTouched('refundNumber');
                  onRefundReceiptNumberChange(event.target.value);
                }}
              />
            </div>
            <div className="opc-field">
              <label htmlFor={refundDateId}>
                Cash return date{' '}
                <span className="opc-required" aria-hidden="true">
                  *
                </span>
              </label>
              <DateInput
                id={refundDateId}
                max={transactionDate}
                value={refundDate}
                disabled={locked}
                aria-required="true"
                hasError={Boolean(refundDateError)}
                errorMessage={refundDateError || undefined}
                onInvalidTextChange={(invalid) => setDateInvalid('refundDate', invalid)}
                onBlur={() => markTouched('refundDate')}
                onChange={(event) => {
                  markTouched('refundDate');
                  onRefundDateChange(event.target.value);
                }}
              />
              {refundDateError && (
                <span className="opc-field-error" role="alert">
                  {refundDateError}
                </span>
              )}
            </div>
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
