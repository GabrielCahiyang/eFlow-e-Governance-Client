import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ReadinessCheck } from '../types';

/** Keep every authoritative check; prioritize the work that still needs action. */
export function ReadinessCheckList({ checks, actions }: {
  checks: ReadinessCheck[]; actions: (check: ReadinessCheck) => ReactNode;
}) {
  const blockers = checks.filter(check => !check.ok);
  const confirmed = checks.filter(check => check.ok);
  const rows = (items: ReadinessCheck[]) => <ul className="readiness-check-list">{items.map(check => <li key={check.key}>
    <div className="flex min-w-0 items-start gap-2">
      {check.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /> : <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />}
      <div className="min-w-0 flex-1"><strong>{check.label} · {check.ok ? 'Confirmed' : 'Needs attention'}</strong>
        <p>{check.key === 'schedule' && check.ok ? 'Project dates are set and the schedule is valid.' : check.detail}</p>
        {actions(check)}
      </div>
    </div>
  </li>)}</ul>;
  return <div className="space-y-3">
    {blockers.length > 0 && <section aria-label="Readiness blockers"><h4 className="font-semibold">Needs attention ({blockers.length})</h4>{rows(blockers)}</section>}
    {confirmed.length > 0 && <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer font-medium">Confirmed checks ({confirmed.length})</summary>
      {rows(confirmed)}
    </details>}
  </div>;
}
