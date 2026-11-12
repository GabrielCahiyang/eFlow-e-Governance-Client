import { EmptyState } from '../../../components/ui/EmptyState';
import { useEffect, useMemo, useState } from "react";
import {
  AttentionBox,
  Button,
  Search as VibeSearch,
} from "@vibe/core";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Plus,
  Scale,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useGeneralJournal } from "../hooks/useGeneralJournal";
import { getJournalTotals } from "../selectors/journalSelectors";
import { peso } from "./budgetUi";
import { JournalAdjustmentDialog } from "./JournalAdjustmentDialog";
import { JournalEntryPage } from './JournalEntryPage';
import { useJournalEntryNavigation } from '../hooks/useJournalEntryNavigation';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import { Badge } from "../../../components/ui/badge";
import { BudgetTableRegion } from './BudgetTableRegion';
import "../accountingWorkspace.css";
interface JournalWorkspaceProps {
  orgId?: string;
  fiscalYear?: number;
  fiscalBudgetId?: string;
  approvedBudget?: number;
  settledExpenses?: number;
  returnedCash?: number;
  availableBudget?: number;
  journal?: ReturnType<typeof useGeneralJournal>;
}
export function GeneralJournalWorkspace(props: JournalWorkspaceProps) {
  return props.journal ? (
    <GeneralJournalView {...props} journal={props.journal} />
  ) : (
    <StandaloneGeneralJournal {...props} />
  );
}
function StandaloneGeneralJournal(props: JournalWorkspaceProps) {
  const { userProfile } = useAuth();
  const orgId =
    props.orgId || userProfile?.org_id || userProfile?.departmentId || "";
  const journal = useGeneralJournal(orgId, props.fiscalYear, userProfile?.id);
  return <GeneralJournalView {...props} orgId={orgId} journal={journal} />;
}
function GeneralJournalView({
  orgId = "",
  fiscalYear = new Date().getFullYear(),
  fiscalBudgetId,
  approvedBudget,
  availableBudget,
  journal,
}: JournalWorkspaceProps & { journal: ReturnType<typeof useGeneralJournal> }) {
  const { userProfile, can } = useAuth();
  const [query, setQuery] = useState("");
  const [classification, setClassification] = useState("all");
  const [startDate, setStartDate] = useState(`${fiscalYear}-01-01`);
  const [endDate, setEndDate] = useState(`${fiscalYear}-12-31`);
  const scope = `${userProfile?.id}:${orgId}:${fiscalYear}`;
  const navigation = useJournalEntryNavigation(scope);
  const inspected = journal.entries.find(entry => entry.id === navigation.selectedId && entry.orgId === orgId);
  const [receipt, setReceipt] = useState("");
  useEffect(() => {
    setStartDate(`${fiscalYear}-01-01`);
    setEndDate(`${fiscalYear}-12-31`);
    setQuery(''); setClassification('all');
  }, [scope]);
  const [adjusting, setAdjusting] = useState(false);
  const accountByCode = useMemo(
    () => new Map(journal.accounts.map((account) => [account.code, account])),
    [journal.accounts],
  );
  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return journal.entries
      .map((entry) => ({
        ...entry,
        lines: entry.lines.filter(
          (line) =>
            classification === "all" ||
            accountByCode.get(line.accountCode)?.classification ===
              classification,
        ),
      }))
      .filter(
        (entry) =>
          entry.entryDate >= startDate &&
          entry.entryDate <= endDate &&
          entry.lines.length > 0 &&
          (!needle ||
            `${entry.referenceNumber} ${entry.memo} ${entry.postedByName || ""} ${entry.lines.map((line) => `${line.accountCode} ${line.accountTitle}`).join(" ")}`
              .toLowerCase()
              .includes(needle)),
      );
  }, [
    accountByCode,
    classification,
    endDate,
    journal.entries,
    query,
    startDate,
  ]);
  const totals = useMemo(
    () => getJournalTotals(filteredEntries),
    [filteredEntries],
  );
  const available = availableBudget;

  return (
    <div className="space-y-4">
      {navigation.selectedId && (inspected && !journal.error ? <JournalEntryPage entry={inspected} onBack={navigation.back} /> : <section className="space-y-3" role="status"><p>{journal.loading ? 'Loading journal entry…' : 'This entry is unavailable in the current Office and fiscal year.'}</p><Button onClick={navigation.back}>Back to journal</Button></section>)}
      <div hidden={Boolean(navigation.selectedId)} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <JournalMetric
          icon={<Scale size={16} />}
          label="Trial balance"
          value={journal.error ? "Unavailable" : peso.format(totals.debit)}
          note={`Credits ${peso.format(totals.credit)}`}
          good={!journal.error && Math.abs(totals.delta) <= 0.009}
        />
        <JournalMetric
          icon={<CheckCircle2 size={16} />}
          label="Balance delta"
          value={
            journal.error ? "Unavailable" : peso.format(Math.abs(totals.delta))
          }
          note={
            Math.abs(totals.delta) <= 0.009
              ? "Debits equal credits"
              : "Reconciliation required"
          }
          good={!journal.error && Math.abs(totals.delta) <= 0.009}
        />
        <JournalMetric
          icon={<BookOpenCheck size={16} />}
          label="Appropriation available"
          value={
            available == null
              ? "Linked to annual budget"
              : peso.format(available)
          }
          note={
            approvedBudget == null
              ? `${fiscalYear} journal view`
              : "Available after holds and commitments; cash returns do not release commitments"
          }
          good={available == null || available >= 0}
        />
      </div>
      {journal.error && (
        <AttentionBox
          type="negative"
          title="Journal unavailable"
          text={
            journal.error +
            " Totals may be incomplete or outdated; refresh before a posting."
          }
        />
      )}
      <section className="overflow-hidden rounded-[10px] border border-border bg-card">
        <header className="eflow-budget-section-heading">
          <div><h2>Journal entries</h2><p>Posted transactions and their account lines.</p></div>
          <Button kind="tertiary" size="small" disabled={journal.refreshing} onClick={() => void journal.refresh()}>
            Refresh journal
          </Button>
        </header>
        <div className="eflow-budget-register-filters">
          <VibeSearch
            className="eflow-budget-register-search"
            clearIconLabel="Clear journal search"
            inputAriaLabel="Search journal"
            onChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search voucher, account, memo, or recorder…"
            showClearIcon
            size="small"
            value={query}
          />
          <div className="flex flex-wrap gap-2">
            <JournalDateInput
              ariaLabel="Journal start date"
              value={startDate}
              onChange={setStartDate}
            />
            <JournalDateInput
              ariaLabel="Journal end date"
              value={endDate}
              onChange={setEndDate}
            />
            <select
              aria-label="Account classification"
              value={classification}
              onChange={(event) => setClassification(event.target.value)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-[14px]"
            >
              <option value="all">All account classes</option>
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
            {fiscalBudgetId &&
              !journal.error &&
              userProfile?.role === "accounting_staff" &&
              can("accounting.post_journal") && (
                <Button
                  kind="primary"
                  size="small"
                  onClick={() => setAdjusting(true)}
                >
                  <Plus size={13} /> Post adjustment
                </Button>
              )}
          </div>
        </div>
        {journal.loading ? (
          <JournalTableSkeleton label="Loading balanced entries…" />
        ) : filteredEntries.length ? (
          <BudgetTableRegion label="Journal line items">
            <table className="eflow-budget-record-table min-w-[850px] text-left">
              <thead>
                <tr>
                  <th className="px-4 py-3">Date / JEV</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Chart of accounts title</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3">Memo / recorded by</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filteredEntries.flatMap((entry) =>
                    entry.lines.map((line, index) => (
                      <m.tr
                        layout
                        key={line.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={index === 0 ? 'border-t border-border' : undefined}
                      >
                        <td className="px-4 py-3 text-[14px] text-neutral-600">
                          {index === 0 && (
                            <>
                              <div>
                                <time dateTime={entry.entryDate}>{formatManilaDate(entry.entryDate)}</time>
                              </div>
                              <div className="mt-1 font-mono text-[14px] text-neutral-600">
                                JEV-{fiscalYear}-
                                {String(entry.entryNumber).padStart(6, "0")}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[14px] text-neutral-700">
                          {index === 0 ? (
                            <button
                              type="button"
                              className="text-primary underline"
                              aria-label={`Inspect journal ${entry.referenceNumber}`}
                              onClick={() => navigation.open(entry.id)}
                            >
                              {entry.referenceNumber}
                            </button>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[14px] font-medium text-neutral-800">
                            {line.accountTitle}
                          </div>
                          <div className="mt-0.5 font-mono text-[14px] text-neutral-600">
                            {line.accountCode}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-[14px] tabular-nums">
                          {line.debit ? peso.format(line.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-[14px] tabular-nums">
                          {line.credit ? peso.format(line.credit) : "—"}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 text-[14px] text-neutral-500">
                          {index === 0 && (
                            <>
                              <div className="line-clamp-2 break-words">{entry.memo}</div>
                              <div className="mt-1">
                                {entry.postedByName || "Automated posting"}
                              </div>
                            </>
                          )}
                        </td>
                      </m.tr>
                    )),
                  )}
                </AnimatePresence>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-[14px]">
                    Filtered trial balance
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[14px] tabular-nums">
                    {peso.format(totals.debit)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[14px] tabular-nums">
                    {peso.format(totals.credit)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="eflow-financial-status" data-tone={Math.abs(totals.delta) <= 0.009 ? "positive" : "negative"}>{Math.abs(totals.delta) <= 0.009 ? "Balanced" : `Delta ${peso.format(totals.delta)}`}</Badge>
                  </td>
                </tr>
              </tfoot>
            </table>
          </BudgetTableRegion>
        ) : (
          <EmptyState illustration="search" title="No journal entries match" description="Cash releases and settled liquidations post here automatically."/>
        )}
      </section>
      {receipt && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">
          {receipt}
        </p>
      )}
      </div>
      {adjusting && fiscalBudgetId && (
        <JournalAdjustmentDialog
          orgId={orgId}
          fiscalYear={fiscalYear}
          fiscalBudgetId={fiscalBudgetId}
          accounts={journal.accounts}
          onClose={() => setAdjusting(false)}
          onSaved={async () => {
            setReceipt(
              "Correcting entry posted. Refreshing the current journal.",
            );
            setAdjusting(false);
            await journal.refresh();
          }}
        />
      )}
    </div>
  );
}

export function JournalTableSkeleton({ label = "Loading balanced entries…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="overflow-x-auto">
      <span className="sr-only">{label}</span>
      <table className="w-full min-w-[900px] border-collapse text-left" aria-hidden="true">
        <thead className="bg-neutral-50 text-[14px] uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-4 py-3">Date / JEV</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Chart of accounts title</th>
            <th className="px-4 py-3 text-right">Debit</th>
            <th className="px-4 py-3 text-right">Credit</th>
            <th className="px-4 py-3">Memo / recorded by</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4].map((row) => (
            <tr key={row} className="border-t border-neutral-100 align-top">
              <td className="px-4 py-3 space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-neutral-200/80" />
                <div className="h-3 w-28 animate-pulse rounded bg-neutral-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-24 animate-pulse rounded bg-neutral-200/70" />
              </td>
              <td className="px-4 py-3 space-y-1.5">
                <div className="h-3.5 w-44 animate-pulse rounded bg-neutral-200/80" />
                <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-neutral-200/80" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-neutral-100" />
              </td>
              <td className="px-4 py-3 space-y-1.5">
                <div className="h-3.5 w-48 animate-pulse rounded bg-neutral-100" />
                <div className="h-2.5 w-28 animate-pulse rounded bg-neutral-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JournalMetric({
  icon,
  label,
  value,
  note,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  good: boolean;
}) {
  return (
    <m.div
      layout
      className="min-w-0 rounded-[10px] border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-2 break-words text-right text-lg font-semibold tabular-nums ${good ? "text-foreground" : "text-destructive"}`}
      >
        {value}
      </div>
      <div
        className="mt-1 text-right text-xs text-muted-foreground"
      >
        {note}
      </div>
    </m.div>
  );
}

function JournalDateInput({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block min-w-[150px] flex-1 sm:flex-none">
      <CalendarDays
        aria-hidden="true"
        size={13}
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-neutral-500"
      />
      <input
        aria-label={ariaLabel}
        type="date"
        value={value}
        onClick={openDatePicker}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full min-w-0 cursor-pointer rounded-lg border border-neutral-200 bg-white pl-8 pr-2 text-[14px]"
      />
    </label>
  );
}

function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // Native date controls still work when a browser does not expose showPicker.
  }
}
