import { computeReturnedAmount } from '../validation/officeCashValidation';
import type { OfficeCashRequest } from '../types';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export function OfficeCashReturnBadge({ request }: { request: OfficeCashRequest }) {
  if (!['receipt_review', 'receipt_approved', 'settled'].includes(request.status)) return null;
  const returned = computeReturnedAmount(request);
  if (returned <= 0) return null;

  const received = Boolean(request.returnReceived ?? request.cash_return_received_at);
  const approved = Boolean(
    request.returnApproved !== undefined
      ? request.returnApproved
      : request.status === 'settled' || Boolean(request.cash_return_approved_at),
  );

  const tone = approved ? 'positive' : received ? 'info' : 'warning';
  const stepText = approved
    ? request.status === 'settled'
      ? `Returned ${peso.format(returned)} to fund`
      : `Return ${peso.format(returned)} approved by Head`
    : received
      ? `Return ${peso.format(returned)} received by Accounting — awaiting Head approval`
      : request.returnHeadFallback
        ? `Return ${peso.format(returned)} — awaiting Head fallback confirmation`
        : `Return ${peso.format(returned)} — awaiting Accounting receipt`;

  return (
    <div className={`opc-return-status opc-return-status--${tone}`}>
      <span>{stepText}</span>
      {request.refund_receipt_number && (
        <small>
          Refund OR: {request.refund_receipt_number}
          {request.refund_date ? ` · ${request.refund_date}` : ''}
        </small>
      )}
      {request.cash_return_receive_reference && received && (
        <small>
          Receiving ref: {request.cash_return_receive_reference}
          {request.cashReturnReceivedByName ? ` (${request.cashReturnReceivedByName})` : ''}
        </small>
      )}
    </div>
  );
}
