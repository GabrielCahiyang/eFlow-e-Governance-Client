import { useId, useMemo, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { DateInput } from '../../../components/ui/DateInput';
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { getPhilippineCalendarDate, isCalendarDate } from '../../../shared/calendarDates';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import { exceedsCentavos, formatPeso } from '../../../shared/currency';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { OfficeReceiptsForm } from './OfficeReceiptsForm';
import {
  OFFICE_PETTY_RECEIPT_LIMIT,
  computeReturnedAmount,
  validateOfficeReceiptsSubmission,
} from '../validation/officeCashValidation';
import type { OfficeCashCommand, OfficeCashRequest, OfficeReceipt, PettyAction } from '../types';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const MIN_REFERENCE_LENGTH = 5;
const MAX_REFERENCE_LENGTH = 1000;

export const actionLabels: Record<PettyAction, string> = {
  request: 'Request petty cash',
  replenish: 'Replenish fund',
  approve: 'Approve request',
  reject: 'Reject request',
  release: 'Record cash release',
  cancel: 'Cancel request',
  receipts: 'Submit receipts',
  endorse: 'Endorse receipts',
  return_receipts: 'Return receipts for correction',
  acknowledge_return: 'Acknowledge cash received',
  approve_return: 'Approve cash return',
  settle: 'Settle petty cash',
};

const resumeLabel = 'Resume cash action';
const unconfirmedAction =
  'We couldn’t confirm this cash action. Resume the same attempt to finish it or confirm it was already recorded.';

const DECISION_ACTIONS: readonly PettyAction[] = [
  'approve',
  'reject',
  'endorse',
  'return_receipts',
  'acknowledge_return',
  'approve_return',
];

export function OfficeCashDialog({
  action,
  request,
  maximum,
  pending,
  busy,
  error,
  returnOnly = false,
  onClose,
  onSubmit,
}: {
  action: PettyAction;
  request?: OfficeCashRequest;
  maximum: number;
  pending: OfficeCashCommand | null;
  busy: boolean;
  error: string;
  returnOnly?: boolean;
  onClose: () => void;
  onSubmit: (command: OfficeCashCommand) => Promise<void>;
}) {
  const today = getPhilippineCalendarDate();
  const amountId = useId();
  const referenceId = useId();
  const dateId = useId();
  const assignedAmount = Number(request?.assignedAmount ?? 0);
  const canAttachReceipts = assignedAmount > 0;
  const returnedAmount = request ? computeReturnedAmount(request) : 0;
  const spentAmount = Number(request?.spent ?? 0);
  const [returnOnlyMode, setReturnOnlyMode] = useState(
    Boolean(action === 'receipts' && (returnOnly || !canAttachReceipts)),
  );
  const [amount, setAmount] = useState(Number(pending?.data.amount) || 0);
  const [amountTouched, setAmountTouched] = useState(false);
  const [reference, setReference] = useState(
    String(
      pending?.data.reference ??
        (action === 'receipts'
          ? request?.liquidation_note || ''
          : action === 'settle' && returnedAmount > 0
            ? request?.cash_return_receive_reference || ''
            : ''),
    ),
  );
  const [referenceTouched, setReferenceTouched] = useState(false);
  const [date, setDate] = useState(String(pending?.data.date || today));
  const [dateTouched, setDateTouched] = useState(false);
  const [dateInvalidText, setDateInvalidText] = useState(false);
  const [receipts, setReceipts] = useState<OfficeReceipt[]>(() => {
    if (pending?.data.receipts) return pending.data.receipts as OfficeReceipt[];
    if (action !== 'receipts' || returnOnly || !canAttachReceipts) return [];
    const approvedByPath = new Map(
      (request?.assignmentReceipts ?? [])
        .filter((item) => item.locked === true || item.receiptReviewStatus === 'approved')
        .map((item) => [item.path, item]),
    );
    if (request?.receipts?.length) {
      return request.receipts.map((item) => {
        const match = approvedByPath.get(item.path);
        return match
          ? {
              ...item,
              locked: true,
              approvedByName: match.accountingDecidedByName || undefined,
            }
          : item;
      });
    }
    if (request?.assignmentReceipts?.length) {
      return request.assignmentReceipts.map((item) => ({
        vendor: item.vendor,
        number: item.number,
        date: item.date,
        amount: item.amount,
        path: item.path,
        description: item.description ?? '',
        originLabel: item.subtaskTitle
          ? `${item.taskTitle} → ${item.subtaskTitle}${item.uploadedByName ? ` · ${item.uploadedByName}` : ''}`
          : `${item.taskTitle}${item.uploadedByName ? ` · ${item.uploadedByName}` : ''}`,
        locked: item.locked === true || item.receiptReviewStatus === 'approved',
        approvedByName: item.accountingDecidedByName || undefined,
      }));
    }
    return [];
  });
  const [refundReceiptNumber, setRefundReceiptNumber] = useState(
    String(pending?.data.refundReceiptNumber ?? (action === 'receipts' ? request?.refund_receipt_number || '' : '')),
  );
  const [refundDate, setRefundDate] = useState(
    String(pending?.data.refundDate ?? (action === 'receipts' ? request?.refund_date || today : today)),
  );
  const [localError, setLocalError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [receiptDatesInvalid, setReceiptDatesInvalid] = useState(false);

  const lock = busy || uploading || !!pending;
  const money = action === 'request' || action === 'replenish';
  const isHeadFallbackSettle = action === 'settle' && Boolean(request?.headCanSettle) && !request?.canSettle;
  // Accounting's click on "Confirm return & settle" is the attestation; the OR # is optional.
  const optionalSettleReference = action === 'settle' && returnedAmount > 0;

  const referenceLabel =
    action === 'request'
      ? 'Purpose'
      : action === 'receipts'
        ? returnOnlyMode
          ? 'Return reason / transaction reference'
          : 'Liquidation note / transaction reference'
        : optionalSettleReference
          ? 'Your receiving OR # (optional)'
          : 'Reason / transaction reference';

  const receiptsValidation = useMemo(
    () =>
      validateOfficeReceiptsSubmission({
        releasedAmount: request?.amount || 0,
        assignedAmount,
        transactionDate: date,
        reference,
        receipts,
        refundReceiptNumber,
        refundDate,
        todayManila: today,
      }),
    [request?.amount, assignedAmount, date, reference, receipts, refundReceiptNumber, refundDate, today],
  );

  const amountExceedsMax = money && exceedsCentavos(amount, maximum);
  const amountError = !money
    ? ''
    : !Number.isFinite(amount) || amount <= 0
      ? 'Enter an amount greater than ₱0.00.'
      : amountExceedsMax
        ? action === 'replenish'
          ? `Amount exceeds the ${formatPeso(maximum)} eligible for replenishment.`
          : `Amount exceeds the available office petty cash (${formatPeso(maximum)}).`
        : '';
  const visibleAmountError = amountExceedsMax || amountTouched ? amountError : '';

  const referenceError = optionalSettleReference
    ? reference.trim().length > MAX_REFERENCE_LENGTH
      ? `${referenceLabel} must be ${MAX_REFERENCE_LENGTH} characters or less.`
      : ''
    : textLengthError(reference, referenceLabel, {
        required: true,
        min: MIN_REFERENCE_LENGTH,
        max: MAX_REFERENCE_LENGTH,
      }) || '';
  const visibleReferenceError =
    referenceTouched || reference.length > 0 ? referenceError : '';

  const dateError = dateInvalidText
    ? 'Enter a valid transaction date in MM/DD/YYYY format.'
    : !date
      ? 'Enter the transaction date.'
      : !isCalendarDate(date)
        ? 'Transaction date must be a valid date.'
        : date > today
          ? `Transaction date cannot be after ${formatManilaDate(today, today)}.`
          : '';
  const visibleDateError =
    dateTouched || dateInvalidText || Boolean(date && date > today) ? dateError : '';

  const valid =
    action === 'receipts'
      ? receiptsValidation.isValid && !referenceError && !dateInvalidText && !receiptDatesInvalid
      : Boolean(!referenceError && !dateError && !amountError);

  const submitBlockedReason =
    pending || valid
      ? ''
      : amountError ||
        referenceError ||
        dateError ||
        (action === 'receipts' && receiptDatesInvalid
          ? 'Enter valid receipt and cash return dates in MM/DD/YYYY format.'
          : '') ||
        (action === 'receipts' ? receiptsValidation.blockingErrors[0] || '' : '');

  const buildCommand = (): OfficeCashCommand => {
    if (pending) return pending;
    if (action === 'acknowledge_return' || action === 'approve_return') {
      return {
        key: crypto.randomUUID(),
        action,
        data: {
          request: request?.id,
          reference: reference.trim(),
          date,
          ...(request?.receipt_version !== undefined ? { receiptVersion: request.receipt_version } : {}),
        },
      };
    }
    if (action === 'receipts') {
      const sanitizedReceipts = receipts.map(
        ({ originLabel: _originLabel, locked: _locked, approvedByName: _approvedByName, ...rest }) => rest,
      );
      return {
        key: crypto.randomUUID(),
        action,
        data: {
          request: request?.id,
          amount,
          reference: reference.trim(),
          date,
          receipts: sanitizedReceipts,
          ...(receiptsValidation.requiresCashReturn
            ? {
                refundReceiptNumber: refundReceiptNumber.trim(),
                refundDate,
              }
            : {}),
        },
      };
    }
    if (action === 'settle') {
      const typedRef = reference.trim();
      const effectiveRef =
        typedRef ||
        (returnedAmount > 0
          ? request?.refund_receipt_number?.trim() ||
            `Accounting confirmed physical receipt of ${peso.format(returnedAmount)} unused cash on ${formatManilaDate(date, date)}`
          : '');
      return {
        key: crypto.randomUUID(),
        action,
        data: {
          request: request?.id,
          amount,
          reference: effectiveRef || 'Receipts verified and settled',
          ...(returnedAmount > 0 ? { returnReference: effectiveRef } : {}),
          date,
          receipts,
        },
      };
    }
    return {
      key: crypto.randomUUID(),
      action,
      data: { request: request?.id, amount, reference: reference.trim(), date, receipts },
    };
  };

  const submit = () => void onSubmit(buildCommand());

  if (DECISION_ACTIONS.includes(action)) {
    const isReturnAck = action === 'acknowledge_return';
    const isReturnApprove = action === 'approve_return';
    const decisionReasonLabel = isReturnAck
      ? 'Receiving reference'
      : isReturnApprove
        ? 'Return approval note'
        : 'Reason / transaction reference';

    const description = isReturnAck ? (
      <>
        <strong>{request?.purpose}</strong> · Return amount <strong>{peso.format(returnedAmount)}</strong>
        {request?.refund_receipt_number ? ` · Refund OR ${request.refund_receipt_number}` : ''}. Confirm you physically
        received {peso.format(returnedAmount)}. This does not approve the return.
      </>
    ) : isReturnApprove ? (
      <>
        <strong>{request?.purpose}</strong> · Return amount <strong>{peso.format(returnedAmount)}</strong>
        {request?.refund_receipt_number ? ` · Refund OR ${request.refund_receipt_number}` : ''}.{' '}
        {request?.returnHeadFallback ? (
          <>
            No independent Accounting Officer is available in this office. Confirm you physically verified and approve
            the {peso.format(returnedAmount)} cash return under audited Head fallback. Settlement is a separate action.
          </>
        ) : (
          <>
            {request?.cash_return_receive_reference
              ? `Accounting receiving ref: "${request.cash_return_receive_reference}". `
              : ''}
            Verify the {peso.format(returnedAmount)} return and Accounting acknowledgment. Settlement is a separate
            action.
          </>
        )}
      </>
    ) : (
      <>
        <strong>{request?.purpose}</strong> · ₱{Number(request?.amount || 0).toLocaleString()}
        {action === 'approve'
          ? ' This approves the request. Accounting records the cash release separately.'
          : action === 'endorse'
            ? returnedAmount > 0
              ? ` Accounting will confirm physical receipt of the ${peso.format(returnedAmount)} unused cash return and settle in one step.`
              : ' Accounting will still need to settle these receipts.'
            : ''}
      </>
    );

    const decisionDisabledReason = uploading
      ? 'Wait for the receipt upload to finish before continuing.'
      : !pending && !valid
        ? submitBlockedReason
        : '';

    return (
      <DecisionModal
        title={`${actionLabels[action]}?`}
        description={description}
        decision={action === 'reject' ? 'reject' : action === 'return_receipts' ? 'changes' : 'approve'}
        reason={reference}
        onReasonChange={pending ? undefined : setReference}
        reasonLabel={decisionReasonLabel}
        minReasonLength={MIN_REFERENCE_LENGTH}
        maxReasonLength={MAX_REFERENCE_LENGTH}
        preventClose={!!pending}
        requireReason
        busy={busy}
        disabled={uploading || (!pending && !valid)}
        disabledReason={decisionDisabledReason}
        error={error}
        confirmLabel={pending ? resumeLabel : actionLabels[action]}
        onCancel={onClose}
        onConfirm={submit}
      >
        {pending && <p role="status">{unconfirmedAction}</p>}
      </DecisionModal>
    );
  }

  const inlineError =
    error ||
    localError ||
    (action === 'receipts' && receiptsValidation.totalError
      ? receiptsValidation.totalError
      : action === 'receipts' && receipts.some((r) => exceedsCentavos(r.amount, OFFICE_PETTY_RECEIPT_LIMIT))
        ? `Each receipt must be at most ${formatPeso(OFFICE_PETTY_RECEIPT_LIMIT)}.`
        : '');

  const primaryLabel = busy
    ? 'Saving…'
    : pending
      ? resumeLabel
      : isHeadFallbackSettle
        ? 'Confirm Head fallback settlement'
        : action === 'settle' && returnedAmount > 0
          ? 'Confirm return & settle'
          : action === 'receipts' && returnOnlyMode && receipts.length === 0
            ? 'Return unused cash'
            : actionLabels[action];
  const submitDisabled = busy || uploading || (!pending && !valid);
  const submitBlocked = submitDisabled && !busy && !uploading ? submitBlockedReason : '';
  const submitWarningTip =
    !submitDisabled && action === 'cancel'
      ? 'Permanently cancels this petty cash request. This cannot be undone.'
      : '';

  return (
    <Modal
      isOpen
      title={
        isHeadFallbackSettle
          ? returnedAmount > 0
            ? 'Confirm cash return & settle (Head fallback)'
            : 'Settle petty cash (Head fallback)'
          : action === 'settle' && returnedAmount > 0
            ? 'Confirm cash return & settle'
            : action === 'receipts' && returnOnlyMode && receipts.length === 0
              ? 'Return unused petty cash'
              : actionLabels[action]
      }
      onClose={onClose}
      preventClose={lock}
      width="max-w-2xl"
      footer={
        <div className="opc-dialog-actions">
          <button type="button" disabled={lock} onClick={onClose}>
            Cancel
          </button>
          <ActionBlockerGroup
            actionLabel={primaryLabel}
            blockers={submitBlocked}
            busy={busy || uploading}
          >
            <WorkspaceTooltip content={submitWarningTip} disabled={!submitWarningTip}>
              <span className="inline-flex">
                <button
                  type="button"
                  className="opc-primary"
                  disabled={submitDisabled}
                  onClick={submit}
                >
                  {primaryLabel}
                </button>
              </span>
            </WorkspaceTooltip>
          </ActionBlockerGroup>
        </div>
      }
    >
      <div className="opc-form">
        <p>
          {action === 'replenish'
            ? 'Replenish money used for settled expenses. Enter the amount and reference below. Unsettled cash cannot be replenished yet.'
            : request
              ? `${request.purpose} · Amount ₱${Number(request.amount).toLocaleString()}`
              : 'Uses office petty cash only. Does not deduct from a project or task budget.'}
        </p>

        {action === 'request' && maximum <= 0 && !pending && (
          <div className="opc-error" role="alert">
            No petty cash is available. Cancel an unused request or ask Accounting to replenish settled expenses. You
            can fill out this form or cancel.
          </div>
        )}

        {money && (
          <div className="opc-field">
            <label htmlFor={amountId}>
              Amount · available up to {formatPeso(maximum)}{' '}
              <span className="opc-required" aria-hidden="true">
                *
              </span>
            </label>
            <MoneyInput
              id={amountId}
              value={amount}
              max={INPUT_LIMITS.MONEY_MAX_BUDGET}
              availableMax={maximum}
              showCeilingHint
              externalError={visibleAmountError || undefined}
              onValueChange={(value) => {
                setAmountTouched(true);
                setAmount(Number(value));
              }}
              onBlur={() => setAmountTouched(true)}
              disabled={lock}
            />
          </div>
        )}

        {action === 'receipts' && request && (
          <OfficeReceiptsForm
            request={request}
            transactionDate={date}
            receipts={receipts}
            refundReceiptNumber={refundReceiptNumber}
            refundDate={refundDate}
            validation={receiptsValidation}
            locked={lock}
            canAttachReceipts={canAttachReceipts}
            assignedAmount={assignedAmount}
            returnOnlyMode={returnOnlyMode}
            onExitReturnOnlyMode={canAttachReceipts ? () => setReturnOnlyMode(false) : undefined}
            onReceiptsChange={setReceipts}
            onRefundReceiptNumberChange={setRefundReceiptNumber}
            onRefundDateChange={setRefundDate}
            onUploadingChange={setUploading}
            onUploadError={setLocalError}
            onInvalidDateChange={setReceiptDatesInvalid}
          />
        )}

        {action === 'settle' && request && (
          <>
            {isHeadFallbackSettle && (
              <div className="opc-banner opc-banner--warning" role="status">
                <strong>Audited Head fallback settlement:</strong> No eligible independent Accounting Officer is
                available in this office. Your settlement will be logged as a Head fallback action.
              </div>
            )}
            <div className="opc-reconcile" aria-label="Settlement breakdown">
              <div>
                <span>Released cash</span>
                <strong>{peso.format(request.amount)}</strong>
              </div>
              <div>
                <span>Verified receipts</span>
                <strong>{peso.format(spentAmount)}</strong>
              </div>
              <div>
                <span>Cash returned to fund</span>
                <strong className={returnedAmount > 0 ? 'opc-text-primary' : undefined}>
                  {peso.format(returnedAmount)}
                </strong>
              </div>
            </div>
            {returnedAmount > 0 && (
              <p className="opc-hint">
                {request.refund_receipt_number ? `Requester refund note/OR: ${request.refund_receipt_number}. ` : ''}
                Confirming below means you physically received <strong>{peso.format(returnedAmount)}</strong>. This
                credits <strong>{peso.format(returnedAmount)}</strong> back to the office petty cash fund in one step
                {spentAmount > 0 ? (
                  <>
                    , making <strong>{peso.format(spentAmount)}</strong> eligible for replenishment
                  </>
                ) : null}
                . Your name and the time are recorded in the audit trail
                {request.refund_receipt_number
                  ? ' and the requester’s refund OR is used unless you enter your own OR # below.'
                  : '; add your own OR # below if you have one.'}
              </p>
            )}
          </>
        )}

        <div className="opc-field">
          <label htmlFor={referenceId}>
            {referenceLabel}{' '}
            {!optionalSettleReference && (
              <span className="opc-required" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <BoundedTextarea
            id={referenceId}
            value={reference}
            maxLength={MAX_REFERENCE_LENGTH}
            rows={3}
            disabled={lock}
            placeholder={
              action === 'request'
                ? 'Describe what the petty cash will be used for (at least 5 characters)'
                : action === 'receipts'
                  ? returnOnlyMode
                    ? 'Explain why the unused petty cash is being returned (at least 5 characters)'
                    : 'Summarize the receipts or liquidation reference (at least 5 characters)'
                  : action === 'settle' && returnedAmount > 0
                    ? request?.refund_receipt_number
                      ? `Optional — leave blank to use Refund OR ${request.refund_receipt_number}`
                      : 'Optional official receiving OR # (leave blank if none)'
                    : 'Enter the reason or transaction reference (at least 5 characters)'
            }
            error={visibleReferenceError || undefined}
            onChange={(event) => setReference(event.target.value)}
            onBlur={() => setReferenceTouched(true)}
          />
        </div>

        <div className="opc-field">
          <label htmlFor={dateId}>
            Transaction date{' '}
            <span className="opc-required" aria-hidden="true">
              *
            </span>
          </label>
          <DateInput
            id={dateId}
            max={today}
            value={date}
            disabled={lock}
            hasError={Boolean(visibleDateError)}
            errorMessage={visibleDateError || undefined}
            onInvalidTextChange={setDateInvalidText}
            onChange={(event) => {
              setDateTouched(true);
              setDate(event.target.value);
            }}
            onBlur={() => setDateTouched(true)}
          />
          {visibleDateError && (
            <span className="opc-field-error" role="alert">
              {visibleDateError}
            </span>
          )}
        </div>

        {inlineError && (
          <div className="opc-error" role="alert">
            {inlineError}
          </div>
        )}
        {pending && <p role="status">{unconfirmedAction}</p>}
      </div>
    </Modal>
  );
}
