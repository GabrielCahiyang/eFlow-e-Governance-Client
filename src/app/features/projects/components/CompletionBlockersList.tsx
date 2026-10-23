import { ClipboardCheck, Landmark, ShieldCheck } from 'lucide-react';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { ReadinessDestination } from '../../project-readiness';
import type { ProjectCompletionBlocker } from '../services/projectLifecycleService';
import type { Project } from '../services/types';

const groups = [
  { title: 'Work and evidence', kinds: ['work', 'task', 'subtask'], icon: ClipboardCheck },
  { title: 'Finance', kinds: ['cash'], icon: Landmark },
  { title: 'Governance', kinds: ['governance'], icon: ShieldCheck },
];
const detail = (blocker: ProjectCompletionBlocker) => blocker.kind === 'cash' && blocker.status === 'pending_department_settlement'
  ? 'The Financial Officer must independently verify and settle the receipts and returned cash in Accounting → Settlements.' : blocker.detail;

/** Presentation groups only; the server remains the completion authority. */
export function CompletionBlockersList({ blockers, busy, project, onOpenTask, onOpenGovernance, onResolve }: {
  blockers: ProjectCompletionBlocker[]; busy: boolean; project?: Project;
  onOpenTask: (id: string) => void; onOpenGovernance: (id: string) => void;
  onResolve?: (view: ReadinessDestination) => void;
}) {
  return <div className="space-y-4">{groups.map(group => {
    const items = blockers.filter(item => group.kinds.includes(item.kind));
    if (!items.length) return null;
    const Icon = group.icon;
    const commonDetail = items.length > 1 && items.every(item => detail(item) === detail(items[0])) ? detail(items[0]) : '';
    return <section key={group.title} aria-label={group.title}>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon size={17} aria-hidden="true" />{group.title}<span className="text-neutral-500">{items.length}</span></h4>
      {commonDetail && <p className="mb-3 text-sm text-neutral-600">{commonDetail}</p>}
      <ul className="space-y-2">{items.map((blocker, index) => <li key={`${blocker.kind}-${blocker.id}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <strong>{blocker.title}</strong>
        <p className="mt-1 capitalize text-amber-800">{blocker.status === 'todo' ? 'Not started' : blocker.status.replace(/_/g, ' ')}{blocker.amount !== undefined ? ` · ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(blocker.amount)}` : ''}</p>
        {!commonDetail && <p className="mt-1 text-neutral-700">{detail(blocker)}</p>}
        {blocker.taskId && <button type="button" disabled={busy} onClick={() => { void requestNavigation(() => onOpenTask(blocker.taskId!)); }} className="mt-2 font-medium text-blue-700 underline">Open task</button>}
        {!blocker.taskId && blocker.kind === 'cash' && onResolve && <button type="button" disabled={busy} onClick={() => { void requestNavigation(() => onResolve('budget')); }} className="mt-2 font-medium text-blue-700 underline">Review financial settlement</button>}
        {blocker.kind === 'governance' && (!project || project.sourceCollaborationDraftId === blocker.id) && <button type="button" disabled={busy} onClick={() => { void requestNavigation(() => onOpenGovernance(blocker.id)); }} className="mt-2 font-medium text-blue-700 underline">Open proposal closeout</button>}
      </li>)}</ul>
    </section>;
  })}</div>;
}
