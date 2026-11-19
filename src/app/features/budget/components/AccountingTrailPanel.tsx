import { EmptyState } from '../../../components/ui/EmptyState';
import { formatManilaDateTime } from '../../../shared/calendarDisplay';
import { useEffect, useMemo, useRef, useState } from "react";
import { Search as VibeSearch } from "@vibe/core";
import * as m from "motion/react-m";
import { ArrowRight, Clock3, ShieldCheck } from "lucide-react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { motionTransition } from "../../../shared/motion/motionTokens";
import { fetchAllProjects, getCachedProjects, type Project } from "../../../services/projectService";
import { fetchBudgetLedgerPage } from "../services/budgetService";
import { DEFAULT_BUDGET_PAGE_SIZE, useBudgetPagination } from "../hooks/useBudgetPagination";
import { BudgetPagination } from "./BudgetPagination";
import type {
  BudgetLedgerEntry,
  DepartmentBudgetBundle,
  GeneralJournalEntry,
} from "../types";
import { peso } from "./budgetUi";
import { AuditEventDetails } from "./AuditEventDetails";

const FLOW = [
  "Annual budget",
  "Project reserved",
  "Task budget",
  "Cash request",
  "Lead review",
  "Head approval",
  "Cash released",
  "Receipts submitted",
  "Change returned",
  "Settled",
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
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects() ?? []);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_BUDGET_PAGE_SIZE);
  const [serverPage, setServerPage] = useState<{ rows: BudgetLedgerEntry[]; total: number } | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const pageRequestRef = useRef(0);
  const fiscalBudgetId = data.summary?.id;

  useEffect(() => {
    setPage(1);
    setServerPage(null);
  }, [fiscalBudgetId, query]);

  useEffect(() => {
    if (projects.length > 0) return;
    let active = true;
    fetchAllProjects()
      .then((loaded) => {
        if (active && loaded.length > 0) setProjects(loaded);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projects.length]);

  const projectNames = useMemo(
    () =>
      Object.fromEntries(
        projects.filter((project) => project.id && project.title).map((project) => [project.id, project.title]),
      ),
    [projects],
  );
  const localEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.ledger.filter(
      (entry) =>
        !needle ||
        `${entry.entryType} ${entry.description} ${entry.actorRole || ""} ${entry.reason || ""}`
          .toLowerCase()
          .includes(needle),
    );
  }, [data.ledger, query]);
  const hasMoreServerRows = (data.ledgerCount ?? data.ledger.length) > data.ledger.length;
  const needsServerPage = Boolean(
    fiscalBudgetId &&
      hasMoreServerRows &&
      (page > 1 || pageSize !== DEFAULT_BUDGET_PAGE_SIZE || query.trim() !== ""),
  );

  useEffect(() => {
    if (!needsServerPage || !fiscalBudgetId) {
      setServerPage(null);
      setPageLoading(false);
      return;
    }
    const requestId = ++pageRequestRef.current;
    setPageLoading(true);
    fetchBudgetLedgerPage({ fiscalBudgetId, page, pageSize, query })
      .then((result) => {
        if (requestId === pageRequestRef.current) setServerPage(result);
      })
      .catch(() => {
        if (requestId === pageRequestRef.current) setServerPage(null);
      })
      .finally(() => {
        if (requestId === pageRequestRef.current) setPageLoading(false);
      });
  }, [fiscalBudgetId, needsServerPage, page, pageSize, query, data.ledger]);

  const localPagination = useBudgetPagination(localEntries, `${fiscalBudgetId || ""}:${query}`, pageSize);
  const usingServerPage = Boolean(needsServerPage && serverPage);
  const entries = usingServerPage ? serverPage!.rows : localPagination.pageItems;
  const totalEvents = usingServerPage
    ? serverPage!.total
    : query.trim()
      ? localEntries.length
      : data.ledgerCount ?? localEntries.length;
  const activePage = usingServerPage ? page : localPagination.page;

  const linkedJournal = selected
    ? journalEntries.filter(
        (entry) =>
          entry.sourceId === selected.metadata?.releaseId ||
          entry.referenceNumber === selected.metadata?.voucherNumber,
      )
    : [];

  return (
    <div className="space-y-4">
      <section className="eflow-accounting-panel">
        <div className="eflow-accounting-panel__header">
          <div className="eflow-accounting-panel__title">
            <ShieldCheck size={17} aria-hidden="true" />
            <div>
              <h2>Budget &amp; cash activity history</h2>
              <p>Click any record to view full details and its linked journal entry.</p>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {totalEvents} {totalEvents === 1 ? "event" : "events"}
          </span>
        </div>
        <div className="eflow-accounting-stepper" aria-label="Accounting lifecycle stages">
          {FLOW.map((stage, index) => (
            <div key={stage} className="flex items-center gap-1.5">
              <span className="eflow-accounting-stepper__step" data-tone={stage === "Settlement" ? "positive" : "neutral"}>{stage}</span>
              {index < FLOW.length - 1 && (
                <ArrowRight size={11} aria-hidden="true" className="text-muted-foreground/60" />
              )}
            </div>
          ))}
        </div>
        <div className="eflow-accounting-filter-bar">
          <VibeSearch
            className="w-full max-w-lg"
            clearIconLabel="Clear audit search"
            inputAriaLabel="Search accounting audit trail"
            onChange={(nextQuery) => {
              setQuery(nextQuery);
              setPage(1);
            }}
            onClear={() => {
              setQuery("");
              setPage(1);
            }}
            placeholder="Search action, account role, status or reason…"
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
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-border bg-card text-muted-foreground">
                  <Clock3 size={14} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold capitalize text-foreground">
                      {entry.entryType.split("_").join(" ")}
                    </span>
                    {entry.previousState && entry.newState && (
                      <span className="text-xs text-muted-foreground">
                        {entry.previousState} → {entry.newState}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatManilaDateTime(entry.createdAt, "—")} ·{" "}
                    {entry.actorRole
                      ? entry.actorRole.split("_").join(" ")
                      : "system"}
                  </p>
                </div>
                <strong className="justify-self-end whitespace-nowrap text-right text-sm font-semibold tabular-nums text-foreground">
                  {peso.format(entry.amount)}
                </strong>
              </m.button>
            ))}
          </div>
        ) : (
          <EmptyState size="compact" illustration="search" title="No matching audit events" description="Financial lifecycle events will appear here when recorded."/>
        )}
        <BudgetPagination
          page={activePage}
          pageSize={pageSize}
          totalItems={totalEvents}
          visibleCount={entries.length}
          noun="event"
          loading={pageLoading}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            localPagination.setPage(nextPage);
          }}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
            localPagination.setPageSize(nextSize);
          }}
        />
      </section>
      <FeatureDialog
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        title={selected ? selected.entryType.split("_").join(" ") : "Accounting event details"}
        description="Financial audit event details."
        showCloseButton={false}
        contentClassName="w-full max-w-[480px] sm:max-w-[540px] rounded-[12px]"
      >
        {selected && (
          <AuditEventDetails
            entry={selected}
            bundle={data}
            projectNames={projectNames}
            linkedJournal={linkedJournal}
            onClose={() => setSelected(undefined)}
          />
        )}
      </FeatureDialog>
    </div>
  );
}
