import { useId, useRef, useState } from "react";
import { Banknote, CircleDollarSign, Plus, Trash2 } from "lucide-react";
import { BoundedTextarea, BoundedTextInput } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { diffCentavos, exceedsCentavos, sumCentavos, toCentavos } from "../../../shared/currency";
import {
  INPUT_LIMITS,
  blockInvalidNumberKey,
  maxDigitsForNumber,
  textLengthError,
} from "../../../shared/inputLimits";
import { createBudgetLine, PROPOSAL_EXPENSE_CLASSES, PROPOSAL_FUND_SOURCE } from "../constants";
import { getBudgetLineAmount, groupProposalBudgetLines, normalizeTaskBudgetLines } from "../selectors/budgetSelectors";
import type { BudgetLineInput, BudgetSection, TaskBudgetDecision } from "../types";
import { peso } from "./budgetUi";
import {
  budgetLineError,
  budgetQuantityError,
  financialAmountError,
  MAX_BUDGET_LINE_AMOUNT,
  MAX_BUDGET_QUANTITY,
} from "../validation/financialValidation";

export interface TaskBudgetValue {
  decision: TaskBudgetDecision;
  noCostReason?: string;
  lines: BudgetLineInput[];
}

export function TaskBudgetEditor({
  taskKey,
  value,
  fundingSource = PROPOSAL_FUND_SOURCE,
  readOnly = false,
  partitions = [],
  onChange,
}: {
  taskKey: string;
  value: TaskBudgetValue;
  fundingSource?: string;
  readOnly?: boolean;
  partitions?: BudgetSection[];
  onChange: (value: TaskBudgetValue) => void;
}) {
  const noCostId = useId();
  const [noCostTouched, setNoCostTouched] = useState(false);
  const lines = normalizeTaskBudgetLines(taskKey, value.lines || []);
  const groups = groupProposalBudgetLines(lines);
  const total = sumCentavos(lines.map((line) => getBudgetLineAmount(line)));
  const updateLines = (next: BudgetLineInput[]) =>
    onChange({ ...value, lines: normalizeTaskBudgetLines(taskKey, next) });
  const selectDecision = (decision: TaskBudgetDecision) => {
    if (decision === "funded" && lines.length === 0) {
      onChange({ decision, noCostReason: "", lines: [createBudgetLine(0, taskKey)] });
      return;
    }
    onChange({ decision, noCostReason: value.noCostReason, lines: decision === "funded" ? lines : [] });
  };
  const patchIds = (ids: Set<string>, patch: Partial<BudgetLineInput>) =>
    updateLines(
      lines.map((line) =>
        ids.has(line.id)
          ? {
              ...line,
              ...patch,
              fundSource: fundingSource,
            }
          : line,
      ),
    );
  const removeIds = (ids: Set<string>) => updateLines(lines.filter((line) => !ids.has(line.id)));

  const noCostError =
    value.decision === "no_cost"
      ? textLengthError(value.noCostReason || "", "No-cost reason", {
          required: true,
          max: INPUT_LIMITS.REASON,
        })
      : "";
  const visibleNoCostError =
    noCostTouched || (value.noCostReason || "").length > INPUT_LIMITS.REASON ? noCostError : "";

  const status =
    value.decision === "missing"
      ? { label: "Decision needed", className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" }
      : value.decision === "funded"
        ? { label: `Budget assigned · ${peso.format(total)}`, className: "bg-primary/10 text-primary ring-1 ring-primary/20" }
        : { label: "No cost selected", className: "bg-primary/10 text-primary ring-1 ring-primary/20" };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <DecisionCard
            active={value.decision === "funded"}
            disabled={readOnly}
            title="Budget assigned"
            note="Add categories and particulars"
            onClick={() => selectDecision("funded")}
          />
          <DecisionCard
            active={value.decision === "no_cost"}
            disabled={readOnly}
            title="No cost required"
            note="Work uses no proposal money"
            onClick={() => selectDecision("no_cost")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1 text-[10px]">
          <span className="font-medium text-neutral-500">Task funding status</span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      {value.decision === "no_cost" && (
        <div className="block">
          <label htmlFor={noCostId} className="block text-[10px] font-medium text-neutral-600">
            Why does this task require no funding?{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextarea
            id={noCostId}
            aria-required="true"
            disabled={readOnly}
            maxLength={INPUT_LIMITS.REASON}
            value={value.noCostReason || ""}
            error={visibleNoCostError || undefined}
            onBlur={() => setNoCostTouched(true)}
            onChange={(event) => {
              setNoCostTouched(true);
              onChange({ ...value, noCostReason: event.target.value, lines: [] });
            }}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[11px] disabled:bg-neutral-50"
            placeholder="For example: completed using existing staff and equipment."
          />
        </div>
      )}

      {value.decision === "funded" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CircleDollarSign size={15} className="text-emerald-700" />
              <div>
                <div className="text-[10px] font-medium text-emerald-900">{fundingSource}</div>
                <div className="text-[9px] text-emerald-700">Fund source is fixed by the proposal owner.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wide text-emerald-700">Task total</div>
              <div className="text-[16px] font-semibold tabular-nums text-emerald-950">{peso.format(total)}</div>
            </div>
          </div>

          <div className="space-y-3">
            {groups.flatMap((expense) =>
              expense.categories.map((category) => {
                const ids = new Set(category.particulars.map((line) => line.id));
                return (
                  <CategorySection
                    key={`${expense.id}:${category.id}`}
                    expenseClass={expense.expenseClass}
                    categoryName={category.category}
                    categoryAmount={category.amount}
                    particulars={category.particulars}
                    partitions={partitions}
                    readOnly={readOnly}
                    onPatchCategory={(patch) => patchIds(ids, patch)}
                    onRemoveCategory={() => removeIds(ids)}
                    onPatchLine={(lineId, patch) => patchIds(new Set([lineId]), patch)}
                    onRemoveLine={(lineId) => removeIds(new Set([lineId]))}
                    onAddParticular={() =>
                      updateLines([
                        ...lines,
                        {
                          ...createBudgetLine(lines.length, taskKey),
                          expenseClass: expense.expenseClass,
                          category: category.category,
                          fundSource: fundingSource,
                        },
                      ])
                    }
                  />
                );
              }),
            )}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                updateLines([
                  ...lines,
                  {
                    ...createBudgetLine(lines.length, taskKey),
                    category: `Category ${groups.flatMap((item) => item.categories).length + 1}`,
                    fundSource: fundingSource,
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-neutral-300 px-4 py-2.5 text-[10px] text-neutral-600 hover:border-emerald-300 hover:bg-emerald-50"
            >
              <Plus size={12} /> Add category
            </button>
          )}
        </>
      )}
    </div>
  );
}

function CategorySection({
  expenseClass,
  categoryName,
  categoryAmount,
  particulars,
  partitions,
  readOnly,
  onPatchCategory,
  onRemoveCategory,
  onPatchLine,
  onRemoveLine,
  onAddParticular,
}: {
  expenseClass: string;
  categoryName: string;
  categoryAmount: number;
  particulars: BudgetLineInput[];
  partitions: BudgetSection[];
  readOnly: boolean;
  onPatchCategory: (patch: Partial<BudgetLineInput>) => void;
  onRemoveCategory: () => void;
  onPatchLine: (lineId: string, patch: Partial<BudgetLineInput>) => void;
  onRemoveLine: (lineId: string) => void;
  onAddParticular: () => void;
}) {
  const idPrefix = useId();
  const expenseRef = useRef<HTMLSelectElement | null>(null);
  const [expenseActive, setExpenseActive] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);

  const expenseError = !expenseClass ? "Select an expense class." : "";
  const categoryError = textLengthError(categoryName, "Category", {
    required: true,
    max: INPUT_LIMITS.GROUP_TITLE,
  });
  const visibleCategoryError =
    categoryTouched || categoryName.length > INPUT_LIMITS.GROUP_TITLE ? categoryError : "";

  const expenseId = `${idPrefix}-expense`;
  const expenseTipId = `${idPrefix}-expense-tip`;
  const categoryId = `${idPrefix}-category`;

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <header className="grid gap-2 border-b border-neutral-100 bg-neutral-50 p-3 sm:grid-cols-[.8fr_1fr_auto] sm:items-start">
        <div>
          <label htmlFor={expenseId} className="block text-[9px] uppercase tracking-wide text-neutral-500">
            Expense class{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <select
            ref={expenseRef}
            id={expenseId}
            aria-label="Expense class"
            aria-required="true"
            aria-invalid={Boolean(expenseError) || undefined}
            aria-describedby={expenseActive && expenseError ? expenseTipId : undefined}
            disabled={readOnly}
            value={expenseClass}
            onFocus={() => setExpenseActive(true)}
            onMouseEnter={() => setExpenseActive(true)}
            onMouseLeave={() => setExpenseActive(false)}
            onBlur={() => setExpenseActive(false)}
            onChange={(event) => onPatchCategory({ expenseClass: event.target.value })}
            className={`mt-1 h-9 w-full rounded-lg border bg-white px-2.5 text-[10px] disabled:bg-neutral-50 ${
              expenseError ? "eflow-field-invalid border-destructive" : "border-neutral-200"
            }`}
          >
            {PROPOSAL_EXPENSE_CLASSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <FieldValidationTooltip
            id={expenseTipId}
            anchorRef={expenseRef}
            message={expenseError}
            open={expenseActive && Boolean(expenseError)}
            tone="error"
          />
        </div>
        <div>
          <label htmlFor={categoryId} className="block text-[9px] uppercase tracking-wide text-neutral-500">
            Category{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextInput
            id={categoryId}
            aria-label="Category"
            aria-required="true"
            disabled={readOnly}
            value={categoryName}
            maxLength={INPUT_LIMITS.GROUP_TITLE}
            error={visibleCategoryError || undefined}
            onBlur={() => setCategoryTouched(true)}
            onChange={(event) => {
              setCategoryTouched(true);
              onPatchCategory({ category: event.target.value });
            }}
            placeholder="Category, e.g. Workshop and Consultation"
            className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[10px] disabled:bg-neutral-50"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-4">
          <span className="text-[10px] font-semibold tabular-nums">{peso.format(categoryAmount)}</span>
          {!readOnly && (
            <WorkspaceTooltip content={`Remove category ${categoryName || "item"} and all its particulars.`}>
              <span className="inline-flex">
                <button
                  type="button"
                  onClick={onRemoveCategory}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove ${categoryName}`}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </WorkspaceTooltip>
          )}
        </div>
      </header>
      <div className="divide-y divide-neutral-100">
        {particulars.map((line) => (
          <ParticularRow
            key={line.id}
            line={line}
            partitions={partitions}
            readOnly={readOnly}
            onPatch={(patch) => onPatchLine(line.id, patch)}
            onRemove={() => onRemoveLine(line.id)}
          />
        ))}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={onAddParticular}
          className="m-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-[9.5px] text-neutral-600 hover:border-emerald-300 hover:bg-emerald-50"
        >
          <Plus size={11} /> Add particular
        </button>
      )}
    </section>
  );
}

function DecisionCard({
  active,
  disabled,
  title,
  note,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/15"
          : "border-neutral-200 bg-white text-neutral-900 hover:border-primary/35 hover:bg-primary/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <Banknote size={13} />
        <span className="text-[10px] font-semibold">{title}</span>
      </div>
      <div className={`mt-1 text-[9px] ${active ? "text-primary/80" : "text-neutral-500"}`}>{note}</div>
    </button>
  );
}

function ParticularRow({
  line,
  partitions,
  readOnly,
  onPatch,
  onRemove,
}: {
  line: BudgetLineInput;
  partitions: BudgetSection[];
  readOnly: boolean;
  onPatch: (patch: Partial<BudgetLineInput>) => void;
  onRemove: () => void;
}) {
  const idPrefix = useId();
  const qtyRef = useRef<HTMLInputElement | null>(null);
  const partitionRef = useRef<HTMLSelectElement | null>(null);
  const [qtyActive, setQtyActive] = useState(false);
  const [partitionActive, setPartitionActive] = useState(false);
  const [touched, setTouched] = useState<{
    particular?: boolean;
    quantity?: boolean;
    unit?: boolean;
    unitCost?: boolean;
    partition?: boolean;
  }>({});

  const amount = getBudgetLineAmount(line);
  const issue = budgetLineError(line);
  const particularError = textLengthError(line.particular || "", "Particular", {
    required: true,
    max: INPUT_LIMITS.TITLE,
  });
  const visibleParticularError = touched.particular ? particularError : "";
  const unitError = textLengthError(line.unit || "", "Unit", {
    required: true,
    max: INPUT_LIMITS.CODE,
  });
  const visibleUnitError = touched.unit ? unitError : "";
  const qtyError = budgetQuantityError(line.quantity === undefined ? 1 : line.quantity);
  const visibleQtyError = touched.quantity || Boolean(qtyError && Number.isNaN(line.quantity)) ? qtyError : "";

  const selectedPartition = partitions.find((section) => section.id === line.budgetPartitionId);
  const partitionAvailable = selectedPartition
    ? Math.max(
        0,
        diffCentavos(
          selectedPartition.amount,
          sumCentavos([selectedPartition.heldAmount, selectedPartition.committedAmount || 0]),
        ),
      )
    : undefined;
  const effectiveQty = Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0 ? Number(line.quantity) : 1;
  const unitCostAvailableMax =
    partitionAvailable !== undefined
      ? Math.min(
          INPUT_LIMITS.MONEY_MAX_LINE,
          Math.floor((partitionAvailable / effectiveQty) * 100) / 100,
        )
      : INPUT_LIMITS.MONEY_MAX_LINE;

  const unitCostRawError =
    line.unitCost !== undefined
      ? financialAmountError(line.unitCost, "Unit cost", false, MAX_BUDGET_LINE_AMOUNT)
      : "";
  const overPartition =
    partitionAvailable !== undefined && Number.isFinite(amount) && exceedsCentavos(amount, partitionAvailable);
  const unitCostError = overPartition
    ? `Line total (${peso.format(amount)}) exceeds account balance (${peso.format(partitionAvailable!)}).`
    : unitCostRawError;
  const visibleUnitCostError =
    touched.unitCost || overPartition || Boolean(line.unitCost && exceedsCentavos(line.unitCost, MAX_BUDGET_LINE_AMOUNT))
      ? unitCostError
      : "";

  const partitionError =
    partitions.length > 0
      ? !line.budgetPartitionId
        ? "Choose an annual funding account."
        : overPartition
          ? `Exceeds available ${peso.format(partitionAvailable!)} in ${selectedPartition?.name || "this account"}.`
          : ""
      : "";
  const visiblePartitionError = touched.partition || overPartition ? partitionError : "";

  const particularId = `${idPrefix}-particular`;
  const qtyId = `${idPrefix}-qty`;
  const qtyTipId = `${idPrefix}-qty-tip`;
  const unitId = `${idPrefix}-unit`;
  const unitCostId = `${idPrefix}-unit-cost`;
  const partitionId = `${idPrefix}-partition`;
  const partitionTipId = `${idPrefix}-partition-tip`;

  const remainingLineIssue =
    issue && !visibleQtyError && !visibleUnitCostError ? issue : "";

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-[minmax(140px,1fr)_76px_78px_112px_88px_30px] md:items-start">
        <div>
          <label htmlFor={particularId} className="block text-[9px] uppercase tracking-wide text-neutral-400">
            Particular{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextInput
            id={particularId}
            aria-label="Particular"
            aria-required="true"
            disabled={readOnly}
            value={line.particular}
            maxLength={INPUT_LIMITS.TITLE}
            error={visibleParticularError || undefined}
            onBlur={() => setTouched((prev) => ({ ...prev, particular: true }))}
            onChange={(event) => {
              setTouched((prev) => ({ ...prev, particular: true }));
              onPatch({ particular: event.target.value });
            }}
            placeholder="Exact item or service"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={qtyId} className="block text-[9px] uppercase tracking-wide text-neutral-400">
            Quantity{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <input
            ref={qtyRef}
            id={qtyId}
            aria-label="Quantity"
            aria-required="true"
            aria-invalid={Boolean(visibleQtyError || issue) || undefined}
            aria-describedby={qtyActive && visibleQtyError ? qtyTipId : undefined}
            disabled={readOnly}
            type="number"
            min={0.01}
            max={MAX_BUDGET_QUANTITY}
            step="0.01"
            value={Number.isNaN(line.quantity) ? "" : line.quantity ?? 1}
            onKeyDown={(event) => blockInvalidNumberKey(event, { allowDecimal: true })}
            onFocus={() => setQtyActive(true)}
            onMouseEnter={() => setQtyActive(true)}
            onMouseLeave={() => setQtyActive(false)}
            onBlur={() => {
              setQtyActive(false);
              setTouched((prev) => ({ ...prev, quantity: true }));
            }}
            onChange={(event) => {
              setTouched((prev) => ({ ...prev, quantity: true }));
              const raw = event.target.value;
              if (raw === "") {
                onPatch({ quantity: NaN, amount: 0 });
                return;
              }
              const intDigits = raw.replace(/^-/, "").split(".")[0].replace(/^0+(?=\d)/, "");
              if (intDigits.length > maxDigitsForNumber(MAX_BUDGET_QUANTITY)) return;
              const nextQty = Number(raw);
              const nextAmount = line.unitCost
                ? Math.round(nextQty * toCentavos(Number(line.unitCost))) / 100
                : 0;
              onPatch({ quantity: nextQty, amount: nextAmount });
            }}
            className={`${inputClass} tabular-nums ${visibleQtyError ? "eflow-field-invalid border-destructive" : ""}`}
          />
          <FieldValidationTooltip
            id={qtyTipId}
            anchorRef={qtyRef}
            message={visibleQtyError}
            open={qtyActive && Boolean(visibleQtyError)}
            tone="error"
          />
          {visibleQtyError && (
            <p role="alert" className="mt-1 text-[10px] text-destructive">
              {visibleQtyError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={unitId} className="block text-[9px] uppercase tracking-wide text-neutral-400">
            Unit{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextInput
            id={unitId}
            aria-label="Unit"
            aria-required="true"
            disabled={readOnly}
            maxLength={INPUT_LIMITS.CODE}
            value={line.unit || ""}
            error={visibleUnitError || undefined}
            onBlur={() => setTouched((prev) => ({ ...prev, unit: true }))}
            onChange={(event) => {
              setTouched((prev) => ({ ...prev, unit: true }));
              onPatch({ unit: event.target.value });
            }}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={unitCostId} className="block text-[9px] uppercase tracking-wide text-neutral-400">
            Unit cost{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <MoneyInput
            id={unitCostId}
            aria-label="Unit cost"
            aria-required="true"
            disabled={readOnly}
            min={0.01}
            max={INPUT_LIMITS.MONEY_MAX_LINE}
            availableMax={unitCostAvailableMax}
            showCeilingHint
            externalError={visibleUnitCostError || undefined}
            step="0.01"
            value={line.unitCost || ""}
            onBlur={() => setTouched((prev) => ({ ...prev, unitCost: true }))}
            onValueChange={(raw) => {
              setTouched((prev) => ({ ...prev, unitCost: true }));
              onPatch({
                unitCost: Number(raw),
                amount: Math.round(Number(line.quantity || 0) * toCentavos(Number(raw))) / 100,
              });
            }}
            className={`${inputClass} text-right`}
          />
        </div>

        <div>
          <span className="block text-[9px] uppercase tracking-wide text-neutral-400">Amount</span>
          <div className="mt-1 flex h-9 items-center justify-end rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 text-[10px] font-medium tabular-nums">
            {issue ? "—" : peso.format(amount)}
          </div>
        </div>

        {!readOnly && (
          <div className="pt-4">
            <WorkspaceTooltip content="Remove this particular line.">
              <span className="inline-flex">
                <button
                  type="button"
                  onClick={onRemove}
                  className="mb-0.5 rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove particular"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </WorkspaceTooltip>
          </div>
        )}
        {remainingLineIssue && (
          <p role="alert" className="col-span-2 text-xs text-destructive md:col-span-6">
            {remainingLineIssue}
          </p>
        )}
      </div>

      {partitions.length > 0 && (
        <div className="block px-3 pb-3">
          <label htmlFor={partitionId} className="block text-[11px] text-muted-foreground">
            Annual funding account{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <select
            ref={partitionRef}
            id={partitionId}
            aria-required="true"
            aria-invalid={Boolean(visiblePartitionError) || undefined}
            aria-describedby={partitionActive && visiblePartitionError ? partitionTipId : undefined}
            disabled={readOnly}
            value={line.budgetPartitionId || ""}
            onFocus={() => setPartitionActive(true)}
            onMouseEnter={() => setPartitionActive(true)}
            onMouseLeave={() => setPartitionActive(false)}
            onBlur={() => {
              setPartitionActive(false);
              setTouched((prev) => ({ ...prev, partition: true }));
            }}
            onChange={(event) => {
              setTouched((prev) => ({ ...prev, partition: true }));
              onPatch({ budgetPartitionId: event.target.value });
            }}
            className={`${inputClass} ${visiblePartitionError ? "eflow-field-invalid border-destructive" : ""}`}
          >
            <option value="">Choose the account that authorizes this item</option>
            {partitions.map((section) => {
              const available = diffCentavos(
                section.amount,
                sumCentavos([section.heldAmount, section.committedAmount || 0]),
              );
              return (
                <option key={section.id} value={section.id}>
                  {section.name} · {peso.format(available)} available
                </option>
              );
            })}
          </select>
          <FieldValidationTooltip
            id={partitionTipId}
            anchorRef={partitionRef}
            message={visiblePartitionError}
            open={partitionActive && Boolean(visiblePartitionError)}
            tone="error"
          />
          {visiblePartitionError && (
            <p role="alert" className="mt-1 text-[11px] text-destructive">
              {visiblePartitionError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[10px] disabled:bg-neutral-50";
