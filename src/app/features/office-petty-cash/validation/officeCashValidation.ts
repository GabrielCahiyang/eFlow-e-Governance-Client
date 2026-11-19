import { getPhilippineCalendarDate, isCalendarDate } from '../../../shared/calendarDates';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import type { OfficeCashRequest, OfficeReceipt } from '../types';

export const OFFICE_PETTY_CASH_CEILING = 30000;
export const OFFICE_PETTY_RECEIPT_LIMIT = 5000;
export const OFFICE_PETTY_MAX_RECEIPTS = 30;

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function computeReturnedAmount(
  request: Pick<OfficeCashRequest, 'amount' | 'spent' | 'returned_amount'>,
): number {
  if (typeof request.returned_amount === 'number' && Number.isFinite(request.returned_amount)) {
    return Math.max(0, toCents(request.returned_amount) / 100);
  }
  const releasedCents = Math.max(0, toCents(request.amount));
  const spentCents = Math.max(0, toCents(request.spent ?? 0));
  return Math.max(0, releasedCents - spentCents) / 100;
}

export interface LiquidationDueStatus {
  dueDate: string;
  formattedDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  label: string;
}

export function getLiquidationDueStatus(
  dueAt?: string | null,
  todayManila = getPhilippineCalendarDate(),
): LiquidationDueStatus | null {
  if (!dueAt) return null;
  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const dueDate = getPhilippineCalendarDate(parsed);
  const dueMs = Date.parse(`${dueDate}T00:00:00Z`);
  const todayMs = Date.parse(`${todayManila}T00:00:00Z`);
  const daysRemaining = Math.round((dueMs - todayMs) / 86_400_000);
  const isOverdue = daysRemaining < 0;
  const formattedDate = formatManilaDate(parsed, dueDate);
  const label = isOverdue
    ? `Overdue by ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'day' : 'days'} (due ${formattedDate})`
    : daysRemaining === 0
      ? `Due today (${formattedDate})`
      : `Due ${formattedDate} (${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left)`;
  return { dueDate, formattedDate, daysRemaining, isOverdue, label };
}

export interface OfficeReceiptItemError {
  vendor: string;
  number: string;
  date: string;
  amount: string;
  description: string;
  path: string;
  duplicate: string;
  hasError: boolean;
}

export interface OfficeReceiptsValidationResult {
  releasedCents: number;
  receiptTotalCents: number;
  unusedCents: number;
  overReleasedCents: number;
  releasedAmount: number;
  receiptTotal: number;
  unusedCash: number;
  exceedsReleased: boolean;
  requiresCashReturn: boolean;
  transactionDateError: string;
  referenceError: string;
  countError: string;
  totalError: string;
  refundReceiptNumberError: string;
  refundDateError: string;
  receipts: OfficeReceiptItemError[];
  blockingErrors: string[];
  isValid: boolean;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export function validateOfficeReceiptsSubmission(input: {
  releasedAmount: number;
  transactionDate: string;
  reference: string;
  receipts: OfficeReceipt[];
  refundReceiptNumber: string;
  refundDate: string;
  todayManila?: string;
}): OfficeReceiptsValidationResult {
  const today = input.todayManila ?? getPhilippineCalendarDate();
  const releasedCents = Math.max(0, toCents(input.releasedAmount));
  const receiptTotalCents = input.receipts.reduce(
    (sum, receipt) => sum + (Number.isFinite(receipt.amount) && receipt.amount > 0 ? toCents(receipt.amount) : 0),
    0,
  );
  const overReleasedCents = receiptTotalCents > releasedCents ? receiptTotalCents - releasedCents : 0;
  const exceedsReleased = overReleasedCents > 0;
  const unusedCents = releasedCents > receiptTotalCents ? releasedCents - receiptTotalCents : 0;
  const requiresCashReturn = unusedCents > 0;

  const blockingErrors: string[] = [];

  const transactionDateError = !input.transactionDate
    ? 'Enter the transaction date.'
    : !isCalendarDate(input.transactionDate)
      ? 'Transaction date must be a valid date.'
      : input.transactionDate > today
        ? 'Transaction date cannot be in the future.'
        : '';
  if (transactionDateError) blockingErrors.push(transactionDateError);

  const trimmedRef = input.reference.trim();
  const referenceError = !trimmedRef
    ? 'Enter a liquidation note or transaction reference.'
    : trimmedRef.length > 1000
      ? 'Liquidation note must be 1,000 characters or less.'
      : '';
  if (referenceError) blockingErrors.push(referenceError);

  const countError =
    input.receipts.length > OFFICE_PETTY_MAX_RECEIPTS
      ? `Add at most ${OFFICE_PETTY_MAX_RECEIPTS} receipts.`
      : '';
  if (countError) blockingErrors.push(countError);

  const totalError = exceedsReleased
    ? `Receipt total (${peso.format(receiptTotalCents / 100)}) exceeds the released cash (${peso.format(releasedCents / 100)}) by ${peso.format(overReleasedCents / 100)}.`
    : '';
  if (totalError) blockingErrors.push(totalError);

  const seenFingerprints = new Set<string>();
  const seenPaths = new Set<string>();

  const receipts: OfficeReceiptItemError[] = input.receipts.map((receipt, index) => {
    const label = `Receipt ${index + 1}`;
    const vendorTrimmed = receipt.vendor.trim();
    const numberTrimmed = receipt.number.trim();
    const descTrimmed = (receipt.description ?? '').trim();

    const vendor = !vendorTrimmed
      ? 'Enter the vendor or payee name.'
      : vendorTrimmed.length > 200
        ? 'Vendor name must be 200 characters or less.'
        : '';

    const number = !numberTrimmed
      ? 'Enter the receipt number.'
      : numberTrimmed.length > 100
        ? 'Receipt number must be 100 characters or less.'
        : '';

    const date = !receipt.date
      ? 'Enter the receipt date.'
      : !isCalendarDate(receipt.date)
        ? 'Receipt date must be a valid date.'
        : receipt.date > today
          ? 'Receipt date cannot be in the future.'
          : !transactionDateError && receipt.date > input.transactionDate
            ? 'Receipt date cannot be after the transaction date.'
            : '';

    const amount = !Number.isFinite(receipt.amount) || receipt.amount <= 0
      ? 'Enter a receipt amount greater than zero.'
      : !hasAtMostTwoDecimals(receipt.amount)
        ? 'Receipt amount can have at most two decimal places.'
        : receipt.amount > OFFICE_PETTY_RECEIPT_LIMIT
          ? `Each receipt must be at most ${peso.format(OFFICE_PETTY_RECEIPT_LIMIT)}.`
          : '';

    const description = descTrimmed.length > 300 ? 'Description must be 300 characters or less.' : '';
    const path = !receipt.path ? 'Attach a receipt PDF or image (JPG, PNG, WebP).' : '';

    let duplicate = '';
    if (vendorTrimmed && numberTrimmed && receipt.date) {
      const fingerprint = `${vendorTrimmed.toLowerCase()}|${numberTrimmed.toLowerCase()}|${receipt.date}`;
      if (seenFingerprints.has(fingerprint)) {
        duplicate = 'Duplicate receipt (same vendor, receipt number, and date).';
      } else {
        seenFingerprints.add(fingerprint);
      }
    }
    if (!duplicate && receipt.path) {
      if (seenPaths.has(receipt.path)) {
        duplicate = 'This receipt file is already attached to another receipt.';
      } else {
        seenPaths.add(receipt.path);
      }
    }

    for (const msg of [vendor, number, date, amount, description, path, duplicate]) {
      if (msg) blockingErrors.push(`${label}: ${msg}`);
    }

    return {
      vendor,
      number,
      date,
      amount,
      description,
      path,
      duplicate,
      hasError: Boolean(vendor || number || date || amount || description || path || duplicate),
    };
  });

  const refundNoTrimmed = input.refundReceiptNumber.trim();
  const refundReceiptNumberError = requiresCashReturn
    ? !refundNoTrimmed
      ? `Enter the official refund receipt number for the ${peso.format(unusedCents / 100)} being returned.`
      : refundNoTrimmed.length > 100
        ? 'Official refund receipt number must be 100 characters or less.'
        : ''
    : '';

  const refundDateError = requiresCashReturn
    ? !input.refundDate
      ? 'Enter the cash return date.'
      : !isCalendarDate(input.refundDate)
        ? 'Cash return date must be a valid date.'
        : input.refundDate > today
          ? 'Cash return date cannot be in the future.'
          : !transactionDateError && input.refundDate > input.transactionDate
            ? 'Cash return date cannot be after the transaction date.'
            : ''
    : '';

  if (refundReceiptNumberError) blockingErrors.push(refundReceiptNumberError);
  if (refundDateError) blockingErrors.push(refundDateError);

  return {
    releasedCents,
    receiptTotalCents,
    unusedCents,
    overReleasedCents,
    releasedAmount: releasedCents / 100,
    receiptTotal: receiptTotalCents / 100,
    unusedCash: unusedCents / 100,
    exceedsReleased,
    requiresCashReturn,
    transactionDateError,
    referenceError,
    countError,
    totalError,
    refundReceiptNumberError,
    refundDateError,
    receipts,
    blockingErrors,
    isValid: blockingErrors.length === 0,
  };
}
