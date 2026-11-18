import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Info, ShieldCheck } from "lucide-react";
import type { AuditEvent } from "../../../services/auditService";
import { InitialsAvatar } from "../../../components/workflow/StatusBadges";
import { auditActionTone, humanizeAuditAction, humanizeEntityType, summarizeAuditChanges, type AuditValueLookup } from "../presentation";

const TONE_STYLE = {
  good: "border-emerald-100 bg-emerald-50 text-emerald-700",
  info: "border-blue-100 bg-blue-50 text-blue-700",
  warn: "border-amber-100 bg-amber-50 text-amber-700",
  bad: "border-rose-100 bg-rose-50 text-rose-700",
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-600",
} as const;

function ToneIcon({ tone }: { tone: keyof typeof TONE_STYLE }) {
  if (tone === "good") return <CheckCircle2 size={14} />;
  if (tone === "warn") return <AlertTriangle size={14} />;
  if (tone === "bad") return <ShieldCheck size={14} />;
  if (tone === "info") return <Activity size={14} />;
  return <Info size={14} />;
}

function eventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AuditEventFeed({
  events,
  totalCount,
  entityLabel,
  lookup,
  onSelect,
}: {
  events: AuditEvent[];
  totalCount?: number;
  entityLabel: (event: AuditEvent) => string;
  lookup?: AuditValueLookup;
  onSelect: (event: AuditEvent, trigger: HTMLElement) => void;
}) {
  const countLabel =
    totalCount !== undefined && totalCount !== events.length
      ? `${events.length} of ${totalCount} events`
      : `${events.length} events`;
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
        <div>
          <h2 className="text-[13px] font-medium text-neutral-900">System activity</h2>
          <p className="mt-0.5 text-[10.5px] text-neutral-500">Entries cannot be edited. Each record shows who took the action and what changed.</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-600">{countLabel}</span>
      </div>
      <div className="max-h-[calc(100vh-330px)] divide-y divide-neutral-100 overflow-y-auto">
        {events.map((event) => {
          const tone = auditActionTone(event.action);
          return (
            <button key={event.id} type="button" onClick={(click) => onSelect(event, click.currentTarget)} className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50/80 sm:px-5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${TONE_STYLE[tone]}`}><ToneIcon tone={tone} /></span>
              <InitialsAvatar name={event.actorName} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[12.5px] font-semibold text-neutral-950">{humanizeAuditAction(event.action)}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-medium text-neutral-500">{humanizeEntityType(event.entityType)}</span>
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-[10.5px] text-neutral-500">
                  <span className="font-medium text-neutral-700">{event.actorName}</span>
                  <span>changed</span>
                  <span className="truncate font-medium text-neutral-700">{entityLabel(event)}</span>
                </div>
                {event.reason && <p className="mt-1 truncate text-[10.5px] text-neutral-500">Note: “{event.reason}”</p>}
                <p className="mt-0.5 truncate text-[10.5px] text-[var(--eflow-primary)]">{summarizeAuditChanges(event, lookup)}</p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 text-[10px] text-neutral-400 md:flex"><Clock3 size={11} />{eventTime(event.createdAt)}</span>
              <ChevronRight size={15} className="shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
