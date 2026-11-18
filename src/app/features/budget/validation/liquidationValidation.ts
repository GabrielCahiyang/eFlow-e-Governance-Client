import { historicalDateError } from "../../../shared/calendarDates";
import { attachmentError } from "../../../shared/fileValidation";
import { peso } from "../components/budgetUi";
import { moneyCents } from "../selectors/budgetSections";
import type { CashFundingLine, ReceiptDraft, ReceiptItem } from "../types";
import { financialAmountError, receiptQuantityError } from "./financialValidation";

export interface SourceUsageSummary {
  allocationLineId: string;
  label: string;
  approvedAmount: number;
  approvedCents: number;
  usedAmount: number;
  usedCents: number;
  remainingAmount: number;
  overByAmount: number;
  exceeded: boolean;
}

export interface ReceiptItemValidation {
  quantity: string;
  unit: string;
  particular: string;
  amount: string;
  allocationLineId: string;
  purpose: string;
  sourceExceeded: string;
  hasError: boolean;
}

export interface ReceiptValidation {
  id: string;
  vendor: string;
  receiptDate: string;
  amount: string;
  description: string;
  file: string;
  itemsSummary: string;
  items: ReceiptItemValidation[];
  hasError: boolean;
}

export interface LiquidationValidationResult {
  approvedCents: number;
  spentCents: number;
  receiptTotalCents: number;
  unusedCents: number;
  overReleasedCents: number;
  exceedsReleased: boolean;
  releasedError: string;
  receiptMismatchError: string;
  sourceUsage: SourceUsageSummary[];
  exceededSources: SourceUsageSummary[];
  receipts: ReceiptValidation[];
  requiresCashReturn: boolean;
  refundReceiptNumberError: string;
  refundDateError: string;
  noteError: string;
  blockingErrors: string[];
  overLimitBlocked: boolean;
  isValid: boolean;
}

function safeCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return moneyCents(value);
}

export function validateReceiptItem(
  item: ReceiptItem,
  sources: CashFundingLine[],
  sourceUsageById: Map<string, SourceUsageSummary>,
): ReceiptItemValidation {
  const quantity = receiptQuantityError(item.quantity);
  const unit = !item.unit.trim() ? "Enter a unit (for example: pcs., box, kg)." : "";
  const particular = !item.particular.trim() ? "Enter the item particulars." : "";
  const amount = financialAmountError(item.amount, "Actual cost");
  const validSource = sources.some((s) => s.allocationLineId === item.allocationLineId);
  const allocationLineId = !item.allocationLineId || !validSource ? "Choose an approved expense source." : "";
  const purpose = !item.purpose.trim() ? "Enter the purpose of this expense." : "";

  const usage = item.allocationLineId ? sourceUsageById.get(item.allocationLineId) : undefined;
  const sourceExceeded = usage?.exceeded
    ? `${usage.label} total (${peso.format(usage.usedAmount)}) exceeds its approved funding of ${peso.format(usage.approvedAmount)} by ${peso.format(usage.overByAmount)}.`
    : "";

  return {
    quantity,
    unit,
    particular,
    amount,
    allocationLineId,
    purpose,
    sourceExceeded,
    hasError: Boolean(quantity || unit || particular || amount || allocationLineId || purpose || sourceExceeded),
  };
}

export function validateCashLiquidation(input: {
  approved: number;
  itemized: boolean;
  sources: CashFundingLine[];
  spent: number;
  receipts: ReceiptDraft[];
  refundReceiptNumber: string;
  refundDate: string;
  note: string;
}): LiquidationValidationResult {
  const approved = Number.isFinite(input.approved) ? Math.max(0, input.approved) : 0;
  const approvedCents = safeCents(approved);
  const receiptTotalCents = input.receipts.reduce((sum, receipt) => sum + safeCents(Number(receipt.amount)), 0);
  const spent = input.itemized ? receiptTotalCents / 100 : input.spent;
  const spentCents = Number.isFinite(spent) ? safeCents(spent) : -1;
  const overReleasedCents = spentCents > approvedCents ? spentCents - approvedCents : 0;
  const exceedsReleased = overReleasedCents > 0;
  const unusedCents = spentCents >= 0 && approvedCents > spentCents ? approvedCents - spentCents : 0;

  const releasedError = !Number.isFinite(spent)
    ? "Enter a valid actual spending amount."
    : spent < 0
      ? "Actual spending cannot be negative."
      : exceedsReleased
        ? `Total spending (${peso.format(spentCents / 100)}) exceeds the released cash (${peso.format(approved)}) by ${peso.format(overReleasedCents / 100)}. Reduce receipt amounts to ${peso.format(approved)} or less.`
        : "";

  const receiptMismatchError =
    !input.itemized && spentCents >= 0 && Math.abs(receiptTotalCents - spentCents) > 0
      ? receiptTotalCents > spentCents
        ? `Receipt total (${peso.format(receiptTotalCents / 100)}) is ${peso.format((receiptTotalCents - spentCents) / 100)} higher than actual spending (${peso.format(spentCents / 100)}).`
        : `Receipt total (${peso.format(receiptTotalCents / 100)}) is ${peso.format((spentCents - receiptTotalCents) / 100)} short of actual spending (${peso.format(spentCents / 100)}).`
      : "";

  // Compute itemized usage per approved funding source across all receipts.
  const sourceUsedCents = new Map<string, number>();
  if (input.itemized) {
    for (const receipt of input.receipts) {
      for (const item of receipt.items ?? []) {
        if (!item.allocationLineId || !Number.isFinite(item.amount) || item.amount < 0) continue;
        sourceUsedCents.set(
          item.allocationLineId,
          (sourceUsedCents.get(item.allocationLineId) ?? 0) + safeCents(item.amount),
        );
      }
    }
  }

  const sourceUsage: SourceUsageSummary[] = input.sources.map((source, idx) => {
    const approvedSourceCents = safeCents(source.amount);
    const usedCents = sourceUsedCents.get(source.allocationLineId) ?? 0;
    const exceeded = usedCents > approvedSourceCents;
    return {
      allocationLineId: source.allocationLineId,
      label: source.sourceName || `Funding line ${idx + 1}`,
      approvedAmount: approvedSourceCents / 100,
      approvedCents: approvedSourceCents,
      usedAmount: usedCents / 100,
      usedCents,
      remainingAmount: Math.max(0, approvedSourceCents - usedCents) / 100,
      overByAmount: Math.max(0, usedCents - approvedSourceCents) / 100,
      exceeded,
    };
  });
  const sourceUsageById = new Map(sourceUsage.map((entry) => [entry.allocationLineId, entry]));
  const exceededSources = sourceUsage.filter((entry) => entry.exceeded);

  const blockingErrors: string[] = [];
  if (releasedError) blockingErrors.push(releasedError);
  for (const source of exceededSources) {
    blockingErrors.push(
      `Total for ${source.label} (${peso.format(source.usedAmount)}) exceeds its approved funding of ${peso.format(source.approvedAmount)} by ${peso.format(source.overByAmount)}.`,
    );
  }
  if (receiptMismatchError) blockingErrors.push(receiptMismatchError);

  const receiptValidations: ReceiptValidation[] = input.receipts.map((receipt, index) => {
    const label = `Receipt ${index + 1}`;
    const vendor = !receipt.vendor.trim() ? "Enter the vendor or payee name." : "";
    const receiptDate = historicalDateError(receipt.receiptDate, "Receipt date");
    const rawAmountErr = financialAmountError(receipt.amount, "Receipt amount", true);
    const receiptOverReleased =
      !input.itemized && !rawAmountErr && safeCents(receipt.amount) > approvedCents
        ? `Receipt amount (${peso.format(receipt.amount)}) exceeds the released cash (${peso.format(approved)}).`
        : "";
    const amount = rawAmountErr || receiptOverReleased;

    const items = (receipt.items ?? []).map((item) => validateReceiptItem(item, input.sources, sourceUsageById));
    const description =
      !input.itemized && !receipt.description.trim()
        ? "Describe what was purchased."
        : input.itemized && !receipt.description.trim() && (receipt.items?.length ?? 0) === 0
          ? "Add at least one purchased item below, or describe this zero-spend receipt."
          : "";

    const itemsSummary =
      input.itemized && (receipt.items?.length ?? 0) > 100
        ? "Use up to 100 purchased items per receipt."
        : "";

    const file = !receipt.file
      ? "Attach a receipt image (JPG, PNG, WEBP) or PDF."
      : attachmentError([receipt.file], { extensions: ["jpg", "jpeg", "png", "webp", "pdf"] });

    if (vendor) blockingErrors.push(`${label}: ${vendor}`);
    if (receiptDate) blockingErrors.push(`${label}: ${receiptDate}`);
    if (amount) blockingErrors.push(`${label}: ${amount}`);
    if (description) blockingErrors.push(`${label}: ${description}`);
    if (itemsSummary) blockingErrors.push(`${label}: ${itemsSummary}`);
    if (file) blockingErrors.push(`${label}: ${file}`);
    items.forEach((itemErr, itemIndex) => {
      const firstItemError =
        itemErr.quantity ||
        itemErr.unit ||
        itemErr.particular ||
        itemErr.amount ||
        itemErr.allocationLineId ||
        itemErr.purpose;
      if (firstItemError) blockingErrors.push(`${label}, Item ${itemIndex + 1}: ${firstItemError}`);
    });

    return {
      id: receipt.id,
      vendor,
      receiptDate,
      amount,
      description,
      file,
      itemsSummary,
      items,
      hasError: Boolean(vendor || receiptDate || amount || description || itemsSummary || file || items.some((i) => i.hasError)),
    };
  });

  const requiresCashReturn = unusedCents > 0;
  const refundReceiptNumberError =
    requiresCashReturn && !input.refundReceiptNumber.trim()
      ? `Enter the official refund receipt number for the ${peso.format(unusedCents / 100)} being returned.`
      : "";
  const refundDateError = requiresCashReturn
    ? !input.refundDate
      ? "Enter the cash return date."
      : historicalDateError(input.refundDate, "Cash return date")
    : "";
  const noteError = !input.note.trim()
    ? "Add a short liquidation note summarizing what was purchased and any cash returned."
    : "";

  if (refundReceiptNumberError) blockingErrors.push(refundReceiptNumberError);
  if (refundDateError) blockingErrors.push(refundDateError);
  if (noteError) blockingErrors.push(noteError);

  const overLimitBlocked = exceedsReleased || exceededSources.length > 0;

  return {
    approvedCents,
    spentCents,
    receiptTotalCents,
    unusedCents,
    overReleasedCents,
    exceedsReleased,
    releasedError,
    receiptMismatchError,
    sourceUsage,
    exceededSources,
    receipts: receiptValidations,
    requiresCashReturn,
    refundReceiptNumberError,
    refundDateError,
    noteError,
    blockingErrors,
    overLimitBlocked,
    isValid: blockingErrors.length === 0,
  };
}
