import type { ReactNode } from "react";
import { AttentionBox, Button } from "@vibe/core";
import { X } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import type { BudgetLedgerEntry, GeneralJournalEntry } from "../types";
import { peso } from "./budgetUi";

const words = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").split("_").join(" ").trim();
const sentence = (value: string) => { const text = words(value).toLowerCase(); return text.charAt(0).toUpperCase() + text.slice(1); };
const isId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value);
const shortId = (value: string) => (isId(value) ? `${value.slice(0, 8)}…` : value);

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return /amount|total|balance|cash|cost/i.test(key) ? peso.format(value) : String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`).toLocaleDateString();
    return value;
  }
  return JSON.stringify(value);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-3 py-2.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function MetadataRows({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (!entries.length) return <p className="text-[13px] text-muted-foreground">No additional details recorded.</p>;
  return (
    <dl className="divide-y divide-border/70 rounded-lg border border-border bg-card px-3">
      {entries.map(([key, value]) => (
        <Row key={key} label={sentence(key)}>
          {Array.isArray(value) ? (
            <ul className="space-y-1.5">
              {value.map((item, index) => (
                <li key={index} className="rounded-md bg-muted/50 px-2 py-1.5 text-[12px]">
                  {item && typeof item === "object"
                    ? Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{sentence(k)}</span>
                          <span className="break-all text-right tabular-nums" title={String(v)}>{isId(String(v)) ? shortId(String(v)) : formatValue(k, v)}</span>
                        </div>
                      ))
                    : formatValue(key, item)}
                </li>
              ))}
            </ul>
          ) : (
            <span title={typeof value === "string" ? value : undefined}>{typeof value === "string" && isId(value) ? shortId(value) : formatValue(key, value)}</span>
          )}
        </Row>
      ))}
    </dl>
  );
}

export function AuditEventDetails({ entry, linkedJournal, onClose }: { entry: BudgetLedgerEntry; linkedJournal: GeneralJournalEntry[]; onClose: () => void }) {
  const actor = entry.actorRole ? sentence(entry.actorRole) : "System";
  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-border bg-card">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Financial audit event</div>
          <h2 className="mt-1 text-[18px] font-semibold text-foreground">{sentence(entry.entryType)}</h2>
        </div>
        <Button kind="tertiary" size="small" aria-label="Close audit details" onClick={onClose}><X size={15} /></Button>
      </header>
      <div className="space-y-5 px-5 py-5">
        <AttentionBox type="neutral" title="Append-only operational event" text={entry.description} />
        <Section title="Event">
          <dl className="divide-y divide-border/70 rounded-lg border border-border bg-card px-3">
            <Row label="Recorded">{new Date(entry.createdAt).toLocaleString()}</Row>
            <Row label="Actor">
              {actor}
              {entry.actorId && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground" title={entry.actorId}>{shortId(entry.actorId)}</span>}
            </Row>
            <Row label="State change">
              {entry.previousState || entry.newState ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{entry.previousState ? sentence(entry.previousState) : "None"}</Badge>
                  <span aria-hidden="true">→</span>
                  <Badge variant="outline">{entry.newState ? sentence(entry.newState) : "None"}</Badge>
                </span>
              ) : "No state transition"}
            </Row>
            <Row label="Reason">{entry.reason || "No separate reason recorded"}</Row>
            <Row label="Correlation key"><span className="font-mono text-[11px]" title={entry.correlationKey || undefined}>{entry.correlationKey ? shortId(entry.correlationKey) : "Not supplied"}</span></Row>
          </dl>
        </Section>
        <Section title="Details">
          <MetadataRows data={(entry.metadata || {}) as Record<string, unknown>} />
          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground">View raw data</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[#152020] p-3 text-[12px] leading-relaxed text-neutral-100">{JSON.stringify(entry.metadata || {}, null, 2)}</pre>
          </details>
        </Section>
        <Section title="Linked journal rows">
          {linkedJournal.length ? (
            <div className="space-y-2">
              {linkedJournal.map((journal) => (
                <div key={journal.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="font-mono text-[12px] text-muted-foreground">{journal.referenceNumber}</div>
                  {journal.lines.map((line) => (
                    <div key={line.id} className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[12px]">
                      <span className="min-w-0">{line.accountCode} · {line.accountTitle}</span>
                      <span className="whitespace-nowrap text-right tabular-nums">{line.debit ? `Dr ${peso.format(line.debit)}` : `Cr ${peso.format(line.credit)}`}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">This operational event has no directly linked journal row. Journal entries are created only when money is released, settled, returned, or adjusted.</p>
          )}
        </Section>
      </div>
    </aside>
  );
}
