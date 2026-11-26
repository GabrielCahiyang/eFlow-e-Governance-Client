import * as m from "motion/react-m";
import { useEffect, useId, useRef, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import { CircleAlert, Plus, X } from "lucide-react";
import { BoundedTextarea, BoundedTextInput } from "../../../components/ui/BoundedInput";
import { DateInput } from "../../../components/ui/DateInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { getPhilippineCalendarDate, historicalDateError } from "../../../shared/calendarDates";
import { diffCentavos, sumCentavos, toCentavos } from "../../../shared/currency";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
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
  financialWriteFeedback,
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
  const initialDate = useRef(getPhilippineCalendarDate());
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
  const [referenceTouched, setReferenceTouched] = useState(false);
  const [memo, setMemo] = useState("");
  const [memoTouched, setMemoTouched] = useState(false);
  const [entryDate, setEntryDate] = useState(
    getPhilippineCalendarDate(),
  );
  const [entryDateTouched, setEntryDateTouched] = useState(false);
  const [entryDateInvalidText, setEntryDateInvalidText] = useState(false);
  const [touchedLines, setTouchedLines] = useState<Record<number, boolean>>({});
  const entryDateId = useId();
  const referenceId = useId();
  const memoId = useId();
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
  const outcomeNotice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) outcomeNotice.current?.scrollIntoView?.({ block: 'nearest' });
  }, [error]);
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
    setError("");
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
          "We couldn’t find one matching entry in the journal. Keep this draft and check financial history with Accounting before posting again.",
        );
    } catch (caught) {
      setError(financialErrorMessage(caught, "We couldn’t check the journal. Reload it to verify the posting before continuing.", 'read'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const today = getPhilippineCalendarDate();
  const entryDateError = entryDateInvalidText
    ? "Enter a valid entry date in MM/DD/YYYY format."
    : historicalDateError(entryDate, "Entry date");
  const visibleEntryDateError =
    entryDateTouched || entryDateInvalidText || Boolean(entryDate && entryDate > today)
      ? entryDateError
      : "";
  const referenceError = textLengthError(reference, "Reference number", {
    required: true,
    max: 64,
  });
  const visibleReferenceError =
    referenceTouched || reference.length > 64 ? referenceError : "";
  const memoError = textLengthError(memo, "Memo / correction reason", {
    required: true,
    max: 500,
  });
  const visibleMemoError = memoTouched || memo.length > 500 ? memoError : "";

  const totals = {
    debit: sumCentavos(lines.map((line) => Number(line.debit || 0))),
    credit: sumCentavos(lines.map((line) => Number(line.credit || 0))),
  };
  const delta = diffCentavos(totals.debit, totals.credit);
  const balanced = isBalancedJournalLines(lines);
  const missingAccount = lines.some((line) => !line.accountCode);

  const update = (index: number, patch: Partial<JournalAdjustmentLineInput>) =>
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  const submit = async () => {
    const dateIssue = entryDateError;
    if (dateIssue || referenceError || memoError) {
      setEntryDateTouched(true);
      setReferenceTouched(true);
      setMemoTouched(true);
      setError(dateIssue || referenceError || memoError);
      return;
    }
    if (
      pending.current ||
      !reference.trim() ||
      !memo.trim() ||
      !balanced ||
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
      setError(financialWriteFeedback(caught, {
        outcome: financialOutcome(key), submitted, action: 'Your journal entry',
        record: 'the journal', draft: 'Your entries are still in the form.',
      }));
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };
  const invalid =
    busy ||
    Boolean(financialOutcome(key)) ||
    Boolean(entryDateError) ||
    Boolean(referenceError) ||
    Boolean(memoError) ||
    !balanced;

  const postBlockers = [
    financialOutcome(key)
      ? "A previous posting already completed or requires verification."
      : "",
    entryDateError,
    referenceError,
    memoError,
    missingAccount ? "Select an account for every journal line." : "",
    !balanced
      ? toCentavos(totals.debit) <= 0 && toCentavos(totals.credit) <= 0
        ? "Enter debit and credit amounts to balance this entry."
        : toCentavos(totals.debit) !== toCentavos(totals.credit)
          ? `Debits (${peso.format(totals.debit)}) must equal credits (${peso.format(totals.credit)}). Difference: ${peso.format(Math.abs(delta))}.`
          : "Each line needs a valid account and a positive debit or credit amount."
      : "",
  ];

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
            A journal entry records which accounts are debited and credited.
            To correct a posted entry, post a new balanced entry.
          </DialogDescription>
        </DialogHeader>
        {verified && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">
            {verified}
          </p>
        )}
        {error && financialOutcome(key) && (
          <div ref={outcomeNotice}>
            <AttentionBox type="warning" text={error} />
          </div>
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
              <div className="font-semibold">Check your entry before posting</div>
              <p>
                Confirm the reference, accounts, and amount. This entry cannot
                be edited or deleted after posting.
                {" "}Use at most two decimal places; debit and credit totals must match exactly.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 text-[10px] text-neutral-600">
              <label htmlFor={entryDateId} className="block">
                Entry date{" "}
                <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                  *
                </span>
              </label>
              <div className="mt-1">
                <DateInput
                  id={entryDateId}
                  aria-label="Entry date"
                  aria-required="true"
                  max={today}
                  value={entryDate}
                  hasError={Boolean(visibleEntryDateError)}
                  errorMessage={visibleEntryDateError || undefined}
                  onInvalidTextChange={setEntryDateInvalidText}
                  onBlur={() => setEntryDateTouched(true)}
                  onChange={(event) => {
                    setEntryDateTouched(true);
                    setEntryDate(event.target.value);
                  }}
                  className="h-9 w-full min-w-0 rounded-lg border border-neutral-200 px-2.5 text-[10.5px]"
                />
              </div>
              {visibleEntryDateError && (
                <p role="alert" className="mt-1 text-[11px] text-rose-700">
                  {visibleEntryDateError}
                </p>
              )}
            </div>
            <div className="min-w-0 text-[10px] text-neutral-600">
              <label htmlFor={referenceId} className="block">
                Reference number{" "}
                <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                  *
                </span>
              </label>
              <BoundedTextInput
                id={referenceId}
                aria-label="Reference number"
                aria-required="true"
                maxLength={64}
                value={reference}
                error={visibleReferenceError || undefined}
                onBlur={() => setReferenceTouched(true)}
                onChange={(event) => {
                  setReferenceTouched(true);
                  setReference(event.target.value);
                }}
                className="mt-1 h-9 w-full min-w-0 rounded-lg border border-neutral-200 pl-2.5 pr-2.5 text-[10.5px]"
              />
            </div>
          </div>
          <div className="min-w-0 text-[10px] text-neutral-600">
            <label htmlFor={memoId} className="block">
              Memo / correction reason{" "}
              <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                *
              </span>
            </label>
            <BoundedTextarea
              id={memoId}
              aria-label="Memo / correction reason"
              aria-required="true"
              maxLength={500}
              rows={2}
              value={memo}
              error={visibleMemoError || undefined}
              onBlur={() => setMemoTouched(true)}
              onChange={(event) => {
                setMemoTouched(true);
                setMemo(event.target.value);
              }}
              className="mt-1 w-full min-w-0 rounded-lg border border-neutral-200 px-2.5 py-2 text-[10.5px]"
            />
          </div>
          <div className="min-w-0 space-y-2">
            {lines.map((line, index) => (
              <JournalLineRow
                key={index}
                index={index}
                line={line}
                accounts={accounts}
                busy={busy}
                canRemove={lines.length > 2}
                touched={Boolean(touchedLines[index])}
                onTouch={() =>
                  setTouchedLines((prev) => (prev[index] ? prev : { ...prev, [index]: true }))
                }
                onChange={(patch) => update(index, patch)}
                onRemove={() =>
                  setLines((current) =>
                    current.filter((_, lineIndex) => lineIndex !== index),
                  )
                }
              />
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
            <div
              className={`text-[10px] tabular-nums ${
                toCentavos(delta) !== 0 ? "font-semibold text-rose-700" : "text-neutral-600"
              }`}
            >
              Debit {peso.format(totals.debit)} · Credit{" "}
              {peso.format(totals.credit)} · Delta{" "}
              {peso.format(delta)}
            </div>
          </div>
          {error && !financialOutcome(key) && <AttentionBox type="negative" text={error} />}
        </fieldset>
        <DialogFooter>
          <Button kind="secondary" size="small" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <ActionBlockerGroup
            actionLabel="Post balanced entry"
            blockers={invalid ? postBlockers : []}
            busy={busy}
            size="sm"
          >
            <WorkspaceTooltip
              content="Posts an immutable correcting entry to the general journal. This cannot be edited or deleted."
              disabled={invalid}
            >
              <Button
                kind="primary"
                size="small"
                loading={busy}
                disabled={invalid}
                onClick={() => void submit()}
              >
                Post balanced entry
              </Button>
            </WorkspaceTooltip>
          </ActionBlockerGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JournalLineRow({
  index,
  line,
  accounts,
  busy,
  canRemove,
  touched,
  onTouch,
  onChange,
  onRemove,
}: {
  index: number;
  line: JournalAdjustmentLineInput;
  accounts: AccountingAccount[];
  busy: boolean;
  canRemove: boolean;
  touched: boolean;
  onTouch: () => void;
  onChange: (patch: Partial<JournalAdjustmentLineInput>) => void;
  onRemove: () => void;
}) {
  const idPrefix = useId();
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [selectActive, setSelectActive] = useState(false);

  const accountError = !line.accountCode ? "Select an account." : "";
  const debitCents = toCentavos(Number(line.debit || 0));
  const creditCents = toCentavos(Number(line.credit || 0));
  const lineAmountError =
    debitCents > 0 && creditCents > 0
      ? "Enter either a debit or a credit per line."
      : touched && debitCents <= 0 && creditCents <= 0
        ? "Enter a debit or credit amount."
        : "";

  const accountId = `${idPrefix}-account`;
  const accountTipId = `${idPrefix}-account-tip`;
  const debitId = `${idPrefix}-debit`;
  const creditId = `${idPrefix}-credit`;

  return (
    <m.div
      layout
      className="grid min-w-0 grid-cols-2 gap-2 rounded-xl border border-neutral-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,112px)_minmax(0,112px)_auto]"
    >
      <div className="col-span-2 min-w-0 text-[10px] text-neutral-600 md:col-span-1">
        <label htmlFor={accountId} className="block">
          Account {index + 1}{" "}
          <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
            *
          </span>
        </label>
        <select
          ref={selectRef}
          id={accountId}
          aria-label={`Account line ${index + 1}`}
          aria-required="true"
          aria-invalid={Boolean(accountError) || undefined}
          aria-describedby={selectActive && accountError ? accountTipId : undefined}
          value={line.accountCode}
          onFocus={() => setSelectActive(true)}
          onMouseEnter={() => setSelectActive(true)}
          onMouseLeave={() => setSelectActive(false)}
          onBlur={() => {
            setSelectActive(false);
            onTouch();
          }}
          onChange={(event) => {
            onTouch();
            onChange({ accountCode: event.target.value });
          }}
          className={`mt-1 h-9 w-full min-w-0 rounded-lg border bg-white px-2 text-[10px] ${
            accountError ? "eflow-field-invalid border-rose-400 bg-rose-50" : "border-neutral-200"
          }`}
        >
          {accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {account.code} · {account.title}
            </option>
          ))}
        </select>
        <FieldValidationTooltip
          id={accountTipId}
          anchorRef={selectRef}
          message={accountError}
          open={selectActive && Boolean(accountError)}
          tone="error"
        />
        {accountError && (
          <p role="alert" className="mt-1 text-[10.5px] text-rose-700">
            {accountError}
          </p>
        )}
      </div>
      <div className="min-w-0 text-[10px] text-neutral-600">
        <label htmlFor={debitId} className="block">
          Debit
        </label>
        <MoneyInput
          id={debitId}
          aria-label={`Debit line ${index + 1}`}
          min="0"
          max={INPUT_LIMITS.MONEY_MAX_BUDGET}
          step="0.01"
          placeholder="0.00"
          value={line.debit || ""}
          externalError={lineAmountError || undefined}
          onBlur={onTouch}
          onValueChange={(raw) => {
            onTouch();
            onChange({
              debit: Number(raw),
              credit: raw ? 0 : line.credit,
            });
          }}
          className="mt-1 h-9 w-full min-w-0 rounded-lg border border-neutral-200 px-2 text-[10px]"
        />
      </div>
      <div className="min-w-0 text-[10px] text-neutral-600">
        <label htmlFor={creditId} className="block">
          Credit
        </label>
        <MoneyInput
          id={creditId}
          aria-label={`Credit line ${index + 1}`}
          min="0"
          max={INPUT_LIMITS.MONEY_MAX_BUDGET}
          step="0.01"
          placeholder="0.00"
          value={line.credit || ""}
          externalError={lineAmountError || undefined}
          onBlur={onTouch}
          onValueChange={(raw) => {
            onTouch();
            onChange({
              credit: Number(raw),
              debit: raw ? 0 : line.debit,
            });
          }}
          className="mt-1 h-9 w-full min-w-0 rounded-lg border border-neutral-200 px-2 text-[10px]"
        />
      </div>
      <div className="col-span-2 justify-self-end md:col-span-1 md:self-end">
        <ActionBlockerGroup
          actionLabel={`Remove line ${index + 1}`}
          blockers={!canRemove ? "A journal entry requires at least 2 lines." : []}
          busy={busy}
          compact
          size="sm"
        >
          <WorkspaceTooltip content={`Remove line ${index + 1}.`} disabled={!canRemove}>
            <button
              aria-label={`Remove line ${index + 1}`}
              type="button"
              disabled={!canRemove}
              onClick={onRemove}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
            >
              <X size={14} />
            </button>
          </WorkspaceTooltip>
        </ActionBlockerGroup>
      </div>
    </m.div>
  );
}
