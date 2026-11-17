import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CalendarDays, CornerDownRight, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import type { BudgetSection } from "../types";
import { addSectionChild, removeSectionTree, sectionTotal } from "../selectors/budgetSections";
import { accountReleaseSchedule } from "../selectors/budgetReleaseSchedule";
import { peso } from "./budgetUi";
import { BudgetReleaseScheduleEditor } from "./BudgetReleaseScheduleEditor";

const editFieldClass =
  "h-8 w-full min-w-0 rounded-[5px] border border-border bg-card px-2.5 text-[13px] text-foreground transition focus:border-primary focus:outline-none disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:px-1 disabled:font-medium disabled:text-foreground disabled:opacity-100";

const iconActionClass =
  "inline-flex h-7 items-center gap-1 rounded-[5px] border border-transparent px-2 text-[11px] font-medium text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground disabled:opacity-40";

export function BudgetSectionEditor({
  sections,
  onChange,
  disabled,
  fiscalYear,
  scheduleEnabled = false,
}: {
  sections: BudgetSection[];
  onChange: (sections: BudgetSection[]) => void;
  disabled: boolean;
  fiscalYear?: number;
  scheduleEnabled?: boolean;
}) {
  const [expandedSchedules, setExpandedSchedules] = useState<Record<string, boolean>>({});
  const patch = (id: string, update: Partial<BudgetSection>) =>
    onChange(sections.map((s) => (s.id === id ? { ...s, ...update } : s)));

  const move = (s: BudgetSection, direction: number) => {
    const siblings = sections
      .filter((x) => !x.retired && x.parentId === s.parentId)
      .sort((a, b) => a.position - b.position);
    const i = siblings.findIndex((x) => x.id === s.id);
    const other = siblings[i + direction];
    if (!other) return;
    [siblings[i], siblings[i + direction]] = [other, s];
    onChange(
      sections.map((x) =>
        x.parentId === s.parentId && !x.retired
          ? { ...x, position: siblings.findIndex((y) => y.id === x.id) }
          : x,
      ),
    );
  };

  const toggleSchedule = (id: string) =>
    setExpandedSchedules((current) => ({ ...current, [id]: !current[id] }));

  const renderRows = (parentId?: string, depth = 0): ReactNode =>
    sections
      .filter((s) => !s.retired && s.parentId === parentId)
      .sort((a, b) => a.position - b.position)
      .map((s) => {
        const children = sections.some((c) => !c.retired && c.parentId === s.id);
        const scheduleRows = accountReleaseSchedule(s);
        const hasSchedule = scheduleRows.length > 0 || s.heldAmount > 0;
        const scheduleOpen =
          scheduleEnabled &&
          !children &&
          Boolean(expandedSchedules[s.id] ?? (!disabled && hasSchedule));
        const budgetValue = sectionTotal(sections, s.id);
        const heldValue = sectionTotal(sections, s.id, "heldAmount");
        const deleteText = `Delete ${children ? "account and breakdown" : "account"}`;

        return (
          <div key={s.id} className="eflow-budget-ledger-group">
            <div className="eflow-budget-ledger-row">
              <div
                className="eflow-budget-ledger-name min-w-0"
                style={depth > 0 ? { paddingLeft: `${depth * 18}px` } : undefined}
              >
                {depth > 0 && (
                  <CornerDownRight
                    size={13}
                    aria-hidden="true"
                    className="shrink-0 text-muted-foreground/70"
                  />
                )}
                <input
                  aria-label={`Account name ${s.id}`}
                  disabled={disabled}
                  value={s.name}
                  placeholder={depth ? "Subaccount name" : "Your own account name"}
                  onChange={(e) => patch(s.id, { name: e.target.value })}
                  className={`${editFieldClass} ${depth === 0 ? "font-semibold" : "font-medium"}`}
                />
              </div>

              <div className="eflow-budget-ledger-cell">
                {!children ? (
                  <input
                    aria-label={`Expense-account code (optional) ${s.id}`}
                    disabled={disabled}
                    value={s.accountCode || ""}
                    placeholder={disabled ? "—" : "5-02-03-010"}
                    onChange={(e) => patch(s.id, { accountCode: e.target.value })}
                    className={`${editFieldClass} font-mono text-[12px] text-muted-foreground`}
                  />
                ) : (
                  <span className="px-1 text-[11px] text-muted-foreground">Subtotal</span>
                )}
              </div>

              <div className="eflow-budget-ledger-cell eflow-budget-ledger-cell--numeric">
                {children ? (
                  <output
                    aria-label={`Budget amount ${s.name || s.id}`}
                    className="inline-flex h-8 items-center justify-end px-1 text-[13px] font-semibold tabular-nums text-foreground"
                  >
                    {peso.format(budgetValue)}
                  </output>
                ) : (
                  <MoneyInput
                    aria-label={`Budget amount ${s.name || s.id}`}
                    disabled={disabled}
                    min="0"
                    step="0.01"
                    value={s.amount || ""}
                    onValueChange={(raw) => patch(s.id, { amount: Number(raw) })}
                    className={`${editFieldClass} text-right font-semibold tabular-nums`}
                  />
                )}
              </div>

              <div className="eflow-budget-ledger-cell eflow-budget-ledger-cell--numeric">
                {scheduleEnabled ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <output
                      aria-label={`Held budget ${s.name || s.id}`}
                      className="inline-flex h-8 items-center justify-end px-1 text-[13px] tabular-nums text-muted-foreground"
                    >
                      {heldValue > 0 ? peso.format(heldValue) : "₱0.00"}
                    </output>
                    {!children && (!disabled || hasSchedule) && (
                      <button
                        type="button"
                        aria-expanded={scheduleOpen}
                        onClick={() => toggleSchedule(s.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-border bg-muted/60 px-2 text-[11px] font-medium text-foreground transition hover:bg-muted"
                      >
                        <CalendarDays size={12} aria-hidden="true" />
                        <span>{scheduleRows.length ? `${scheduleRows.length} dates` : "Schedule"}</span>
                      </button>
                    )}
                  </div>
                ) : children ? (
                  <output
                    aria-label={`Hold ${s.name || s.id}`}
                    className="inline-flex h-8 items-center justify-end px-1 text-[13px] tabular-nums text-muted-foreground"
                  >
                    {peso.format(heldValue)}
                  </output>
                ) : (
                  <MoneyInput
                    aria-label={`Hold ${s.name || s.id}`}
                    disabled={disabled}
                    min="0"
                    step="0.01"
                    value={s.heldAmount || ""}
                    onValueChange={(raw) => patch(s.id, { heldAmount: Number(raw) })}
                    className={`${editFieldClass} text-right tabular-nums text-muted-foreground`}
                  />
                )}
              </div>

              {!disabled && (
                <div className="eflow-budget-ledger-actions">
                  {depth < 5 && !s.releaseSchedule?.length && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedSchedules((current) => ({ ...current, [s.id]: false }));
                        onChange(addSectionChild(sections, s.id));
                      }}
                      className={iconActionClass}
                    >
                      <Plus size={12} aria-hidden="true" /> Breakdown
                      <span className="sr-only">Add breakdown</span>
                    </button>
                  )}
                  <WorkspaceTooltip content={`Move ${s.name} up`}><button
                    type="button"
                    aria-label={`Move ${s.name} up`}
                    onClick={() => move(s, -1)}
                    className={iconActionClass}
                  >
                    <ArrowUp size={12} aria-hidden="true" />
                  </button></WorkspaceTooltip>
                  <WorkspaceTooltip content={`Move ${s.name} down`}><button
                    type="button"
                    aria-label={`Move ${s.name} down`}
                    onClick={() => move(s, 1)}
                    className={iconActionClass}
                  >
                    <ArrowDown size={12} aria-hidden="true" />
                  </button></WorkspaceTooltip>
                  <WorkspaceTooltip content={deleteText}><button
                    type="button"
                    aria-label={deleteText}
                    onClick={() => onChange(removeSectionTree(sections, s.id))}
                    className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-transparent px-2 text-[11px] font-medium text-rose-700 transition hover:border-rose-200 hover:bg-rose-50"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    <span className="sr-only">{deleteText}</span>
                  </button></WorkspaceTooltip>
                </div>
              )}
            </div>

            {scheduleOpen && (
              <div
                className="eflow-budget-ledger-schedule"
                style={{ paddingLeft: `${depth * 18 + 16}px` }}
              >
                <BudgetReleaseScheduleEditor
                  account={s}
                  year={fiscalYear}
                  disabled={disabled}
                  onChange={(update) => patch(s.id, update)}
                />
              </div>
            )}

            {children && depth < 6 && (
              <div className="eflow-budget-ledger-children">{renderRows(s.id, depth + 1)}</div>
            )}
          </div>
        );
      });

  const activeCount = sections.filter((s) => !s.retired && !s.parentId).length;
  const hasActiveRows = sections.some((s) => !s.retired);

  return (
    <div className="mt-4 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[13px] font-semibold text-foreground">Budget accounts</h4>
          <p className="text-[12px] text-muted-foreground">
            {disabled
              ? `${activeCount} top-level account${activeCount === 1 ? "" : "s"} locked in the office appropriation. An account with subaccounts uses their combined total.`
              : "An account with subaccounts uses their combined total. Manage optional expense codes and release holds inline."}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(addSectionChild(sections))}
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[12px] font-medium text-foreground transition hover:bg-muted"
          >
            <Plus size={13} aria-hidden="true" /> Add account
          </button>
        )}
      </div>

      <div
        className={`eflow-budget-ledger ${disabled ? "eflow-budget-ledger--readonly" : "eflow-budget-ledger--editable"}`}
      >
        <div className="eflow-budget-ledger-table">
          <div className="eflow-budget-ledger-head" aria-hidden="true">
            <span>Account &amp; breakdown</span>
            <span>Expense code</span>
            <span className="text-right">Appropriated</span>
            <span className="text-right">{scheduleEnabled ? "Pending release" : "Held"}</span>
            {!disabled && <span className="text-right">Actions</span>}
          </div>
          {hasActiveRows ? (
            <div className="divide-y divide-border">{renderRows()}</div>
          ) : (
            <div className="p-4">
              <EmptyState
                illustration="budget"
                size="compact"
                title="No accounts yet. Add your first account to build this budget."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
