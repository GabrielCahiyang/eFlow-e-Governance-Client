import { useId, useRef, useState } from "react";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { diffCentavos, exceedsCentavos, formatPeso, sumCentavos, toCentavos } from "../../../shared/currency";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { readableUiError } from "../../../shared/userFacingError";
import type { Task } from "../../tasks";
import type { BudgetSection, DepartmentBudgetBundle } from "../types";
import { sectionLeaves } from "../selectors/budgetSections";
import { isOpenDirectFundingWork } from "../selectors/directFundingEligibility";
import { fundOfficeWork, type DirectFundingLine } from "../services/directFundingService";
import { peso } from "./budgetUi";

function availableForSection(section: BudgetSection): number {
  return Math.max(
    0,
    diffCentavos(section.amount, sumCentavos([section.heldAmount, section.committedAmount || 0])),
  );
}

export function DirectWorkFunding({
  data,
  tasks,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  tasks: Task[];
  onChanged: () => Promise<void>;
}) {
  const workId = useId();
  const workTipId = useId();
  const reasonId = useId();
  const workRef = useRef<HTMLSelectElement | null>(null);
  const [workActive, setWorkActive] = useState(false);
  const [workTouched, setWorkTouched] = useState(false);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [lineTouched, setLineTouched] = useState<Record<number, { account?: boolean; amount?: boolean }>>({});

  const [taskId, setTaskId] = useState(tasks.length === 1 ? tasks[0].id : "");
  const [lines, setLines] = useState<DirectFundingLine[]>(() => [
    {
      partitionId: sectionLeaves(data.sections || []).length === 1 ? sectionLeaves(data.sections || [])[0].id : "",
      amount: tasks.length === 1 ? tasks[0].budgetImpact || 0 : 0,
      particular: "",
    },
  ]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const key = useRef(crypto.randomUUID());
  const confirmation = useConfirmation();
  const baseline = useRef({ taskId, lines });
  const showForm = data.summary?.status === "locked" && data.sectionsAvailable;
  const dirty = Boolean(
    showForm &&
      (reason ||
        taskId !== baseline.current.taskId ||
        JSON.stringify(lines) !== JSON.stringify(baseline.current.lines)),
  );
  const draft = useExplicitDraft("Work funding authorization", dirty, busy, () => {
    setTaskId(baseline.current.taskId);
    setLines(baseline.current.lines);
    setReason("");
  });

  const leaves = sectionLeaves(data.sections || []);
  const leafById = new Map(leaves.map((section) => [section.id, section]));
  const total = sumCentavos(
    lines.map((line) => (Number.isFinite(line.amount) && line.amount > 0 ? line.amount : 0)),
  );
  const availableTasks = tasks.filter(
    (task) =>
      isOpenDirectFundingWork(task) &&
      !data.allocations.some((allocation) => allocation.taskId === task.id && !allocation.subtaskId && allocation.status === "approved"),
  );

  const partitionCounts = new Map<string, number>();
  for (const line of lines) {
    if (line.partitionId) partitionCounts.set(line.partitionId, (partitionCounts.get(line.partitionId) ?? 0) + 1);
  }

  const workError = !taskId || !availableTasks.some((task) => task.id === taskId)
    ? "Select an unfunded work item."
    : "";
  const visibleWorkError = workTouched ? workError : "";

  const lineValidation = lines.map((line) => {
    const section = leafById.get(line.partitionId);
    const available = section ? availableForSection(section) : undefined;
    const isDuplicate = Boolean(line.partitionId && (partitionCounts.get(line.partitionId) ?? 0) > 1);
    const accountError = !line.partitionId
      ? "Choose an annual account."
      : isDuplicate
        ? "Each funding account can only be selected once."
        : "";
    const overAvailable = available !== undefined && Number.isFinite(line.amount) && exceedsCentavos(line.amount, available);
    const amountError =
      !Number.isFinite(line.amount) || toCentavos(line.amount) <= 0
        ? "Enter an approved amount greater than ₱0.00."
        : exceedsCentavos(line.amount, INPUT_LIMITS.MONEY_MAX_BUDGET)
          ? `Amount cannot exceed ${formatPeso(INPUT_LIMITS.MONEY_MAX_BUDGET)}.`
          : overAvailable
            ? `Amount exceeds the ${peso.format(available!)} available in this account.`
            : "";
    return { accountError, amountError, available, overAvailable };
  });

  const reasonError = textLengthError(reason, "Reason / approved authority reference", {
    required: true,
    min: 5,
    max: INPUT_LIMITS.FUNDING_REASON,
  });
  const visibleReasonError = reasonTouched || reason.length > 0 ? reasonError : "";

  const lineBlockers =
    lines.length === 0
      ? ["Add at least one funding account line."]
      : lineValidation.flatMap((entry, idx) => {
          const prefix = lines.length > 1 ? `Line ${idx + 1}: ` : "";
          return [
            entry.accountError ? `${prefix}${entry.accountError}` : "",
            entry.amountError ? `${prefix}${entry.amountError}` : "",
          ].filter(Boolean);
        });
  const submitBlockers = [workError, ...lineBlockers, reasonError].filter(Boolean);
  const valid = submitBlockers.length === 0;

  const submit = async () => {
    setWorkTouched(true);
    setReasonTouched(true);
    if (pending.current || !valid || !data.summary) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (
        !(await confirmation.confirm({
          title: "Authorize funding for this work?",
          description: `FY ${data.summary.fiscalYear}: ${peso.format(total)}. This charges the selected annual accounts once. Planning estimates do not approve money. Authority: ${reason}`,
          actionLabel: "Authorize funding",
        }))
      )
        return;
      await fundOfficeWork({
        taskId,
        fiscalYear: data.summary.fiscalYear,
        lines,
        reason: reason.trim(),
        authorizationKey: key.current,
      });
      const cleared = [{ partitionId: "", amount: 0, particular: "" }];
      baseline.current = { taskId, lines: cleared };
      draft.markClean();
      setReason("");
      setLines(cleared);
      setWorkTouched(false);
      setReasonTouched(false);
      setLineTouched({});
      key.current = crypto.randomUUID();
      setMessage("Work funding authorized.");
      await onChanged();
    } catch (caught) {
      setMessage(readableUiError(caught, "Funding could not be authorized. Refresh before retrying.", "write"));
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };

  if (!showForm) return null;

  return (
    <section className="min-w-0 rounded-[10px] border border-border bg-card p-4">
      {confirmation.dialog}
      <h3 className="text-sm font-semibold">Fund current work</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Authorize funding for manually created or imported work.
      </p>

      <div className="mt-3 block text-[12px]">
        <label htmlFor={workId} className="block font-medium text-foreground">
          Work{" "}
          <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
            *
          </span>
        </label>
        <select
          ref={workRef}
          id={workId}
          aria-required="true"
          aria-invalid={Boolean(visibleWorkError) || undefined}
          aria-describedby={workActive && visibleWorkError ? workTipId : undefined}
          disabled={busy}
          value={taskId}
          onFocus={() => setWorkActive(true)}
          onMouseEnter={() => setWorkActive(true)}
          onMouseLeave={() => setWorkActive(false)}
          onBlur={() => {
            setWorkActive(false);
            setWorkTouched(true);
          }}
          onChange={(event) => {
            setWorkTouched(true);
            setTaskId(event.target.value);
          }}
          className={`mt-1 h-10 w-full rounded-lg border px-3 ${
            visibleWorkError ? "eflow-field-invalid border-destructive" : "border-border"
          }`}
        >
          <option value="">Select unfunded work</option>
          {availableTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        <FieldValidationTooltip
          id={workTipId}
          anchorRef={workRef}
          message={visibleWorkError}
          open={workActive && Boolean(visibleWorkError)}
          tone="error"
        />
        {visibleWorkError && (
          <p role="alert" className="mt-1 text-[11px] text-destructive">
            {visibleWorkError}
          </p>
        )}
      </div>

      {lines.map((line, index) => (
        <DirectFundingLineRow
          key={index}
          index={index}
          line={line}
          leaves={leaves}
          busy={busy}
          canRemove={lines.length > 1}
          accountError={lineTouched[index]?.account ? lineValidation[index].accountError : ""}
          amountError={
            lineTouched[index]?.amount || lineValidation[index].overAvailable
              ? lineValidation[index].amountError
              : ""
          }
          availableMax={lineValidation[index].available}
          onTouchAccount={() =>
            setLineTouched((prev) => ({ ...prev, [index]: { ...prev[index], account: true } }))
          }
          onTouchAmount={() =>
            setLineTouched((prev) => ({ ...prev, [index]: { ...prev[index], amount: true } }))
          }
          onChangeAccount={(partitionId) =>
            setLines((current) =>
              current.map((entry, idx) => (idx === index ? { ...entry, partitionId } : entry)),
            )
          }
          onChangeAmount={(amount) =>
            setLines((current) =>
              current.map((entry, idx) => (idx === index ? { ...entry, amount } : entry)),
            )
          }
          onRemove={() => setLines((current) => current.filter((_, idx) => idx !== index))}
        />
      ))}

      <button
        type="button"
        disabled={busy}
        onClick={() => setLines((current) => [...current, { partitionId: "", amount: 0, particular: "" }])}
        className="mt-3 rounded-lg border px-3 py-2 text-[12px]"
      >
        Add funding account
      </button>

      <div className="mt-3 block text-[12px]">
        <label htmlFor={reasonId} className="block font-medium text-foreground">
          Reason / approved authority reference{" "}
          <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
            *
          </span>
        </label>
        <BoundedTextarea
          id={reasonId}
          aria-required="true"
          disabled={busy}
          maxLength={INPUT_LIMITS.FUNDING_REASON}
          value={reason}
          rows={3}
          error={visibleReasonError || undefined}
          placeholder="Cite the funding authority or reason (at least 5 characters)"
          onBlur={() => setReasonTouched(true)}
          onChange={(event) => {
            setReasonTouched(true);
            setReason(event.target.value);
          }}
          className="mt-1 w-full rounded-lg border p-3"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <strong className="text-[14px] tabular-nums">Funding total: {peso.format(total)}</strong>
        <ActionBlockerGroup
          actionLabel="Authorize work funding"
          blockers={!valid ? submitBlockers : []}
          busy={busy}
          size="md"
        >
          <WorkspaceTooltip
            content="Charges the selected annual office budget accounts once upon confirmation."
            disabled={busy || !valid}
          >
            <button
              type="button"
              disabled={busy || !valid}
              onClick={() => void submit()}
              className="rounded-lg bg-primary px-4 py-2 text-[12px] text-primary-foreground disabled:opacity-40"
            >
              Authorize work funding
            </button>
          </WorkspaceTooltip>
        </ActionBlockerGroup>
      </div>
      {message && <p role="status" className="mt-3 text-[12px]">{message}</p>}
    </section>
  );
}

function DirectFundingLineRow({
  index,
  line,
  leaves,
  busy,
  canRemove,
  accountError,
  amountError,
  availableMax,
  onTouchAccount,
  onTouchAmount,
  onChangeAccount,
  onChangeAmount,
  onRemove,
}: {
  index: number;
  line: DirectFundingLine;
  leaves: BudgetSection[];
  busy: boolean;
  canRemove: boolean;
  accountError: string;
  amountError: string;
  availableMax?: number;
  onTouchAccount: () => void;
  onTouchAmount: () => void;
  onChangeAccount: (partitionId: string) => void;
  onChangeAmount: (amount: number) => void;
  onRemove: () => void;
}) {
  const idPrefix = useId();
  const accountRef = useRef<HTMLSelectElement | null>(null);
  const [accountActive, setAccountActive] = useState(false);

  const accountId = `${idPrefix}-account`;
  const accountTipId = `${idPrefix}-account-tip`;
  const amountId = `${idPrefix}-amount`;
  const removeDisabled = busy || !canRemove;

  return (
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t pt-3">
      <div className="col-span-full min-w-0 text-xs">
        <label htmlFor={accountId} className="block font-medium text-foreground">
          Annual account{" "}
          <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
            *
          </span>
        </label>
        <select
          ref={accountRef}
          id={accountId}
          aria-required="true"
          aria-invalid={Boolean(accountError) || undefined}
          aria-describedby={accountActive && accountError ? accountTipId : undefined}
          disabled={busy}
          value={line.partitionId}
          onFocus={() => setAccountActive(true)}
          onMouseEnter={() => setAccountActive(true)}
          onMouseLeave={() => setAccountActive(false)}
          onBlur={() => {
            setAccountActive(false);
            onTouchAccount();
          }}
          onChange={(event) => {
            onTouchAccount();
            onChangeAccount(event.target.value);
          }}
          className={`mt-1 h-10 w-full min-w-0 rounded-lg border px-2 ${
            accountError ? "eflow-field-invalid border-destructive" : "border-border"
          }`}
        >
          <option value="">Choose account</option>
          {leaves.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} · {peso.format(availableForSection(section))} available
            </option>
          ))}
        </select>
        <FieldValidationTooltip
          id={accountTipId}
          anchorRef={accountRef}
          message={accountError}
          open={accountActive && Boolean(accountError)}
          tone="error"
        />
        {accountError && (
          <p role="alert" className="mt-1 text-[11px] text-destructive">
            {accountError}
          </p>
        )}
      </div>

      <div className="text-[12px]">
        <label htmlFor={amountId} className="block font-medium text-foreground">
          Approved amount{" "}
          <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
            *
          </span>
        </label>
        <MoneyInput
          id={amountId}
          aria-required="true"
          disabled={busy}
          min="0"
          max={INPUT_LIMITS.MONEY_MAX_BUDGET}
          availableMax={availableMax}
          showCeilingHint
          externalError={amountError || undefined}
          step="0.01"
          value={line.amount || ""}
          onBlur={onTouchAmount}
          onValueChange={(raw) => {
            onTouchAmount();
            onChangeAmount(Number(raw));
          }}
          className="mt-1 h-10 w-full rounded-lg border px-3 text-right"
        />
      </div>

      <div className="self-start pt-[22px]">
        <ActionBlockerGroup
          actionLabel={`Remove funding account line ${index + 1}`}
          blockers={!canRemove ? "At least one funding account line is required." : []}
          busy={busy}
          compact
          size="sm"
        >
          <button
            type="button"
            disabled={removeDisabled}
            onClick={onRemove}
            className="rounded-lg border p-2 text-[12px] disabled:opacity-40"
          >
            Remove
          </button>
        </ActionBlockerGroup>
      </div>
    </div>
  );
}
