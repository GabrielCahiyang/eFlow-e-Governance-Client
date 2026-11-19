import { describe, expect, it } from 'vitest';
import {
  computeReturnedAmount,
  getLiquidationDueStatus,
  validateOfficeReceiptsSubmission,
} from '../../src/app/features/office-petty-cash/validation/officeCashValidation';

const baseReceipt = {
  vendor: 'National Book Store',
  number: 'OR-1001',
  date: '2026-11-18',
  amount: 300,
  path: 'req-1/file-1',
  description: 'Printer ink and bond paper',
};

describe('officeCashValidation', () => {
  it('requires refund OR # and return date when ₱300 is spent out of ₱500 released', () => {
    const missingRefund = validateOfficeReceiptsSubmission({
      releasedAmount: 500,
      transactionDate: '2026-11-19',
      reference: 'Bought office supplies',
      receipts: [baseReceipt],
      refundReceiptNumber: '',
      refundDate: '',
      todayManila: '2026-11-19',
    });

    expect(missingRefund.isValid).toBe(false);
    expect(missingRefund.requiresCashReturn).toBe(true);
    expect(missingRefund.receiptTotal).toBe(300);
    expect(missingRefund.unusedCash).toBe(200);
    expect(missingRefund.refundReceiptNumberError).toContain('₱200.00');
    expect(missingRefund.refundDateError).toContain('cash return date');

    const withRefund = validateOfficeReceiptsSubmission({
      releasedAmount: 500,
      transactionDate: '2026-11-19',
      reference: 'Bought office supplies and returned ₱200',
      receipts: [baseReceipt],
      refundReceiptNumber: 'OR-REF-2026-01',
      refundDate: '2026-11-19',
      todayManila: '2026-11-19',
    });

    expect(withRefund.isValid).toBe(true);
    expect(withRefund.unusedCash).toBe(200);
    expect(withRefund.blockingErrors).toEqual([]);
  });

  it('allows zero-receipt full advance return when refund details are supplied', () => {
    const result = validateOfficeReceiptsSubmission({
      releasedAmount: 500,
      transactionDate: '2026-11-19',
      reference: 'Purchase cancelled, returning full ₱500',
      receipts: [],
      refundReceiptNumber: 'OR-REF-FULL-01',
      refundDate: '2026-11-19',
      todayManila: '2026-11-19',
    });

    expect(result.isValid).toBe(true);
    expect(result.requiresCashReturn).toBe(true);
    expect(result.unusedCash).toBe(500);
  });

  it('does not require refund details when exact released cash is spent (cent-accurate)', () => {
    const result = validateOfficeReceiptsSubmission({
      releasedAmount: 500,
      transactionDate: '2026-11-19',
      reference: 'Full advance spent',
      receipts: [
        { ...baseReceipt, amount: 199.99, number: 'OR-1', path: 'req-1/1' },
        { ...baseReceipt, amount: 300.01, number: 'OR-2', path: 'req-1/2' },
      ],
      refundReceiptNumber: '',
      refundDate: '',
      todayManila: '2026-11-19',
    });

    expect(result.isValid).toBe(true);
    expect(result.requiresCashReturn).toBe(false);
    expect(result.receiptTotal).toBe(500);
    expect(result.unusedCash).toBe(0);
  });

  it('blocks receipt totals exceeding released cash, receipts over ₱5,000, and duplicates', () => {
    const overReleased = validateOfficeReceiptsSubmission({
      releasedAmount: 500,
      transactionDate: '2026-11-19',
      reference: 'Overspent',
      receipts: [{ ...baseReceipt, amount: 600 }],
      refundReceiptNumber: '',
      refundDate: '',
      todayManila: '2026-11-19',
    });
    expect(overReleased.isValid).toBe(false);
    expect(overReleased.exceedsReleased).toBe(true);
    expect(overReleased.totalError).toContain('₱100.00');

    const overCap = validateOfficeReceiptsSubmission({
      releasedAmount: 6000,
      transactionDate: '2026-11-19',
      reference: 'Too large',
      receipts: [{ ...baseReceipt, amount: 5000.01 }],
      refundReceiptNumber: 'OR-REF-1',
      refundDate: '2026-11-19',
      todayManila: '2026-11-19',
    });
    expect(overCap.isValid).toBe(false);
    expect(overCap.receipts[0].amount).toContain('₱5,000.00');

    const duplicate = validateOfficeReceiptsSubmission({
      releasedAmount: 1000,
      transactionDate: '2026-11-19',
      reference: 'Duplicate test',
      receipts: [
        { ...baseReceipt, amount: 200, path: 'req-1/a' },
        { ...baseReceipt, amount: 200, path: 'req-1/b' },
      ],
      refundReceiptNumber: 'OR-REF-2',
      refundDate: '2026-11-19',
      todayManila: '2026-11-19',
    });
    expect(duplicate.isValid).toBe(false);
    expect(duplicate.receipts[1].duplicate).toContain('Duplicate receipt');
  });

  it('computes returned amount safely and formats 15-day due status in Asia/Manila', () => {
    expect(computeReturnedAmount({ amount: 500, spent: 300 })).toBe(200);
    expect(computeReturnedAmount({ amount: 500, spent: 300, returned_amount: 200 })).toBe(200);
    expect(computeReturnedAmount({ amount: 500, spent: 500 })).toBe(0);

    const onTime = getLiquidationDueStatus('2026-11-25T08:00:00Z', '2026-11-19');
    expect(onTime?.isOverdue).toBe(false);
    expect(onTime?.daysRemaining).toBe(6);

    const overdue = getLiquidationDueStatus('2026-11-16T08:00:00Z', '2026-11-19');
    expect(overdue?.isOverdue).toBe(true);
    expect(overdue?.label).toContain('Overdue by 3 days');
  });
});
