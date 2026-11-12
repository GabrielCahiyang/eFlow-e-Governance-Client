import { MoneyInput } from '../../../components/ui/MoneyInput';
import {budgetSettingsError,fiscalYearError} from '../validation/financialValidation';
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  LockKeyhole,
  ReceiptText,
  Save,
} from "lucide-react";
import {
  DEFAULT_DAILY_PETTY_CASH_RELEASE_LIMIT,
  DEFAULT_LIQUIDATION_DUE_DAYS,
  DEFAULT_PER_RECEIPT_LIMIT,
  DEFAULT_UNDERUTILIZATION_THRESHOLD,
} from "../constants";
import type { BudgetSection, DepartmentBudgetBundle } from "../types";
import {
  lockDepartmentFiscalBudget,
} from "../services/budgetService";
import { peso } from "./budgetUi";
import { LockedBudgetControls } from "./LockedBudgetControls";
import { BudgetSectionEditor } from "./BudgetSectionEditor";
import { openingSections, sectionTotal, validateBudgetSections, validateBudgetSectionsForLock } from "../selectors/budgetSections";
import { saveBudgetSections } from "../services/budgetSectionService";
import {lockedReleaseEditError,releaseSchedulesYearError} from '../selectors/budgetReleaseSchedule';
import {budgetProtectionIssue} from '../selectors/budgetVersions';
import {BudgetProtectionAlert} from './BudgetProtectionAlert';
import type {BudgetProtection} from '../types';

import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import {
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialErrorMessage,
} from "../financialReceipts";
export function AnnualBudgetSetup({
  orgId,
  fiscalYear,
  data,
  canEdit:providedCanEdit,
  onChanged,
}: {
  orgId: string;
  fiscalYear: number;
  data: DepartmentBudgetBundle;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const canEdit=providedCanEdit&&data.canAdjustBudget!==false;
  const [sections, setSections] = useState<BudgetSection[]>(() => openingSections(data));
  const [editingLocked, setEditingLocked] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [pettyLimit, setPettyLimit] = useState(
    DEFAULT_DAILY_PETTY_CASH_RELEASE_LIMIT,
  );
  const [requestLimit, setRequestLimit] = useState(DEFAULT_PER_RECEIPT_LIMIT);
  const [liquidationDueDays, setLiquidationDueDays] = useState(
    DEFAULT_LIQUIDATION_DUE_DAYS,
  );
  const [allowReceiptOverride, setAllowReceiptOverride] = useState(false);
  const [threshold, setThreshold] = useState(
    DEFAULT_UNDERUTILIZATION_THRESHOLD,
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError,setSaveError]=useState<(Error&{protection?:BudgetProtection})|null>(null);
  const expectedVersion=useRef(data.sectionsVersion||0);
  const snapshot = JSON.stringify({
    sections,
    adjustmentReason,
    pettyLimit,
    requestLimit,
    liquidationDueDays,
    allowReceiptOverride,
    threshold,
    notes,
  });
  const baseline = useRef(snapshot);
  const pending = useRef(false);
  const confirmation = useConfirmation();
  const [baselineVersion, setBaselineVersion] = useState(0);
  void baselineVersion;
  const draft = useExplicitDraft(
    "Annual budget",
    canEdit && snapshot !== baseline.current,
    busy,
    () => {
      const saved = JSON.parse(baseline.current);
      setSections(saved.sections);
      setAdjustmentReason(saved.adjustmentReason || "");
      setEditingLocked(false);
      setPettyLimit(saved.pettyLimit);
      setRequestLimit(saved.requestLimit);
      setLiquidationDueDays(saved.liquidationDueDays);
      setAllowReceiptOverride(saved.allowReceiptOverride);
      setThreshold(saved.threshold);
      setNotes(saved.notes);
    },
  );
  const lockKey = `budget-lock:${orgId}:${fiscalYear}`;
  useEffect(() => {
    if (snapshot !== baseline.current) return;
    if (!data.summary) return;
    const nextSections = openingSections(data);
    expectedVersion.current=data.sectionsVersion||0;
    baseline.current = JSON.stringify({
      sections: nextSections,
      adjustmentReason: "",
      pettyLimit: data.summary.dailyPettyCashReleaseLimit,
      requestLimit: data.summary.perReceiptLimit,
      liquidationDueDays: data.summary.liquidationDueDays,
      allowReceiptOverride: data.summary.allowReceiptLimitOverride,
      threshold: data.summary.underutilizationThreshold,
      notes: data.summary.notes || "",
    });
    setBaselineVersion((version) => version + 1);
    setSections(nextSections);
    setAdjustmentReason("");
    setPettyLimit(data.summary.dailyPettyCashReleaseLimit);
    setRequestLimit(data.summary.perReceiptLimit);
    setLiquidationDueDays(data.summary.liquidationDueDays);
    setAllowReceiptOverride(data.summary.allowReceiptLimitOverride);
    setThreshold(data.summary.underutilizationThreshold);
    setNotes(data.summary.notes || "");
  }, [data.lines, data.sections, data.summary,data.sectionsVersion]);
  // An unavailable editor is not an empty budget. Never label retained local
  // draft state as the saved financial position while the section API is absent.
  const total = data.sectionsAvailable
    ? sectionTotal(sections)
    : data.summary?.approvedAmount ?? 0;
  const locked = data.summary?.status === "locked";
  const hasProjects = data.readjustmentBlockedByProjects === true;
  const amountValidation = validateBudgetSectionsForLock(sections);
  const validation = fiscalYearError(fiscalYear)||budgetSettingsError({dailyReleaseLimit:pettyLimit,perReceiptLimit:requestLimit,liquidationDueDays,threshold})||validateBudgetSections(sections)||releaseSchedulesYearError(sections,fiscalYear)||(locked&&data.releaseScheduleAvailable?lockedReleaseEditError(data.sections||[],sections):'')||(locked ? amountValidation : "");
  const lockValidation = validation || amountValidation;
  const closed = data.summary?.status === "closed";
  const writable = Boolean(data.sectionsAvailable) && canEdit && !closed && (!locked || (editingLocked && !hasProjects));
  const protection=locked&&editingLocked?budgetProtectionIssue(data.sections||[],sections):null;
  const versions=data.budgetVersions||[];
  const nextVersion=(versions[versions.length-1]?.version||1)+1;
  const startReadjustment = () => {
    const latest = openingSections(data);
    expectedVersion.current = data.sectionsVersion || 0;
    baseline.current = JSON.stringify({ sections: latest, adjustmentReason: "", pettyLimit, requestLimit, liquidationDueDays, allowReceiptOverride, threshold, notes });
    setSections(latest);
    setAdjustmentReason("");
    setMessage("");
    setSaveError(null);
    setEditingLocked(true);
  };
  const persistDraft = () =>
    saveBudgetSections({
      orgId,
      fiscalYear,
      sections,
      expectedVersion: expectedVersion.current,
      reason: adjustmentReason,
      settings: { dailyReleaseLimit: pettyLimit, perReceiptLimit: requestLimit, liquidationDueDays, allowReceiptOverride, threshold, notes },
    });
  const save = async () => {
    if (pending.current || !writable || validation || protection || !data.sectionsAvailable || (locked && !adjustmentReason.trim()))
      return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setMessage("");
    setSaveError(null);
    try {
      if (locked && !(await confirmation.confirm({ title: "Record account adjustment?", description: `FY ${fiscalYear}: ${peso.format(data.summary?.approvedAmount || 0)} → ${peso.format(total)}. ${adjustmentReason}. Previous accounts stay in the audit history; funded rows cannot be erased.`, actionLabel: "Record adjustment" }))) return;
      await persistDraft();
      baseline.current = JSON.stringify({ sections, adjustmentReason: "", pettyLimit, requestLimit, liquidationDueDays, allowReceiptOverride, threshold, notes });
      setAdjustmentReason("");
      setEditingLocked(false);
      draft.markClean();
      setMessage(locked ? "Account adjustment recorded." : "Annual budget draft saved.");
      await onChanged();
    } catch (error) {
      setSaveError(error instanceof Error?error:new Error(financialErrorMessage(error)));
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };
  const lock = async () => {
    if (
      pending.current ||
      !canEdit ||
      locked ||
      total <= 0 ||
      lockValidation ||
      !data.sectionsAvailable ||
      financialOutcome(lockKey)
    )
      return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setMessage("");
    setSaveError(null);
    let locking = false;
    try {
      if (
        !(await confirmation.confirm({
          title: "Lock annual Office budget?",
          description: `FY ${fiscalYear} · ${peso.format(total)}. The original appropriation becomes immutable. Later corrections require an audited adjustment. Daily release ceiling ${peso.format(pettyLimit)}; liquidation due after ${liquidationDueDays} days.`,
          actionLabel: "Save and lock",
        }))
      )
        return;
      const budgetId = await persistDraft();
      baseline.current = snapshot;
      setMessage(`Budget draft ${budgetId} saved. Recording its lock…`);
      locking = true;
      await lockDepartmentFiscalBudget(budgetId);
      recordFinancialOutcome(lockKey, "saved");
      draft.markClean();
      setMessage(`Budget ${budgetId} saved and locked.`);
      await onChanged();
    } catch (error) {
      if (
        locking &&
        !financialOutcome(lockKey) &&
        financialFailureIsUncertain(error)
      )
        recordFinancialOutcome(lockKey, "uncertain");
      setSaveError(new Error(
        financialErrorMessage(error) +
          (financialOutcome(lockKey)
            ? " Verify the current annual budget before another write."
            : " Entries retained."),
      ));
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {confirmation.dialog}
      {financialOutcome(lockKey) === "uncertain" && (
        <button
          type="button"
          className="rounded-lg border p-3 text-sm"
          onClick={() => void onChanged()}
        >
          Refresh annual budget status before another write
        </button>
      )}
      <section className="rounded-[10px] border border-border bg-card">
        <div className="eflow-budget-annual-summary">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Annual office budget
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Fiscal year {fiscalYear}</p>
            {data.summary?.updatedAt && <p className="mt-1 text-xs text-muted-foreground">Updated {new Date(data.summary.updatedAt).toLocaleString()}</p>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Total Budget
            </div>
            <div className="mt-1 text-[20px] font-semibold text-foreground tabular-nums">
              {peso.format(total)}
            </div>
          </div>
        </div>
        <div className="p-4">
        {locked && (
          <div className="mb-4 flex items-start gap-2 text-xs text-muted-foreground">
            <LockKeyhole size={14} className="shrink-0" />
            <span>
              Budget locked. Commitments and expenses are tracked against the approved amounts.
            </span>
          </div>
        )}
        {!canEdit && !locked && (
          <div className="eflow-budget-warning mb-4 flex gap-2 rounded-lg p-3 text-xs">
            <AlertTriangle size={14} className="shrink-0" />
            Only the assigned Head can prepare and lock the annual budget.
            Members can monitor it and approve operational requests.
          </div>
        )}
        {!data.sectionsAvailable ? (
          <div role="status" className="text-[12px]">
            <p className="text-amber-800">Account editing is temporarily unavailable. Your saved budget has not been reset.</p>
            {data.summary ? (
              <dl className="mt-3 flex items-center justify-between rounded-lg bg-muted p-3">
                <dt>Saved annual budget · FY {fiscalYear}</dt>
                <dd className="font-semibold tabular-nums">{peso.format(data.summary.approvedAmount)}</dd>
              </dl>
            ) : <p className="mt-2 text-muted-foreground">No annual budget has been saved for this year.</p>}
            <button type="button" disabled={busy} onClick={() => void onChanged()} className="mt-3 rounded-lg border px-3 py-2">Refresh budget</button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Budget accounts</h3>
              {locked && canEdit && !editingLocked && <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40" disabled={hasProjects} aria-describedby={hasProjects ? "office-budget-readjustment-reason" : undefined} onClick={startReadjustment}>Readjust budget</button>}
            </div>
            {locked&&!canEdit&&<p className="mb-3 text-[13px] text-muted-foreground">Only the office Head can readjust this budget.</p>}
            {locked && canEdit && hasProjects && <p id="office-budget-readjustment-reason" className="mb-3 text-[13px] text-muted-foreground">You can only readjust the Office Budget when the Office has no projects.</p>}
            {sections.some(section => !section.retired && section.name === "Unclassified opening appropriation") && <p className="mb-3 text-[12px] text-muted-foreground">Your previously saved budget starts as one account. Rename it or divide it into your real accounts. Changing a locked amount requires a reason.</p>}
            <BudgetSectionEditor fiscalYear={fiscalYear} scheduleEnabled={data.releaseScheduleAvailable===true} sections={sections} onChange={setSections} disabled={!writable || busy} />
          </>
        )}
        {editingLocked && <label className="mt-4 block"><span className="text-[13px] font-medium">Reason for adjustment (required)</span><textarea disabled={busy || !writable} value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} className="mt-1 w-full rounded-lg border p-3 text-[13px]" placeholder="Explain what changed and why." /><p className="mt-1 text-[12px] text-muted-foreground">Saving creates V{nextVersion}.</p></label>}
        <BudgetProtectionAlert protection={protection||saveError?.protection} error={saveError}/>
        {lockValidation && <p role="alert" className="mt-3 text-[12px] text-destructive">{lockValidation}</p>}
        </div>
      </section>
      <section className="rounded-[10px] border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-[14px] bg-primary/10 p-2.5 text-primary">
            <CalendarClock size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">
              Cash release and liquidation controls
            </h3>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-secondary-foreground">
              These controls apply to task-funded cash requests. Office petty cash
              has a separate ₱30,000 revolving fund and a strict ₱5,000 per-receipt
              limit in the Office Petty Cash view. Only Accounting may replenish it.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
          <NumberField
            money label="Daily cash release ceiling"
            value={pettyLimit}
            onChange={setPettyLimit}
            disabled={!canEdit || locked}
          />
          <NumberField
            money label="Per-receipt review threshold"
            value={requestLimit}
            onChange={setRequestLimit}
            disabled={!canEdit || locked}
          />
          <NumberField
            label="Liquidation due after release (days)"
            value={liquidationDueDays}
            onChange={setLiquidationDueDays}
            disabled={!canEdit || locked}
          />
          <NumberField
            label="Q4 utilization target (%)"
            value={threshold}
            onChange={setThreshold}
            disabled={!writable || busy}
          />
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-[14px] border border-border bg-muted/50 p-3">
          <input
            type="checkbox"
            disabled={!canEdit || locked}
            checked={allowReceiptOverride}
            onChange={(event) => setAllowReceiptOverride(event.target.checked)}
            className="mt-0.5"
          />
          <ReceiptText size={14} className="mt-0.5 text-muted-foreground" />
          <span>
            <span className="block text-[12px] font-medium text-foreground">
              Allow justified receipts above the review threshold
            </span>
            <span className="mt-0.5 block text-[12px] text-secondary-foreground">
              The threshold is not a request cap. When enabled, a receipt above
              it requires a written exception reason and remains visible to both
              reviewers.
            </span>
          </span>
        </label>
        <label className="mt-4 block">
          <span className="text-[12px] text-neutral-600">Budget notes</span>
          <textarea
            disabled={!canEdit || locked}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[12px] disabled:bg-neutral-50"
          />
        </label>
      </section>
      {message && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700"
        >
          {message}
        </div>
      )}
      {(writable || (locked && editingLocked && canEdit)) && (
        <div className="eflow-budget-form-actions">
          {locked&&<button type="button" disabled={busy} onClick={()=>{const saved=JSON.parse(baseline.current);setSections(saved.sections);setThreshold(saved.threshold);setAdjustmentReason('');setSaveError(null);setEditingLocked(false);draft.markClean();}} className="rounded-lg border px-4 py-2 text-[13px]">Cancel adjustment</button>}
          <button
            disabled={!writable || busy || Boolean(validation) || !!protection || (locked && !adjustmentReason.trim())}
            onClick={save}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[12px] font-medium text-foreground"
          >
            <Save size={12} /> {busy?'Saving…':locked ? `Save V${nextVersion}` : "Save draft"}
          </button>
          {!locked &&
          <button
            disabled={busy || total <= 0 || Boolean(lockValidation) || !data.sectionsAvailable || Boolean(financialOutcome(lockKey))}
            onClick={lock}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
          >
            <LockKeyhole size={12} /> Save &amp; lock annual budget
          </button>}
        </div>
      )}
      {locked && (
        <LockedBudgetControls
          data={data}
          canManage={canEdit}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled, money = false,
}: {
  label: string; money?: boolean;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <label>
      <span className="text-[12px] text-neutral-600">{label}</span>
      {money ? <MoneyInput
        min={0}
        step="0.01"
        disabled={disabled}
        value={value}
        onValueChange={raw => onChange(Number(raw))}
        className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-[12px] tabular-nums disabled:bg-neutral-50"
      /> : <input type="number" min={label.includes('days')?1:0} max={label.includes('days')?90:100} step={label.includes('days')?1:.01} disabled={disabled} value={Number.isNaN(value)?'':value} onChange={event => onChange(event.target.value===''?NaN:Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-[12px]" />}
    </label>
  );
}
