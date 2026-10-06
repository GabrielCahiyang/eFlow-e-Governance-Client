import { useEffect, useMemo, useState } from "react";
import {
  AttentionBox,
  Button,
  Label,
  Loader,
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
import type { GeneralJournalEntry } from "../types";
import { peso } from "./budgetUi";
import { JournalAdjustmentDialog } from "./JournalAdjustmentDialog";
import { JournalEntryInspector } from "./JournalEntryInspector";
export function GeneralJournalWorkspace({
  orgId: providedOrgId,
  fiscalYear = new Date().getFullYear(),
  fiscalBudgetId,
  approvedBudget,
  settledExpenses,
  returnedCash,
}: {
  orgId?: string;
  fiscalYear?: number;
  fiscalBudgetId?: string;
  approvedBudget?: number;
  settledExpenses?: number;
  returnedCash?: number;
}) {
  const { userProfile, can } = useAuth();
  const orgId =
    providedOrgId || userProfile?.org_id || userProfile?.departmentId || "";
  const journal = useGeneralJournal(orgId, fiscalYear);
  const [query, setQuery] = useState("");
  const [classification, setClassification] = useState("all");
  const [startDate, setStartDate] = useState(`${fiscalYear}-01-01`);
  const [endDate, setEndDate] = useState(`${fiscalYear}-12-31`);
  const [inspected, setInspected] = useState<GeneralJournalEntry | null>(null);
  const [receipt, setReceipt] = useState("");
  useEffect(() => {
    setStartDate(`${fiscalYear}-01-01`);
    setEndDate(`${fiscalYear}-12-31`);
    setInspected(null);
  }, [fiscalYear]);
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
  const available =
    approvedBudget == null
      ? undefined
      : approvedBudget - (settledExpenses || 0) + (returnedCash || 0);

  return (
    <div className="space-y-4">
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
              : "Authorized − expense + refund"
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
      <button
        type="button"
        className="rounded-lg border px-3 py-2 text-sm"
        disabled={journal.refreshing}
        onClick={() => void journal.refresh()}
      >
        Refresh journal
      </button>
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-neutral-100 p-4 xl:flex-row xl:items-center">
          <VibeSearch
            className="min-w-0 flex-1"
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
              className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-[12px]"
            >
              <option value="all">All account classes</option>
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
            {fiscalBudgetId && !journal.error && userProfile?.role === "accounting_staff" && can("accounting.post_journal") && (
              <Button
                kind="primary"
                size="small"
                onClick={() => setAdjusting(true)}
              >
                <Plus size={13} /> Post adjustment
              </Button>
            )}
          </div>
        </header>
        {journal.loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-[12px] text-neutral-500">
            <Loader size="small" /> Loading balanced entries…
          </div>
        ) : filteredEntries.length ? (
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Journal line items"
            tabIndex={0}
          >
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
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
                        className="border-t border-neutral-100 align-top"
                      >
                        <td className="px-4 py-3 text-[12px] text-neutral-600">
                          {index === 0 && (
                            <>
                              <div>
                                {new Date(
                                  `${entry.entryDate}T00:00:00`,
                                ).toLocaleDateString()}
                              </div>
                              <div className="mt-1 font-mono text-[11px] text-neutral-400">
                                JEV-{fiscalYear}-
                                {String(entry.entryNumber).padStart(6, "0")}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-neutral-700">
                          {index === 0 ? (
                            <button
                              type="button"
                              className="text-primary underline"
                              aria-label={`Inspect journal ${entry.referenceNumber}`}
                              onClick={() =>
                                setInspected(
                                  journal.entries.find(
                                    (item) => item.id === entry.id,
                                  ) || entry,
                                )
                              }
                            >
                              {entry.referenceNumber}
                            </button>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] font-medium text-neutral-800">
                            {line.accountTitle}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-neutral-400">
                            {line.accountCode}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] tabular-nums">
                          {line.debit ? peso.format(line.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] tabular-nums">
                          {line.credit ? peso.format(line.credit) : "—"}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 text-[11px] text-neutral-500">
                          {index === 0 && (
                            <>
                              <div>{entry.memo}</div>
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
                  <td colSpan={3} className="px-4 py-3 text-[12px]">
                    Filtered trial balance
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] tabular-nums">
                    {peso.format(totals.debit)}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] tabular-nums">
                    {peso.format(totals.credit)}
                  </td>
                  <td className="px-4 py-3">
                    <Label
                      color={
                        Math.abs(totals.delta) <= 0.009
                          ? "positive"
                          : "negative"
                      }
                      text={
                        Math.abs(totals.delta) <= 0.009
                          ? "Balanced"
                          : `Delta ${peso.format(totals.delta)}`
                      }
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <BookOpenCheck size={30} className="mx-auto text-neutral-300" />
            <h3 className="mt-3 text-[12px] font-semibold">
              No journal entries match
            </h3>
            <p className="mt-1 text-[12px] text-neutral-500">
              Cash releases and settled liquidations post here automatically.
            </p>
          </div>
        )}
      </section>
      {receipt && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">
          {receipt}
        </p>
      )}
      {inspected && (
        <JournalEntryInspector
          entry={inspected}
          onClose={() => setInspected(null)}
        />
      )}
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
      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </div>
      <div
        className={`mt-2 text-right text-[18px] font-semibold tabular-nums ${good ? "text-neutral-950" : "text-rose-700"}`}
      >
        {value}
      </div>
      <div
        className={`mt-1 text-right text-[11px] ${good ? "text-emerald-700" : "text-rose-600"}`}
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
        className="h-8 w-full min-w-0 cursor-pointer rounded-lg border border-neutral-200 bg-white pl-8 pr-2 text-[10px]"
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
