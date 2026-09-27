import { ArrowRight, CalendarClock, Clipboard, Database, FileKey2, MessageSquareText, ShieldCheck, UserRound, X } from "lucide-react";
import { buildDiff, type AuditEvent, type DiffRow } from "../../../services/auditService";
import { auditActionTone, humanizeAuditAction, humanizeAuditField, humanizeEntityType, orderAuditDiff, presentAuditValue, shortenIdentifier } from "../presentation";
import { InspectorPanel } from "../../../shared/motion";

const TONE_STYLE = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  bad: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-600",
} as const;

function fullTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AuditDetailDrawer({ event, entityLabel, onClose }: { event: AuditEvent; entityLabel: string; onClose: () => void }) {
  const changes = orderAuditDiff(buildDiff(event.beforeData, event.afterData));
  const tone = auditActionTone(event.action);

  return (
    <InspectorPanel
      open
      onClose={onClose}
      ariaLabel={`Audit event: ${humanizeAuditAction(event.action)}`}
      className="w-full bg-neutral-50 sm:w-[560px]"
    >
        <header className="border-b border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-wide ${TONE_STYLE[tone]}`}>{humanizeEntityType(event.entityType)}</span>
                <span className="text-[9.5px] text-neutral-400">Immutable audit event</span>
              </div>
              <h2 className="mt-2 text-[18px] font-semibold leading-tight text-neutral-950">{humanizeAuditAction(event.action)}</h2>
              <p className="mt-1 truncate text-[11px] text-neutral-500">{entityLabel}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-800" aria-label="Close audit details"><X size={18} /></button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SummaryCard icon={<UserRound size={14} />} label="Responsible actor" value={event.actorName} />
            <SummaryCard icon={<CalendarClock size={14} />} label="Recorded at" value={fullTime(event.createdAt)} />
            <SummaryCard icon={<Database size={14} />} label="Affected record" value={entityLabel} technical={event.entityId} />
            <SummaryCard icon={<FileKey2 size={14} />} label="Audit reference" value={shortenIdentifier(event.id)} technical={event.id} />
          </section>

          {event.reason && (
            <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700"><MessageSquareText size={13} /> Recorded note</div>
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-amber-950">{event.reason}</p>
            </section>
          )}

          {changes.length ? <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div>
                <h3 className="text-[12.5px] font-semibold text-neutral-900">Recorded changes</h3>
                <p className="mt-0.5 text-[10px] text-neutral-500">Only values captured by this event are shown.</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9.5px] font-medium text-neutral-600">{changes.length} fields</span>
            </div>
            <div className="divide-y divide-neutral-100">{changes.map((change) => <ChangeRow key={change.key} change={change} />)}</div>
          </section> : <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[11px] text-neutral-500"><span className="font-semibold text-neutral-800">No field-level changes.</span> This event records an action only; supporting details are shown below.</div>}

          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <details className="group rounded-2xl border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer list-none text-[11px] font-semibold text-neutral-700">Event details <span className="ml-1 font-normal text-neutral-400">({Object.keys(event.metadata).length})</span></summary>
              <div className="mt-3 grid gap-2">{Object.entries(event.metadata).map(([key, value]) => <TechnicalValue key={key} label={humanizeAuditField(key)} value={value} />)}</div>
            </details>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[10.5px] text-emerald-700"><ShieldCheck size={14} /> This event is append-only and cannot be rewritten from the application.</div>
        </div>
    </InspectorPanel>
  );
}

function SummaryCard({ icon, label, value, technical }: { icon: React.ReactNode; label: string; value: string; technical?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{icon}{label}</div>
      <div className="mt-1.5 truncate text-[11.5px] font-semibold text-neutral-800" title={technical || value}>{value}</div>
      {technical && technical !== value && <div className="mt-1 truncate font-mono text-[8.5px] text-neutral-400" title={technical}>{technical}</div>}
    </div>
  );
}

function ChangeRow({ change }: { change: DiffRow }) {
  return (
    <div className="px-4 py-3.5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{humanizeAuditField(change.key)}</div>
      <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-stretch gap-2">
        <AuditValue label="Before" field={change.key} value={change.before} />
        <span className="flex items-center justify-center text-neutral-300"><ArrowRight size={13} /></span>
        <AuditValue label="After" field={change.key} value={change.after} emphasized={change.changed} />
      </div>
    </div>
  );
}

function AuditValue({ label, field, value, emphasized }: { label: string; field: string; value: unknown; emphasized?: boolean }) {
  const presented = presentAuditValue(field, value);
  const copy = () => presented.technical && navigator.clipboard?.writeText(presented.technical).catch(() => undefined);
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${emphasized ? "border-blue-100 bg-blue-50/60" : "border-neutral-100 bg-neutral-50"}`}>
      <div className="text-[8.5px] font-semibold uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`mt-1 break-words text-[11px] leading-relaxed ${presented.empty ? "text-neutral-400" : "font-medium text-neutral-800"}`}>{presented.display}</div>
      {presented.technical && <button type="button" onClick={copy} title={presented.technical} className="mt-2 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-1 font-mono text-[8.5px] text-neutral-500 hover:text-neutral-900"><Clipboard size={9} /> Copy reference</button>}
    </div>
  );
}

function TechnicalValue({ label, value }: { label: string; value: unknown }) {
  const text = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "Not recorded");
  return <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[9px] font-semibold uppercase tracking-wide text-neutral-400">{label}</div><pre className="mt-1 whitespace-pre-wrap break-all text-[9.5px] text-neutral-600">{text}</pre></div>;
}
