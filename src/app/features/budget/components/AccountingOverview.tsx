import { Banknote, BookOpenCheck, Landmark, ReceiptText } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { useDepartmentBudget } from '../hooks/useDepartmentBudget';
import { getScheduledReleaseSummary } from '../selectors/cashWorkflowRules';
import { peso } from './budgetUi';

/** Summary only. The canonical Settlements destination owns decisions and drafts. */
export function AccountingOverview({ budget, journalCount, onSettlements }: {
  budget: ReturnType<typeof useDepartmentBudget>;
  journalCount?: number;
  onSettlements?: () => void;
}) {
  const releases = getScheduledReleaseSummary(budget.releases);
  const settlements = budget.liquidations.filter(item => item.status === 'pending_department_settlement').length;
  const unavailable = Boolean(budget.error);
  const cards = [
    { label: 'Cash to release', value: peso.format(releases.scheduledAmount), note: `${releases.dueCount} due now · ${releases.futureCount} scheduled later`, icon: Banknote },
    { label: 'Release room today', value: budget.summary ? peso.format(budget.summary.dailyReleaseRemaining) : 'Not configured', note: `${peso.format(releases.dueAmount)} due today`, icon: Banknote },
    { label: 'Pending settlement', value: String(settlements), note: 'Leader-endorsed liquidations', icon: ReceiptText },
    { label: 'Journal entries', value: journalCount === undefined ? 'Unavailable' : String(journalCount), note: `${budget.summary?.fiscalYear || 'Selected'} fiscal year`, icon: BookOpenCheck },
    { label: 'Actual spending', value: budget.summary ? peso.format(budget.summary.spentAmount) : 'Not configured', note: budget.summary ? `of ${peso.format(budget.summary.approvedAmount)} authorized` : 'Annual budget required', icon: Landmark },
  ];
  return <div className="eflow-accounting-overview">
    <section className="eflow-accounting-summary" aria-label="Accounting summary">
      {cards.map(({ label, value, note, icon: Icon }) => <article key={label}>
        <h2><Icon size={16} aria-hidden="true" />{label}</h2>
        <strong>{unavailable && label !== 'Journal entries' ? 'Unavailable' : value}</strong>
        <p>{unavailable && label !== 'Journal entries' ? 'Refresh financial records to verify' : note}</p>
      </article>)}
    </section>
    <section className="eflow-accounting-settlement-handoff" aria-label="Settlement records">
      <div><h2>Settlement records</h2><p>{unavailable ? 'The settlement count is unavailable.' : `${settlements} pending receipt package${settlements === 1 ? '' : 's'}.`} Open Settlements to inspect evidence and record an independent decision.</p></div>
      {onSettlements && <Button variant="outline" onClick={onSettlements}>View settlements</Button>}
    </section>
    <details className="eflow-accounting-help"><summary>Accounting authority and posting</summary>
      <p>Accounting Staff can record releases, verify settlement evidence, post balanced corrections, and read Office ledgers. Funding approval remains with the eligible Head; contextual Lead endorsement and late-package Head authorization remain separate stages. Office boundaries and independent-person rules apply at each operation.</p>
      <p>Cash and cheque releases debit member advances and credit cash. Approved liquidations debit expense and returned cash, then clear the advance in one balanced journal entry. Posted financial history remains immutable.</p>
    </details>
  </div>;
}
