import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { createReceiptSignedUrl } from '../services/budgetService';
import type { IndependentReviewContext } from '../services/independentReviewService';
import type { PettyCashLiquidation, PettyCashRequest } from '../types';
import { financialErrorMessage } from '../financialReceipts';
import { IndependentReviewCard } from './IndependentReviewCard';
import { peso } from './budgetUi';

export function IndependentReviewPackageCard({ item, request, context, onChanged }: {
  item: PettyCashLiquidation; request?: PettyCashRequest; context: IndependentReviewContext; onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  return <article id={`independent-review-${item.id}`} tabIndex={-1} className="rounded-xl border border-border p-4 focus:outline focus:outline-2 focus:outline-primary">
    <h3 className="font-semibold">{request?.taskTitle || 'Cash receipt package'} · {item.liquidationNumber || `Version ${item.version}`}</h3>
    <p className="my-2 text-sm">{request?.cashRecipientName || request?.requesterName} · {peso.format(item.declaredSpent)} expense · {peso.format(item.returnedAmount)} returned</p>
    <p className="text-sm">{item.note}</p>
    <div className="my-2 flex flex-wrap gap-2">{item.receipts.map(receipt => <Button key={receipt.id} variant="outline" onClick={async () => { try { window.open(await createReceiptSignedUrl(receipt.filePath), '_blank', 'noopener,noreferrer'); } catch (caught) { setError(financialErrorMessage(caught)); } }}>Receipt {receipt.receiptNumber || receipt.fileName} · {peso.format(receipt.amount)}</Button>)}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {item.refundReceiptNumber && <p className="text-sm">Refund OR {item.refundReceiptNumber}</p>}
    <IndependentReviewCard id={item.id} version={item.version} context={context} onChanged={onChanged} />
  </article>;
}
