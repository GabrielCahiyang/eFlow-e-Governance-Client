import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Gauge, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { WorkspaceHeader } from '../../../components/ui/workspace';
import { formatManilaDateTime } from '../../../shared/calendarDisplay';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { readableUiError } from '../../../shared/userFacingError';
import {
  DEFAULT_WORKLOAD_THRESHOLDS,
  fetchWorkloadThresholdSettings,
  formatLoadPoints,
  resetWorkloadThresholdSettings,
  saveWorkloadThresholdSettings,
  type WorkloadThresholds,
  type WorkloadThresholdSettingsBundle,
} from '../../workload';

interface OrgOption {
  id: string;
  name: string;
}

interface NumericFieldProps {
  label: string;
  value: string;
  min: number;
  max: number;
  integer?: boolean;
  suffix?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}

function ThresholdNumberField({
  label,
  value,
  min,
  max,
  integer = false,
  suffix = '',
  hint,
  error,
  disabled,
  onChange,
}: NumericFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [transientError, setTransientError] = useState('');
  const timerRef = useRef<number | null>(null);

  const flash = (message: string) => {
    setTransientError(message);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setTransientError(''), 2600);
  };

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const activeError = error || transientError;

  const handleChange = (raw: string) => {
    const cleaned = raw.trim();
    if (cleaned === '') {
      onChange('');
      return;
    }
    if (cleaned.startsWith('-')) {
      flash('Negative values are not allowed.');
      return;
    }
    const pattern = integer ? /^\d+$/ : /^\d*(?:\.\d{0,1})?$/;
    if (!pattern.test(cleaned)) {
      flash(integer ? 'Whole numbers only.' : 'Numbers with up to 1 decimal place only.');
      return;
    }
    const num = Number(cleaned);
    if (Number.isFinite(num) && num > max) {
      flash(`Maximum allowed is ${integer ? max : formatLoadPoints(max)}${suffix ? ` ${suffix}` : ''}.`);
      return;
    }
    setTransientError('');
    onChange(cleaned);
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-foreground">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          disabled={disabled}
          value={value}
          aria-invalid={Boolean(activeError) || undefined}
          onChange={(event) => handleChange(event.target.value)}
          className={`w-full rounded-[7px] border bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 ${
            activeError
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-border focus:border-primary focus:ring-primary/20'
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
        <FieldValidationTooltip
          anchorRef={inputRef}
          open={Boolean(activeError)}
          message={activeError}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint} ({min}–{max})</p>}
    </div>
  );
}

type DraftStrings = {
  heavyPoints: string;
  overloadPoints: string;
  maxActiveProjectLeads: string;
  maxActiveTaskLeads: string;
  maxOverdueItems: string;
  dueSoonBusinessDays: string;
  weightActiveProjectLead: string;
  weightPlanningProjectLead: string;
  weightTaskLead: string;
  weightTaskContributor: string;
  weightSubtaskLead: string;
  weightSubtaskContributor: string;
  weightPendingReview: string;
  weightOverduePenalty: string;
  weightDueSoonPenalty: string;
  requireOverrideReason: boolean;
};

function toDraftStrings(cfg: WorkloadThresholds): DraftStrings {
  return {
    heavyPoints: String(cfg.heavyPoints),
    overloadPoints: String(cfg.overloadPoints),
    maxActiveProjectLeads: String(cfg.maxActiveProjectLeads),
    maxActiveTaskLeads: String(cfg.maxActiveTaskLeads),
    maxOverdueItems: String(cfg.maxOverdueItems),
    dueSoonBusinessDays: String(cfg.dueSoonBusinessDays),
    weightActiveProjectLead: String(cfg.weightActiveProjectLead),
    weightPlanningProjectLead: String(cfg.weightPlanningProjectLead),
    weightTaskLead: String(cfg.weightTaskLead),
    weightTaskContributor: String(cfg.weightTaskContributor),
    weightSubtaskLead: String(cfg.weightSubtaskLead),
    weightSubtaskContributor: String(cfg.weightSubtaskContributor),
    weightPendingReview: String(cfg.weightPendingReview),
    weightOverduePenalty: String(cfg.weightOverduePenalty),
    weightDueSoonPenalty: String(cfg.weightDueSoonPenalty),
    requireOverrideReason: cfg.requireOverrideReason !== false,
  };
}

function validateDraft(d: DraftStrings): Record<string, string> {
  const errors: Record<string, string> = {};
  const checkDec = (key: keyof DraftStrings, label: string, min: number, max: number) => {
    const raw = String(d[key]).trim();
    if (!raw) {
      errors[key] = `${label} is required.`;
      return NaN;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      errors[key] = `${label} must be between ${min} and ${max}.`;
      return NaN;
    }
    return n;
  };
  const checkInt = (key: keyof DraftStrings, label: string, min: number, max: number) => {
    const raw = String(d[key]).trim();
    if (!raw) {
      errors[key] = `${label} is required.`;
      return NaN;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors[key] = `${label} must be a whole number between ${min} and ${max}.`;
      return NaN;
    }
    return n;
  };

  const heavy = checkDec('heavyPoints', 'Heavy threshold', 1, 100);
  const overload = checkDec('overloadPoints', 'Overloaded threshold', 1, 200);
  if (Number.isFinite(heavy) && Number.isFinite(overload) && overload <= heavy) {
    errors.overloadPoints = `Must be greater than Heavy threshold (${formatLoadPoints(heavy)} pts).`;
  }

  checkInt('maxActiveProjectLeads', 'Max active project leads', 1, 50);
  checkInt('maxActiveTaskLeads', 'Max active task leads', 1, 50);
  checkInt('maxOverdueItems', 'Max overdue items', 1, 50);
  checkInt('dueSoonBusinessDays', 'Due-soon crunch window', 1, 14);

  checkDec('weightActiveProjectLead', 'Active project lead weight', 0.5, 20);
  checkDec('weightPlanningProjectLead', 'Planning project lead weight', 0, 20);
  checkDec('weightTaskLead', 'Task lead weight', 0.5, 20);
  checkDec('weightTaskContributor', 'Task contributor weight', 0, 20);
  checkDec('weightSubtaskLead', 'Subtask lead weight', 0, 20);
  checkDec('weightSubtaskContributor', 'Subtask contributor weight', 0, 20);
  checkDec('weightPendingReview', 'Pending review weight', 0, 10);
  checkDec('weightOverduePenalty', 'Overdue penalty weight', 0, 10);
  checkDec('weightDueSoonPenalty', 'Due-soon penalty weight', 0, 10);

  return errors;
}

export function WorkloadMaintenance({ embedded = false }: { embedded?: boolean }) {
  const confirmation = useConfirmation();
  const [bundle, setBundle] = useState<WorkloadThresholdSettingsBundle | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [scopeOrgId, setScopeOrgId] = useState<string>(''); // '' = Global default
  const [draft, setDraft] = useState<DraftStrings>(() => toDraftStrings(DEFAULT_WORKLOAD_THRESHOLDS));
  const [baseline, setBaseline] = useState<DraftStrings>(() => toDraftStrings(DEFAULT_WORKLOAD_THRESHOLDS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempted, setAttempted] = useState(false);

  const load = useCallback(async (targetOrgId: string) => {
    setLoading(true);
    setError('');
    try {
      const [settings, orgRes] = await Promise.all([
        fetchWorkloadThresholdSettings(targetOrgId || null),
        supabase
          .from('organizations')
          .select('id, name')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);
      setBundle(settings);
      if (Array.isArray(orgRes.data)) {
        setOrgs(
          (orgRes.data as OrgOption[])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        );
      }
      const selectedConfig = targetOrgId
        ? settings.officeOverrides.find((item) => item.orgId === targetOrgId) ?? settings.globalDefault
        : settings.globalDefault;
      const nextDraft = toDraftStrings(selectedConfig);
      setDraft(nextDraft);
      setBaseline(nextDraft);
      setAttempted(false);
    } catch (caught) {
      setError(readableUiError(caught, 'Could not load workload threshold settings.', 'read'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(scopeOrgId);
  }, [load, scopeOrgId]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const fieldErrors = useMemo(() => (attempted ? validateDraft(draft) : {}), [draft, attempted]);
  const liveErrors = useMemo(() => validateDraft(draft), [draft]);
  const hasValidationErrors = Object.keys(liveErrors).length > 0;
  const activeOfficeOverride = scopeOrgId
    ? bundle?.officeOverrides.find((item) => item.orgId === scopeOrgId)
    : undefined;

  useNavigationBlocker({
    label: 'Workload threshold settings',
    dirty,
    pending: saving,
    onDiscard: () => {
      setDraft(baseline);
      setError('');
      setAttempted(false);
    },
  });

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setAttempted(true);
    setError('');
    setNotice('');
    if (hasValidationErrors) {
      setError('Fix the highlighted threshold values before saving.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveWorkloadThresholdSettings({
        orgId: scopeOrgId || null,
        heavyPoints: Number(draft.heavyPoints),
        overloadPoints: Number(draft.overloadPoints),
        maxActiveProjectLeads: Number(draft.maxActiveProjectLeads),
        maxActiveTaskLeads: Number(draft.maxActiveTaskLeads),
        maxOverdueItems: Number(draft.maxOverdueItems),
        dueSoonBusinessDays: Number(draft.dueSoonBusinessDays),
        weightActiveProjectLead: Number(draft.weightActiveProjectLead),
        weightPlanningProjectLead: Number(draft.weightPlanningProjectLead),
        weightTaskLead: Number(draft.weightTaskLead),
        weightTaskContributor: Number(draft.weightTaskContributor),
        weightSubtaskLead: Number(draft.weightSubtaskLead),
        weightSubtaskContributor: Number(draft.weightSubtaskContributor),
        weightPendingReview: Number(draft.weightPendingReview),
        weightOverduePenalty: Number(draft.weightOverduePenalty),
        weightDueSoonPenalty: Number(draft.weightDueSoonPenalty),
        requireOverrideReason: draft.requireOverrideReason,
      });
      setBundle(saved);
      const refreshed = scopeOrgId
        ? saved.officeOverrides.find((item) => item.orgId === scopeOrgId) ?? saved.globalDefault
        : saved.globalDefault;
      const next = toDraftStrings(refreshed);
      setDraft(next);
      setBaseline(next);
      setAttempted(false);
      const scopeName = scopeOrgId
        ? orgs.find((item) => item.id === scopeOrgId)?.name || 'Selected office'
        : 'Global defaults';
      setNotice(`Saved workload thresholds for ${scopeName}.`);
    } catch (caught) {
      setError(readableUiError(caught, 'Could not save workload thresholds.', 'write'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (saving) return;
    const scopeName = scopeOrgId
      ? orgs.find((item) => item.id === scopeOrgId)?.name || 'this office'
      : 'Global defaults';
    const confirmed = await confirmation.confirm({
      title: scopeOrgId ? `Revert ${scopeName} to global defaults?` : 'Reset global workload thresholds?',
      description: scopeOrgId
        ? `Remove the custom override for ${scopeName} so it inherits the global default workload thresholds.`
        : 'Restore all global workload point thresholds, role caps, and commitment weights to eFlow factory defaults.',
      actionLabel: scopeOrgId ? 'Revert to global' : 'Reset defaults',
    });
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await resetWorkloadThresholdSettings(scopeOrgId || null);
      setBundle(updated);
      const refreshed = scopeOrgId
        ? updated.officeOverrides.find((item) => item.orgId === scopeOrgId) ?? updated.globalDefault
        : updated.globalDefault;
      const next = toDraftStrings(refreshed);
      setDraft(next);
      setBaseline(next);
      setAttempted(false);
      setNotice(
        scopeOrgId
          ? `${scopeName} now inherits the global workload thresholds.`
          : 'Global workload thresholds restored to factory defaults.',
      );
    } catch (caught) {
      setError(readableUiError(caught, 'Could not reset workload thresholds.', 'write'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5" aria-label="Workload & Overload Maintenance">
      {confirmation.dialog}
      {!embedded && (
        <WorkspaceHeader
          title="Workload & Overload Maintenance"
          description="Configure global defaults and optional per-office thresholds used to flag overloaded staff during Project Lead, Task Lead, Subtask, Team, and AI assignments."
        />
      )}

      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Gauge size={18} className="text-primary" aria-hidden="true" />
              Overload Thresholds &amp; Point Weights
            </h3>
            <p className="text-xs text-muted-foreground max-w-2xl">
              These limits govern live overload detection across Project Setup, Task &amp; Subtask staffing, Add people,
              Head Dashboard, and AI assignment scoring. All deadlines evaluate in Philippine Time (Asia/Manila).
            </p>
          </div>
          <div className="min-w-[240px] space-y-1">
            <label htmlFor="wl-scope-select" className="block text-xs font-semibold text-foreground">
              Configuration scope
            </label>
            <select
              id="wl-scope-select"
              disabled={loading || saving}
              value={scopeOrgId}
              onChange={(event) => {
                setScopeOrgId(event.target.value);
                setNotice('');
                setError('');
              }}
              className="w-full rounded-[7px] border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Global defaults (all offices)</option>
              {orgs.map((org) => {
                const customized = bundle?.officeOverrides.some((item) => item.orgId === org.id);
                return (
                  <option key={org.id} value={org.id}>
                    {org.name}
                    {customized ? ' (Custom override)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {scopeOrgId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs">
            <span>
              {activeOfficeOverride
                ? `Custom override active for this office${activeOfficeOverride.updatedAt ? ` · Last updated ${formatManilaDateTime(activeOfficeOverride.updatedAt)}` : ''}.`
                : 'Currently inheriting global defaults. Saving below creates an office-specific override.'}
            </span>
            {activeOfficeOverride && (
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void handleReset()}>
                <RotateCcw size={13} aria-hidden="true" />
                <span className="ml-1.5">Revert to global</span>
              </Button>
            )}
          </div>
        )}

        {error && (
          <FeedbackState tone="error" title="Could not update workload settings">
            {error}
          </FeedbackState>
        )}
        {notice && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            {notice}
          </p>
        )}

        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading workload threshold configuration…
          </p>
        ) : (
          <form onSubmit={(event) => void handleSave(event)} className="space-y-6">
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal size={14} aria-hidden="true" />
                Capacity Tiers &amp; Role Caps
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ThresholdNumberField
                  label="Heavy (Near Capacity) threshold"
                  value={draft.heavyPoints}
                  min={1}
                  max={100}
                  suffix="pts"
                  hint="Amber warning starts at"
                  error={fieldErrors.heavyPoints}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, heavyPoints: value }))}
                />
                <ThresholdNumberField
                  label="Overloaded threshold"
                  value={draft.overloadPoints}
                  min={1.5}
                  max={200}
                  suffix="pts"
                  hint="Must exceed Heavy threshold"
                  error={fieldErrors.overloadPoints || (liveErrors.overloadPoints && draft.overloadPoints ? liveErrors.overloadPoints : undefined)}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, overloadPoints: value }))}
                />
                <ThresholdNumberField
                  label="Max active Project Leads"
                  value={draft.maxActiveProjectLeads}
                  min={1}
                  max={50}
                  integer
                  suffix="projects"
                  hint="Flags Overloaded at or above"
                  error={fieldErrors.maxActiveProjectLeads}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, maxActiveProjectLeads: value }))}
                />
                <ThresholdNumberField
                  label="Max active Task Leads"
                  value={draft.maxActiveTaskLeads}
                  min={1}
                  max={50}
                  integer
                  suffix="tasks"
                  hint="Flags Overloaded at or above"
                  error={fieldErrors.maxActiveTaskLeads}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, maxActiveTaskLeads: value }))}
                />
                <ThresholdNumberField
                  label="Max overdue items"
                  value={draft.maxOverdueItems}
                  min={1}
                  max={50}
                  integer
                  suffix="items"
                  hint="Flags Overloaded at or above"
                  error={fieldErrors.maxOverdueItems}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, maxOverdueItems: value }))}
                />
                <ThresholdNumberField
                  label="Due-soon crunch window"
                  value={draft.dueSoonBusinessDays}
                  min={1}
                  max={14}
                  integer
                  suffix="biz days"
                  hint="Mon–Fri PHT lookahead"
                  error={fieldErrors.dueSoonBusinessDays}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, dueSoonBusinessDays: value }))}
                />
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3.5 py-3 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.requireOverrideReason}
                  disabled={saving}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, requireOverrideReason: event.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 accent-[#00006b]"
                />
                <span>
                  <strong className="block font-semibold">Require written override justification for Overloaded assignments</strong>
                  When enabled, assigning an overloaded member requires acknowledging their workload and entering a
                  10–500 character reason recorded in the audit log.
                </span>
              </label>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Point Weights per Active Commitment
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ThresholdNumberField
                  label="Active Project Lead"
                  value={draft.weightActiveProjectLead}
                  min={0.5}
                  max={20}
                  suffix="pts"
                  error={fieldErrors.weightActiveProjectLead}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightActiveProjectLead: value }))}
                />
                <ThresholdNumberField
                  label="Planning / Pending Project Lead"
                  value={draft.weightPlanningProjectLead}
                  min={0}
                  max={20}
                  suffix="pts"
                  error={fieldErrors.weightPlanningProjectLead}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightPlanningProjectLead: value }))}
                />
                <ThresholdNumberField
                  label="Task Lead"
                  value={draft.weightTaskLead}
                  min={0.5}
                  max={20}
                  suffix="pts"
                  error={fieldErrors.weightTaskLead}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightTaskLead: value }))}
                />
                <ThresholdNumberField
                  label="Task Contributor"
                  value={draft.weightTaskContributor}
                  min={0}
                  max={20}
                  suffix="pts"
                  error={fieldErrors.weightTaskContributor}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightTaskContributor: value }))}
                />
                <ThresholdNumberField
                  label="Subtask Lead"
                  value={draft.weightSubtaskLead}
                  min={0}
                  max={20}
                  suffix="pts"
                  hint="Half weight if already parent Task Lead"
                  error={fieldErrors.weightSubtaskLead}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightSubtaskLead: value }))}
                />
                <ThresholdNumberField
                  label="Subtask Contributor"
                  value={draft.weightSubtaskContributor}
                  min={0}
                  max={20}
                  suffix="pts"
                  error={fieldErrors.weightSubtaskContributor}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightSubtaskContributor: value }))}
                />
                <ThresholdNumberField
                  label="Pending Review"
                  value={draft.weightPendingReview}
                  min={0}
                  max={10}
                  suffix="pts"
                  error={fieldErrors.weightPendingReview}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightPendingReview: value }))}
                />
                <ThresholdNumberField
                  label="Overdue Penalty (per item)"
                  value={draft.weightOverduePenalty}
                  min={0}
                  max={10}
                  suffix="pts"
                  error={fieldErrors.weightOverduePenalty}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightOverduePenalty: value }))}
                />
                <ThresholdNumberField
                  label="Due-Soon Penalty (per item)"
                  value={draft.weightDueSoonPenalty}
                  min={0}
                  max={10}
                  suffix="pts"
                  error={fieldErrors.weightDueSoonPenalty}
                  disabled={saving}
                  onChange={(value) => setDraft((prev) => ({ ...prev, weightDueSoonPenalty: value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  disabled={saving || (!dirty && (!scopeOrgId || Boolean(activeOfficeOverride)))}
                >
                  <Save size={15} aria-hidden="true" />
                  <span className="ml-1.5">{saving ? 'Saving…' : 'Save thresholds'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !dirty}
                  onClick={() => {
                    setDraft(baseline);
                    setAttempted(false);
                    setError('');
                  }}
                >
                  Discard edits
                </Button>
              </div>
              {!scopeOrgId && (
                <Button type="button" variant="outline" disabled={saving} onClick={() => void handleReset()}>
                  <RotateCcw size={14} aria-hidden="true" />
                  <span className="ml-1.5">Reset to factory defaults</span>
                </Button>
              )}
            </div>
          </form>
        )}
      </div>

      {bundle && bundle.officeOverrides.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            Per-office custom overrides ({bundle.officeOverrides.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Office</th>
                  <th className="py-2 pr-3 font-semibold">Heavy / Overload</th>
                  <th className="py-2 pr-3 font-semibold">Max Proj / Task Leads</th>
                  <th className="py-2 pr-3 font-semibold">Max Overdue</th>
                  <th className="py-2 pr-3 font-semibold">Override Reason</th>
                  <th className="py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bundle.officeOverrides.map((item) => (
                  <tr key={item.orgId || item.id}>
                    <td className="py-2.5 pr-3 font-medium text-foreground">{item.orgName || 'Office'}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {formatLoadPoints(item.heavyPoints)} / {formatLoadPoints(item.overloadPoints)} pts
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {item.maxActiveProjectLeads} / {item.maxActiveTaskLeads}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{item.maxOverdueItems}</td>
                    <td className="py-2.5 pr-3">{item.requireOverrideReason ? 'Required' : 'Optional'}</td>
                    <td className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setScopeOrgId(item.orgId || '')}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
