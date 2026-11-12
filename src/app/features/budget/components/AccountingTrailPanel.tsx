import { EmptyState } from '../../../components/ui/EmptyState';
import { useMemo, useState } from "react";
import { Search as VibeSearch } from "@vibe/core";
import { Badge } from "../../../components/ui/badge";
import * as m from "motion/react-m";
import { ArrowRight, Clock3, ShieldCheck } from "lucide-react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { motionTransition } from "../../../shared/motion/motionTokens";
import type {
  BudgetLedgerEntry,
  DepartmentBudgetBundle,
  GeneralJournalEntry,
} from "../types";
import { peso } from "./budgetUi";
import { AuditEventDetails } from "./AuditEventDetails";

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
      <section className="overflow-hidden rounded-[10px] border border-border bg-card">
        <div className="eflow-budget-section-heading">
          <div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">
            End-to-end accounting trail
          </h2>
        </div>
        <p>Select an event to see who recorded it, what changed, and any linked journal entries.</p>
          </div>
        </div>
        <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {FLOW.map((stage, index) => (
            <div key={stage} className="flex items-center gap-2">
              <Badge variant="outline" className="eflow-financial-status" data-tone={stage === "Settlement" ? "positive" : "neutral"}>{stage}</Badge>
              {index < FLOW.length - 1 && (
                <ArrowRight size={11} className="text-muted-foreground/60" />
              )}
            </div>
          ))}
        </div>
        </div>
        <div className="eflow-budget-register-filters">
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
        </div>
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
                className="eflow-budget-audit-row hover:bg-muted focus-visible:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring"
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
                      <span className="text-[12px] text-muted-foreground">
                        {entry.previousState} → {entry.newState}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
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
          <EmptyState illustration="search" title="No matching audit events"/>
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
          <AuditEventDetails entry={selected} linkedJournal={linkedJournal} onClose={() => setSelected(undefined)} />
        )}
      </FeatureDialog>
    </div>
  );
}
