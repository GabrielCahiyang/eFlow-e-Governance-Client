import * as m from "motion/react-m";
import { useRef, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import { CalendarDays, CircleAlert, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import {
  postGeneralJournalAdjustment,
  fetchGeneralJournal,
} from "../services/budgetService";
import { isBalancedJournalLines } from "../selectors/journalSelectors";
import {
  journalFingerprint,
  journalAttempt,
  rememberJournalAttempt,
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialErrorMessage,
} from "../financialReceipts";
import { useAuth } from "../../../contexts/AuthContext";
import type { AccountingAccount, JournalAdjustmentLineInput } from "../types";
import { peso } from "./budgetUi";
export function JournalAdjustmentDialog({
  fiscalBudgetId,
  orgId,
  fiscalYear,
  accounts,
  onClose,
  onSaved,
}: {
  fiscalBudgetId: string;
  orgId: string;
  fiscalYear: number;
  accounts: AccountingAccount[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const context = `${orgId}:${fiscalYear}:${fiscalBudgetId}`;
  const latestContext = useRef(context);
  latestContext.current = context;
  const { userProfile, can } = useAuth();
  const confirmation = useConfirmation();
  const pending = useRef(false);
  const initialDate = useRef(new Date().toISOString().slice(0, 10));
  const initialLines = useRef(
    JSON.stringify([
      { accountCode: accounts[0]?.code || "", debit: 0, credit: 0 },
      {
        accountCode: accounts[1]?.code || accounts[0]?.code || "",
        debit: 0,
        credit: 0,
      },
    ]),
  );
  const [verified, setVerified] = useState("");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<JournalAdjustmentLineInput[]>([
    { accountCode: accounts[0]?.code || "", debit: 0, credit: 0 },
    {
      accountCode: accounts[1]?.code || accounts[0]?.code || "",
      debit: 0,
      credit: 0,
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = useExplicitDraft(
    "Journal adjustment",
    !verified &&
      Boolean(
        reference ||
          memo ||
          entryDate !== initialDate.current ||
          JSON.stringify(lines) !== initialLines.current,
      ),
    busy,
    () => {
      setReference("");
      setMemo("");
      setEntryDate(initialDate.current);
      setLines(JSON.parse(initialLines.current));
    },
  );
  const close = () => {
    void requestNavigation(onClose);
  };
  const key = `journal:${userProfile?.id}:${fiscalBudgetId}:${reference.trim()}`;
  const verify = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const entries = await fetchGeneralJournal(orgId, fiscalYear);
      const proof = journalAttempt(key);
      const candidates = entries.filter(
        (item) =>
          proof &&
          !proof.ids.includes(item.id) &&
          item.fiscalBudgetId === fiscalBudgetId &&
          item.sourceType === "manual_adjustment" &&
          item.postedBy === userProfile?.id &&
          journalFingerprint(item) === proof.fingerprint,
      );
      const entry = candidates.length === 1 ? candidates[0] : undefined;
      if (entry) {
        recordFinancialOutcome(key, "saved");
        draft.markClean();
        setVerified(
          `Confirmed journal entry ${entry.id}. Do not post it again.`,
        );
      } else
        setError(
          "No matching posting could be confirmed. Keep this draft and review financial history before another adjustment; a lost response is not proof of failure.",
        );
    } catch (caught) {
      setError(financialErrorMessage(caught));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const totals = lines.reduce(
    (sum, line) => ({
      debit: sum.debit + Number(line.debit || 0),
      credit: sum.credit + Number(line.credit || 0),
    }),
    { debit: 0, credit: 0 },
  );
  const update = (index: number, patch: Partial<JournalAdjustmentLineInput>) =>
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  const submit = async () => {
    if (
      pending.current ||
      !reference.trim() ||
      !memo.trim() ||
      !isBalancedJournalLines(lines) ||
      userProfile?.role !== "accounting_staff" ||
      !can("accounting.post_journal")
    )
      return;
    if (financialOutcome(key)) {
      setError(
        "A previous posting has a saved or uncertain result. Verify the journal before continuing.",
      );
      return;
    }
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setError("");
    let submitted = false;
    try {
      if (
        !(await confirmation.confirm({
          title: "Post permanent correcting entry?",
          description: `Office ${orgId} · FY ${fiscalYear}. Reference ${reference}. ${memo}. Debit ${peso.format(totals.debit)} and credit ${peso.format(totals.credit)} across ${lines.length} lines. This appends an immutable journal entry; a later correction needs another balanced entry.`,
          actionLabel: "Confirm posting",
          impact: (
            <ul className="text-sm">
              {lines.map((line, index) => (
                <li key={index}>
                  {line.accountCode}: debit {peso.format(Number(line.debit))},
                  credit {peso.format(Number(line.credit))}
                </li>
              ))}
            </ul>
          ),
        }))
      )
        return;
      if (latestContext.current !== context) {
        setError(
          "Financial context changed while being reviewed. Reopen the adjustment in its current Office and fiscal year.",
        );
        return;
      }
      const before = await fetchGeneralJournal(orgId, fiscalYear);
      rememberJournalAttempt(key, {
        ids: before.map((entry) => entry.id),
        fingerprint: journalFingerprint({
          entryDate,
          referenceNumber: reference,
          memo,
          lines,
        }),
      });
      submitted = true;
      const id = await postGeneralJournalAdjustment({
        fiscalBudgetId,
        entryDate,
        referenceNumber: reference,
        memo,
        lines,
      });
      recordFinancialOutcome(key, "saved");
      draft.markClean();
      setVerified(`Journal entry ${id} posted. Do not repeat it.`);
      await onSaved();
    } catch (caught) {
      if (
        submitted &&
        !financialOutcome(key) &&
        financialFailureIsUncertain(caught)
      )
        recordFinancialOutcome(key, "uncertain");
      setError(
        financialErrorMessage(caught) +
          (financialOutcome(key) === "saved"
            ? " Posting saved; refresh failed. Do not repeat it."
            : financialOutcome(key) === "uncertain"
              ? " Outcome uncertain. Verify the journal before another posting."
              : " Your entries are retained."),
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };
  const invalid =
    busy ||
    Boolean(financialOutcome(key)) ||
    !reference.trim() ||
    !memo.trim() ||
    !isBalancedJournalLines(lines);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 overflow-y-auto bg-white"
        style={{ maxWidth: 760 }}
      >
        {confirmation.dialog}
        <DialogHeader>
          <DialogTitle>Post correcting journal entry</DialogTitle>
          <DialogDescription>
            Posted entries are permanent. Reverse an error with a new balanced
            entry instead of editing history.
          </DialogDescription>
        </DialogHeader>
        {verified && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">
            {verified}
          </p>
        )}
        {financialOutcome(key) === "uncertain" && (
          <Button
            kind="secondary"
            disabled={busy}
            onClick={() => void verify()}
          >
            Verify journal outcome
          </Button>
        )}
        <fieldset
          disabled={busy || Boolean(financialOutcome(key))}
          className="min-w-0 space-y-4"
        >
          <div
            className="flex min-w-0 gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950"
            role="note"
          >
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              size={16}
            />
            <div className="min-w-0 text-[11px] leading-relaxed">
              <div className="font-semibold">Append-only accounting record</div>
              <p>
                Confirm the reference, accounts, and amount. This entry cannot
                be edited or deleted after posting.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Entry date"
              type="date"
              value={entryDate}
              onChange={setEntryDate}
            />
            <Field
              label="Reference number"
              value={reference}
              onChange={setReference}
            />
          </div>
          <Field
            label="Memo / correction reason"
            value={memo}
            onChange={setMemo}
          />
          <div className="min-w-0 space-y-2">
            {lines.map((line, index) => (
              <m.div
                layout
                key={index}
                className="grid min-w-0 grid-cols-2 gap-2 rounded-xl border border-neutral-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,112px)_minmax(0,112px)_32px]"
              >
                <label className="col-span-2 min-w-0 text-[10px] text-neutral-600 md:col-span-1">
                  Account {index + 1}
                  <select
                    aria-label={`Account line ${index + 1}`}
                    value={line.accountCode}
                    onChange={(event) =>
                      update(index, { accountCode: event.target.value })
                    }
                    className="mt-1 h-9 w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-2 text-[10px]"
                  >
                    {accounts.map((account) => (
                      <option key={account.code} value={account.code}>
                        {account.code} · {account.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-[10px] text-neutral-600">
                  Debit
                  <input
                    aria-label={`Debit line ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={line.debit || ""}
                    onChange={(event) =>
                      update(index, {
                        debit: Number(event.target.value),
                        credit: event.target.value ? 0 : line.credit,
                      })
                    }
                    className="mt-1 h-9 w-full min-w-0 rounded-lg border border-neutral-200 px-2 text-[10px]"
                  />
                </label>
                <label className="min-w-0 text-[10px] text-neutral-600">
                  Credit
                  <input
                    aria-label={`Credit line ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={line.credit || ""}
                    onChange={(event) =>
                      update(index, {
                        credit: Number(event.target.value),
                        debit: event.target.value ? 0 : line.debit,
                      })
                    }
                    className="mt-1 h-9 w-full min-w-0 rounded-lg border border-neutral-200 px-2 text-[10px]"
                  />
                </label>
                <button
                  aria-label={`Remove line ${index + 1}`}
                  type="button"
                  disabled={lines.length <= 2}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, lineIndex) => lineIndex !== index),
                    )
                  }
                  className="col-span-2 h-9 w-9 justify-self-end rounded-lg text-neutral-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 md:col-span-1 md:self-end"
                >
                  <X size={14} />
                </button>
              </m.div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              kind="tertiary"
              size="small"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { accountCode: accounts[0]?.code || "", debit: 0, credit: 0 },
                ])
              }
            >
              <Plus size={13} /> Add line
            </Button>
            <div className="text-[10px] text-neutral-600">
              Debit {peso.format(totals.debit)} · Credit{" "}
              {peso.format(totals.credit)} · Delta{" "}
              {peso.format(totals.debit - totals.credit)}
            </div>
          </div>
          {error && <AttentionBox type="negative" text={error} />}
        </fieldset>
        <DialogFooter>
          <Button kind="secondary" size="small" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            kind="primary"
            size="small"
            loading={busy}
            disabled={invalid}
            onClick={() => void submit()}
          >
            Post balanced entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-[10px] text-neutral-600">
      {label}
      <span className="relative mt-1 block min-w-0">
        {type === "date" && (
          <CalendarDays
            aria-hidden="true"
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-neutral-500"
          />
        )}
        <input
          aria-label={label}
          type={type}
          value={value}
          onClick={type === "date" ? openDatePicker : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`h-9 w-full min-w-0 rounded-lg border border-neutral-200 pr-2.5 text-[10.5px] ${type === "date" ? "cursor-pointer pl-8" : "pl-2.5"}`}
        />
      </span>
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
