import { computeReturnedAmount } from '../validation/officeCashValidation';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import type { OfficeCashRequest } from '../types';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export function OfficeCashReturnBadge({ request }: { request: OfficeCashRequest }) {
  if (!['receipt_review', 'receipt_approved', 'settled'].includes(request.status)) return null;
  const returned = computeReturnedAmount(request);
  if (returned <= 0) return null;

  const received = Boolean(request.returnReceived ?? request.cash_return_received_at);
  const settled = request.status === 'settled';
  const tone = settled ? 'positive' : received ? 'info' : 'warning';
  const stepText = settled
    ? `Returned ${peso.format(returned)} to fund`
    : request.returnHeadFallback
      ? `Returning ${peso.format(returned)} — awaiting Head fallback confirmation & settlement`
      : `Returning ${peso.format(returned)} — awaiting Accounting confirmation & settlement`;

  return (
    <div className={`opc-return-status opc-return-status--${tone}`}>
      <span>{stepText}</span>
      {request.refund_receipt_number && (
        <small>
          Refund OR: {request.refund_receipt_number}
          {request.refund_date ? ` · ${formatManilaDate(request.refund_date, request.refund_date)}` : ''}
        </small>
      )}
      {request.cash_return_receive_reference && (received || settled) && (
        <small>
          Receiving ref: {request.cash_return_receive_reference}
          {request.cashReturnReceivedByName ? ` (${request.cashReturnReceivedByName})` : ''}
        </small>
      )}
    </div>
  );
}
