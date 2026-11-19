import { useMemo, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { DateInput } from '../../../components/ui/DateInput';
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { getPhilippineCalendarDate } from '../../../shared/calendarDates';
import { OfficeReceiptsForm } from './OfficeReceiptsForm';
import {
  computeReturnedAmount,
  validateOfficeReceiptsSubmission,
} from '../validation/officeCashValidation';
import type { OfficeCashCommand, OfficeCashRequest, OfficeReceipt, PettyAction } from '../types';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

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
  onClose,
  onSubmit,
}: {
  action: PettyAction;
  request?: OfficeCashRequest;
  maximum: number;
  pending: OfficeCashCommand | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (command: OfficeCashCommand) => Promise<void>;
}) {
  const today = getPhilippineCalendarDate();
  const [amount, setAmount] = useState(Number(pending?.data.amount) || 0);
  const [reference, setReference] = useState(
    String(pending?.data.reference ?? (action === 'receipts' ? request?.liquidation_note || '' : '')),
  );
  const [date, setDate] = useState(String(pending?.data.date || today));
  const [receipts, setReceipts] = useState<OfficeReceipt[]>(
    () => (pending?.data.receipts as OfficeReceipt[]) || (action === 'receipts' ? request?.receipts || [] : []),
  );
  const [refundReceiptNumber, setRefundReceiptNumber] = useState(
    String(pending?.data.refundReceiptNumber ?? (action === 'receipts' ? request?.refund_receipt_number || '' : '')),
  );
  const [refundDate, setRefundDate] = useState(
    String(pending?.data.refundDate ?? (action === 'receipts' ? request?.refund_date || today : today)),
  );
  const [localError, setLocalError] = useState('');
  const [uploading, setUploading] = useState(false);

  const lock = busy || uploading || !!pending;
  const money = action === 'request' || action === 'replenish';
  const returnedAmount = request ? computeReturnedAmount(request) : 0;
  const spentAmount = Number(request?.spent ?? 0);
  const settleReturnBlocked = action === 'settle' && returnedAmount > 0 && request?.returnApproved === false;
  const isHeadFallbackSettle = action === 'settle' && Boolean(request?.headCanSettle) && !request?.canSettle;

  const receiptsValidation = useMemo(
    () =>
      validateOfficeReceiptsSubmission({
        releasedAmount: request?.amount || 0,
        transactionDate: date,
        reference,
        receipts,
        refundReceiptNumber,
        refundDate,
        todayManila: today,
      }),
    [request?.amount, date, reference, receipts, refundReceiptNumber, refundDate, today],
  );

  const valid =
    action === 'receipts'
      ? receiptsValidation.isValid
      : Boolean(
          reference.trim() &&
            date &&
            date <= today &&
            (!money || (amount > 0 && amount <= maximum)) &&
            !settleReturnBlocked,
        );

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
      return {
        key: crypto.randomUUID(),
        action,
        data: {
          request: request?.id,
          amount,
          reference: reference.trim(),
          date,
          receipts,
          ...(receiptsValidation.requiresCashReturn
            ? {
                refundReceiptNumber: refundReceiptNumber.trim(),
                refundDate,
              }
            : {}),
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
              ? ` Unused cash of ${peso.format(returnedAmount)} still requires Accounting receipt acknowledgment and Head return approval before settlement.`
              : ' Accounting will still need to settle these receipts.'
            : ''}
      </>
    );

    return (
      <DecisionModal
        title={`${actionLabels[action]}?`}
        description={description}
        decision={action === 'reject' ? 'reject' : action === 'return_receipts' ? 'changes' : 'approve'}
        reason={reference}
        onReasonChange={pending ? undefined : setReference}
        reasonLabel={decisionReasonLabel}
        maxReasonLength={1000}
        preventClose={!!pending}
        requireReason
        busy={busy}
        disabled={uploading || (!pending && !valid)}
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
    (money && amount > maximum
      ? 'Amount exceeds the available office petty cash.'
      : action === 'receipts' && receiptsValidation.totalError
        ? receiptsValidation.totalError
        : action === 'receipts' && receipts.some((r) => r.amount > 5000)
          ? 'Each receipt must be at most ₱5,000.'
          : settleReturnBlocked
            ? 'Accounting must acknowledge physical receipt and the Office Head must approve the cash return before settlement.'
            : '');

  return (
    <Modal
      isOpen
      title={isHeadFallbackSettle ? 'Settle petty cash (Head fallback)' : actionLabels[action]}
      onClose={onClose}
      preventClose={lock}
      width="max-w-2xl"
      footer={
        <div className="opc-dialog-actions">
          <button type="button" disabled={lock} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="opc-primary"
            disabled={busy || uploading || (!pending && !valid)}
            onClick={submit}
          >
            {busy
              ? 'Saving…'
              : pending
                ? resumeLabel
                : isHeadFallbackSettle
                  ? 'Confirm Head fallback settlement'
                  : actionLabels[action]}
          </button>
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
          <label>
            Amount · available up to ₱{maximum.toLocaleString()}
            <MoneyInput
              value={amount}
              max={maximum}
              onValueChange={(value) => setAmount(Number(value))}
              disabled={lock}
            />
          </label>
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
            onReceiptsChange={setReceipts}
            onRefundReceiptNumberChange={setRefundReceiptNumber}
            onRefundDateChange={setRefundDate}
            onUploadingChange={setUploading}
            onUploadError={setLocalError}
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
                {request.refund_receipt_number ? `Refund OR: ${request.refund_receipt_number}. ` : ''}
                {request.cash_return_receive_reference
                  ? `Accounting receipt ref: ${request.cash_return_receive_reference}. `
                  : ''}
                {request.cash_return_approval_note
                  ? `Head return approval: ${request.cash_return_approval_note}. `
                  : ''}
                Settling credits <strong>{peso.format(returnedAmount)}</strong> back to the office petty cash fund and
                makes <strong>{peso.format(spentAmount)}</strong> eligible for replenishment.
              </p>
            )}
          </>
        )}

        <label>
          {action === 'request'
            ? 'Purpose'
            : action === 'receipts'
              ? 'Liquidation note / transaction reference'
              : 'Reason / transaction reference'}
          <textarea
            value={reference}
            maxLength={1000}
            disabled={lock}
            onChange={(event) => setReference(event.target.value)}
          />
        </label>

        <label>
          Transaction date
          <DateInput max={today} value={date} disabled={lock} onChange={(event) => setDate(event.target.value)} />
        </label>

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
