import type { ReactNode } from "react";
import { Card } from "../../../components/ui/card";
import { StatusPill as WorkspaceStatusPill } from "../../../components/ui/workspace/StatusPill";
import { EmptyState } from '../../../components/ui/EmptyState';
import type { EmptyIllustration } from '../../../components/ui/EmptyStateIllustration';
import '../budgetViewControl.css';

export const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
export const pesoShort = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 });

export function BudgetCard({ label, value, note, icon, tone = "neutral" }: { label: string; value: string; note: string; icon: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const colors = { neutral: 'bg-muted text-primary', good: 'bg-[var(--eflow-positive-bg)] text-[var(--eflow-positive-text)]', warn: 'bg-[var(--eflow-warning-bg)] text-[var(--eflow-warning-text)]', bad: 'bg-[var(--eflow-negative-bg)] text-[var(--eflow-negative-text)]' };
  return <Card className="min-w-0 gap-2 p-4 shadow-none">
    <div className="flex items-center justify-between gap-2"><div className="text-xs font-medium text-muted-foreground">{label}</div><div aria-hidden="true" className={`shrink-0 rounded-lg p-2 ${colors[tone]}`}>{icon}</div></div>
    <div className="break-words text-right text-[20px] font-semibold tabular-nums text-foreground">{value}</div>
    <p className="text-xs text-muted-foreground">{note}</p>
  </Card>;
}

export function BudgetEmpty({ title, description, action, illustration = 'budget' }: { title: string; description: string; action?: ReactNode; illustration?: EmptyIllustration }) {
  return <Card className="gap-0 border-dashed p-0 shadow-none"><EmptyState title={title} description={description} action={action} illustration={illustration}/></Card>;
}

export function StatusPill({ status }: { status: string }) {
  const tone = ["approved", "settled", "locked", "released", "active"].includes(status)
    ? 'positive'
    : ["scheduled", "scheduled_for_release", "partially_released"].includes(status)
      ? 'info'
      : ["rejected", "overdue_liquidation"].includes(status)
        ? 'negative'
        : status.startsWith('pending') || status.includes('changes_requested') || status === 'liquidation_submitted'
          ? 'warning'
          : 'neutral';
  const label = status === 'pending_department_settlement' ? 'Awaiting Accounting settlement' : status.replace(/_/g, ' ');
  return <span className="inline-flex max-w-full capitalize"><WorkspaceStatusPill label={label} tone={tone} /></span>;
}
