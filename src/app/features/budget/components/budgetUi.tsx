import type { ReactNode } from "react";
import { Card } from "../../../components/ui/card";
import { EmptyState } from '../../../components/ui/EmptyState';
import type { EmptyIllustration } from '../../../components/ui/EmptyStateIllustration';

export const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
export const pesoShort = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 });

export function BudgetCard({ label, value, note, icon, tone = "neutral" }: { label: string; value: string; note: string; icon: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const colors = { neutral: "bg-neutral-100 text-neutral-600", good: "bg-emerald-50 text-emerald-700", warn: "bg-amber-50 text-amber-700", bad: "bg-rose-50 text-rose-700" };
  return <Card className="gap-0 p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 text-[12px] text-muted-foreground">{note}</div></div><div className={`rounded-lg p-2 ${colors[tone]}`}>{icon}</div></div>
    <div className="mt-4 text-right text-[20px] font-semibold tabular-nums text-foreground">{value}</div>
  </Card>;
}

export function BudgetEmpty({ title, description, action, illustration = 'budget' }: { title: string; description: string; action?: ReactNode; illustration?: EmptyIllustration }) {
  return <Card className="gap-0 border-dashed p-0 shadow-none"><EmptyState title={title} description={description} action={action} illustration={illustration}/></Card>;
}

export function StatusPill({ status }: { status: string }) {
  const tone = ["approved", "settled", "locked", "released"].includes(status)
    ? "bg-emerald-50 text-emerald-700"
    : ["pending", "pending_leader_review", "pending_department_approval", "scheduled_for_release", "partially_released", "liquidation_submitted", "pending_leader_liquidation_review", "pending_department_settlement", "overdue_liquidation"].includes(status)
      ? "bg-amber-50 text-amber-700"
      : ["rejected", "changes_requested", "leader_changes_requested", "department_changes_requested", "cancelled", "expired"].includes(status)
        ? "bg-rose-50 text-rose-700"
        : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-medium capitalize ${tone}`}>{status.split("_").join(" ")}</span>;
}
