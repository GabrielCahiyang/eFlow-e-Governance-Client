import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCheck, ChevronDown, FileText, LockKeyhole, TriangleAlert, UserRound } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { formatManilaDate, formatManilaInstant } from '../../../shared/calendarDisplay';
import type { GeneralJournalEntry } from '../types';
import { peso } from './budgetUi';
import './journalEntry.css';

/** Full entry, independently of the list's account/date/search filters. */
export function JournalEntryPage({ entry, onBack }: { entry: GeneralJournalEntry; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [memoExpanded, setMemoExpanded] = useState(false);
  const memoId = useId();
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const section = heading.current?.closest('section');
    if (section && section.getBoundingClientRect().top < 0) section.scrollIntoView?.({ block: 'start' });
    setMemoExpanded(false);
  }, [entry.id]);
  const total = (side: 'debit' | 'credit') => entry.lines.reduce((sum, line) => sum + Math.round(line[side] * 100), 0) / 100;
  const debit = total('debit'), credit = total('credit');
  const balanced = entry.lines.length > 0 && Math.round(debit * 100) === Math.round(credit * 100);
  const longMemo = entry.memo.length > 180;
  return <section className="journal-entry" aria-label={`Journal entry ${entry.referenceNumber}`}>
    <Button variant="outline" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to journal</Button>
    <article className="journal-entry__sheet">
    <header className="journal-entry__header">
      <div className="journal-entry__title"><span className="journal-entry__icon"><FileText size={23} aria-hidden="true" /></span><div>
        <p className="journal-entry__eyebrow">Journal entry · {entry.sourceType.replace(/_/g, ' ')}</p>
        <h2 ref={heading} tabIndex={-1}>{entry.referenceNumber}</h2>
      </div><span className="journal-entry__posted"><LockKeyhole size={13} aria-hidden="true" /> Posted</span></div>
      <dl className="journal-entry__metadata">
        <div><dt><CalendarDays size={14} aria-hidden="true" /> Entry date</dt><dd>{formatManilaDate(entry.entryDate)}</dd></div>
        <div><dt><UserRound size={14} aria-hidden="true" /> Posted by</dt><dd>{entry.postedByName || 'Automated posting'}</dd></div>
        <div><dt>Posted on</dt><dd>{formatManilaInstant(entry.postedAt)}</dd></div>
      </dl>
    </header>
    <div className="journal-entry__summary" aria-label="Entry balance">
      <div><span>Total debit</span><strong>{peso.format(debit)}</strong></div>
      <div><span>Total credit</span><strong>{peso.format(credit)}</strong></div>
      <div className={balanced ? 'journal-entry__balanced' : 'journal-entry__unbalanced'}>{balanced ? <CheckCheck size={19} aria-hidden="true" /> : <TriangleAlert size={19} aria-hidden="true" />}<span>{balanced ? 'Balanced entry' : 'Balance needs review'}<small>{entry.lines.length} account lines</small></span></div>
    </div>
    <div className="journal-entry__memo">
      <h3>Memo</h3>
      <p id={memoId}>{!longMemo || memoExpanded ? entry.memo || 'No memo provided.' : `${entry.memo.slice(0, 180).trimEnd()}…`}</p>
      {longMemo && <button type="button" aria-expanded={memoExpanded} aria-controls={memoId} onClick={() => setMemoExpanded(value => !value)}>{memoExpanded ? 'Show less' : 'Read full memo'}<ChevronDown size={14} aria-hidden="true" className={memoExpanded ? 'rotate-180' : ''} /></button>}
    </div>
    <div role="region" aria-label="Complete journal entry lines" className="journal-entry__lines">
      <table>
        <caption className="sr-only">All accounts in this entry, including accounts outside the journal list filter.</caption>
        <thead><tr><th className="p-3 text-left">Account</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th></tr></thead>
        <tbody>{entry.lines.map(line => <tr key={line.id} className="border-t border-border">
          <td className="journal-entry__account"><span className="journal-entry__code">{line.accountCode}</span><span>{line.accountTitle}</span></td>
          <td className="journal-entry__amount"><span className="journal-entry__mobile-label">Debit</span>{peso.format(line.debit)}</td>
          <td className="journal-entry__amount"><span className="journal-entry__mobile-label">Credit</span>{peso.format(line.credit)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th>Full entry totals</th><td className="journal-entry__amount"><span className="journal-entry__mobile-label">Debit</span>{peso.format(debit)}</td><td className="journal-entry__amount"><span className="journal-entry__mobile-label">Credit</span>{peso.format(credit)}</td></tr></tfoot>
      </table>
    </div>
    <footer className="journal-entry__footer"><LockKeyhole size={14} aria-hidden="true" /><span>Posted entries are read-only. Corrections require a balanced adjustment.</span></footer>
    </article>
    <details className="journal-entry__references"><summary>Record references</summary><dl><div><dt>Journal reference</dt><dd>{entry.id}</dd></div><div><dt>Office reference</dt><dd>{entry.orgId}</dd></div></dl></details>
  </section>;
}
