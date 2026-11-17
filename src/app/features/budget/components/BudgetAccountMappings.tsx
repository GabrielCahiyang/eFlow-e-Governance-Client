import { readableUiError } from '../../../shared/userFacingError';
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AccountingAccount, DepartmentBudgetBundle } from "../types";
import { fetchAccountingAccounts } from "../services/budgetService";
import { mapOfficeBudgetAccount } from "../services/pettyCashVoucherService";
import { sectionLeaves } from "../selectors/budgetSections";

export function BudgetAccountMappings({
  data,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetchAccountingAccounts()
      .then((rows) => {
        if (active) setAccounts(rows.filter((a) => a.classification === "expense"));
      })
      .catch((e) => {
        if (active) setMessage(readableUiError(e, "We couldn’t load the account mappings.", 'read'));
      });
    return () => {
      active = false;
    };
  }, []);

  const map = async (id: string, code: string) => {
    if (!code || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await mapOfficeBudgetAccount(id, code);
      await onChanged();
      setMessage("Journal account mapping saved.");
    } catch (e) {
      setMessage(readableUiError(e, "Mapping could not be saved.", 'write'));
    } finally {
      setBusy(false);
    }
  };

  if (
    !data.sectionsAvailable ||
    !(data.sections || []).some((s) => "journalAccountCode" in s) ||
    data.summary?.status === "closed"
  ) {
    return null;
  }

  const leaves = sectionLeaves(data.sections || []);
  const mappedCount = leaves.filter((s) => Boolean(s.journalAccountCode)).length;

  return (
    <details className="group overflow-hidden rounded-[10px] border border-border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">
              Expense-account mapping
            </h3>
            <span className="rounded-[5px] border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {mappedCount}/{leaves.length} mapped
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Optional per-account General Journal expense override. Unmapped accounts post to the default office expense code.
          </p>
        </div>
        <ChevronRight
          size={15}
          aria-hidden="true"
          className="shrink-0 text-muted-foreground transition group-open:rotate-90"
        />
      </summary>
      <div className="border-t border-border">
        <div className="divide-y divide-border">
          {leaves.map((s) => (
            <label
              key={s.id}
              className="grid items-center gap-3 px-4 py-2.5 text-[12px] sm:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]"
            >
              <div className="min-w-0">
                <span className="font-medium text-foreground">{s.name}</span>
                {s.accountCode && (
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    {s.accountCode}
                  </span>
                )}
              </div>
              <select
                disabled={busy}
                value={s.journalAccountCode || ""}
                onChange={(e) => void map(s.id, e.target.value)}
                className="h-9 w-full rounded-[6px] border border-border bg-card px-2.5 text-[12px] text-foreground"
              >
                <option value="">Default expense account</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {message && (
          <p role="status" className="border-t border-border bg-muted/40 px-4 py-2 text-[12px] text-foreground">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
