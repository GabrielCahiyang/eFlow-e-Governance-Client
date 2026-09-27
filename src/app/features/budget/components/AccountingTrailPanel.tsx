import { useMemo, useState } from "react";
import { AttentionBox, Button, Label, Search as VibeSearch } from "@vibe/core";
import * as m from "motion/react-m";
import { ArrowRight, Clock3, FileSearch, ShieldCheck, X } from "lucide-react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { motionTransition } from "../../../shared/motion/motionTokens";
import type {
  BudgetLedgerEntry,
  DepartmentBudgetBundle,
  GeneralJournalEntry,
} from "../types";
import { peso } from "./budgetUi";

const FLOW = [
  "Appropriation",
  "Commitment",
  "Allocation",
  "Request",
  "Endorsement",
  "Authorization",
  "Release",
  "Liquidation",
  "Change return",
  "Settlement",
];

export function AccountingTrailPanel({
  data,
  journalEntries = [],
}: {
  data: DepartmentBudgetBundle;
  journalEntries?: GeneralJournalEntry[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BudgetLedgerEntry>();
  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.ledger.filter(
      (entry) =>
        !needle ||
        `${entry.entryType} ${entry.description} ${entry.actorRole || ""} ${entry.reason || ""}`
          .toLowerCase()
          .includes(needle),
    );
  }, [data.ledger, query]);
  const linkedJournal = selected
    ? journalEntries.filter(
        (entry) =>
          entry.sourceId === selected.metadata?.releaseId ||
          entry.referenceNumber === selected.metadata?.voucherNumber,
      )
    : [];

  return (
    <div className="space-y-4">
      <section className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">
            End-to-end accounting trail
          </h2>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FLOW.map((stage, index) => (
            <div key={stage} className="flex items-center gap-2">
              <Label
                color={stage === "Settlement" ? "positive" : "dark"}
                text={stage}
              />
              {index < FLOW.length - 1 && (
                <ArrowRight size={11} className="text-muted-foreground/60" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Operational events remain separate from the double-entry journal.
          Select any event below to inspect its actor, state transition, reason,
          metadata, and linked accounting rows.
        </p>
      </section>
      <section className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <header className="border-b border-border p-4">
          <VibeSearch
            className="w-full max-w-lg"
            clearIconLabel="Clear audit search"
            inputAriaLabel="Search accounting audit trail"
            onChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search event, actor role, state, or reason…"
            showClearIcon
            size="small"
            value={query}
          />
        </header>
        {entries.length ? (
          <div className="divide-y divide-border/70">
            {entries.map((entry, index) => (
              <m.button
                layout
                key={entry.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...motionTransition.productive,
                  delay: Math.min(index * 0.02, 0.18),
                }}
                type="button"
                onClick={() => setSelected(entry)}
                className="grid w-full gap-3 p-4 text-left transition-colors hover:bg-accent/70 focus-visible:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring sm:grid-cols-[36px_1fr_auto]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  <Clock3 size={14} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold capitalize text-foreground">
                      {entry.entryType.split("_").join(" ")}
                    </span>
                    {entry.previousState && entry.newState && (
                      <span className="text-[11px] text-muted-foreground">
                        {entry.previousState} → {entry.newState}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[12px] text-muted-foreground">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()} ·{" "}
                    {entry.actorRole
                      ? entry.actorRole.split("_").join(" ")
                      : "system"}
                  </p>
                </div>
                <strong className="justify-self-end whitespace-nowrap text-right text-[12px] tabular-nums text-foreground">
                  {peso.format(entry.amount)}
                </strong>
              </m.button>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileSearch size={30} className="mx-auto text-neutral-300" />
            <h3 className="mt-3 text-[12px] font-semibold">
              No matching audit events
            </h3>
          </div>
        )}
      </section>
      <FeatureDialog
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        title={selected ? selected.entryType.split("_").join(" ") : "Accounting event details"}
        description="Financial audit event details."
        showCloseButton={false}
        contentClassName="!inset-y-0 !left-auto !right-0 !top-auto !h-auto !max-h-none !w-full !max-w-[480px] !translate-x-0 !translate-y-0 !rounded-none !border-y-0 !border-r-0 max-sm:!left-0"
      >
        {selected && (
          <aside className="h-full w-full overflow-y-auto border-l border-border bg-card p-5">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Financial audit event
                  </div>
                  <h2 className="mt-1 text-[18px] font-semibold capitalize text-foreground">
                    {selected.entryType.split("_").join(" ")}
                  </h2>
                </div>
                <Button
                  kind="tertiary"
                  size="small"
                  aria-label="Close audit details"
                  onClick={() => setSelected(undefined)}
                >
                  <X size={15} />
                </Button>
              </header>
              <div className="mt-5 space-y-4">
                <AttentionBox
                  type="neutral"
                  title="Append-only operational event"
                  text={selected.description}
                />
                <Detail
                  label="Recorded"
                  value={new Date(selected.createdAt).toLocaleString()}
                />
                <Detail
                  label="Actor"
                  value={`${selected.actorRole?.split("_").join(" ") || "System"}${selected.actorId ? ` · ${selected.actorId}` : ""}`}
                />
                <Detail
                  label="State transition"
                  value={
                    selected.previousState || selected.newState
                      ? `${selected.previousState || "—"} → ${selected.newState || "—"}`
                      : "No state transition"
                  }
                />
                <Detail
                  label="Reason"
                  value={selected.reason || "No separate reason recorded"}
                />
                <Detail
                  label="Correlation key"
                  value={selected.correlationKey || "Not supplied"}
                />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Metadata
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-[#152020] p-3 text-[11px] leading-relaxed text-neutral-100">
                    {JSON.stringify(selected.metadata || {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Linked journal rows
                  </div>
                  {linkedJournal.length ? (
                    linkedJournal.map((entry) => (
                      <div
                        key={entry.id}
                        className="mt-2 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {entry.referenceNumber}
                        </div>
                        {entry.lines.map((line) => (
                          <div
                            key={line.id}
                            className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[12px]"
                          >
                            <span className="min-w-0">
                              {line.accountCode} · {line.accountTitle}
                            </span>
                            <span className="whitespace-nowrap text-right tabular-nums">
                              {line.debit
                                ? `Dr ${peso.format(line.debit)}`
                                : `Cr ${peso.format(line.credit)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p className="mt-2 text-[12px] text-neutral-500">
                      This operational event has no directly linked journal row.
                      Journal entries are created only when money is released,
                      settled, returned, or adjusted.
                    </p>
                  )}
                </div>
              </div>
          </aside>
        )}
      </FeatureDialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-[12px] text-foreground">
        {value}
      </div>
    </div>
  );
}
