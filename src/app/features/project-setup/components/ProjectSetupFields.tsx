import { useId, useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../../../types';
import { BoundedTextarea, BoundedTextInput } from '../../../components/ui/BoundedInput';
import { DateInput } from '../../../components/ui/DateInput';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { calendarMinDate } from '../../../shared/calendarDates';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import {
  compactMemberWorkloadAnnotation,
  DEFAULT_WORKLOAD_THRESHOLDS,
  OverloadMitigationPanel,
  type MemberWorkloadSummary,
  type OverloadOverrideState,
  type WorkloadThresholds,
} from '../../workload';

export interface SetupDraft {
  title: string;
  description: string;
  scope: string;
  lead: string;
  start: string;
  end: string;
  noFunding: boolean;
}

export interface SetupFieldErrors {
  lead?: string;
  title?: string;
  description?: string;
  scope?: string;
  start?: string;
  end?: string;
}

export function ProjectSetupFields({
  step,
  draft,
  update,
  profiles,
  disabled,
  readOnlyReason,
  officeHeadId = '',
  settings = false,
  originalStart = '',
  fieldErrors,
  onDateInvalidChange,
  workloadByUser,
  workloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS,
  workloadOrgId,
  originalLeadId = '',
  leadOverride,
  onLeadOverrideChange,
  showLeadOverrideValidation = false,
}: {
  step: number;
  draft: SetupDraft;
  update: (key: keyof SetupDraft, value: string | boolean) => void;
  profiles: UserProfile[];
  disabled: boolean;
  readOnlyReason?: string;
  officeName?: string;
  officeHeadId?: string;
  settings?: boolean;
  automaticLead?: boolean;
  originalStart?: string;
  fieldErrors?: SetupFieldErrors;
  onDateInvalidChange?: (field: 'start' | 'end', invalid: boolean) => void;
  workloadByUser?: Map<string, MemberWorkloadSummary>;
  workloadThresholds?: WorkloadThresholds;
  workloadOrgId?: string | null;
  originalLeadId?: string;
  leadOverride?: OverloadOverrideState;
  onLeadOverrideChange?: (next: OverloadOverrideState) => void;
  showLeadOverrideValidation?: boolean;
}) {
  const baseId = useId();
  const leadId = `${baseId}-lead`;
  const leadTipId = `${baseId}-lead-tip`;
  const leadErrId = `${baseId}-lead-err`;
  const leadSelectRef = useRef<HTMLSelectElement>(null);
  const [leadFocused, setLeadFocused] = useState(false);
  const [leadHovered, setLeadHovered] = useState(false);
  const showLeadTooltip = (leadFocused || leadHovered) && Boolean(fieldErrors?.lead);
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const scopeId = `${baseId}-scope`;
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;

  const lockTitle = disabled ? readOnlyReason : undefined;
  const minStart = calendarMinDate(originalStart);
  const minEnd = draft.start || minStart;

  const eligibleLeads = useMemo(
    () =>
      profiles
        .filter((person) => person.is_active !== false && !['admin', 'super_admin', 'viewer'].includes(person.role))
        .slice()
        .sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', undefined, { sensitivity: 'base' })),
    [profiles],
  );
  const resolvedHeadId =
    officeHeadId ||
    eligibleLeads.find((person) => person.role === 'head')?.id ||
    '';
  const selectedLead = eligibleLeads.find((person) => person.id === draft.lead);
  const selectedIsHead = Boolean(
    draft.lead &&
      (draft.lead === resolvedHeadId || selectedLead?.role === 'head'),
  );
  const leadMissingFromList = Boolean(
    draft.lead && !eligibleLeads.some((person) => person.id === draft.lead),
  );

  return (
    <fieldset
      disabled={disabled}
      data-readonly={disabled && readOnlyReason ? 'true' : undefined}
      title={lockTitle}
      className="pf-wizard-fields"
    >
      {step === 0 && (
        <>
          {!settings && (
            <div className="pf-section-heading">
              <p className="pf-eyebrow">PROJECT DETAILS</p>
              <h2>Start with the essentials.</h2>
              <p>Give your project a name and help your team understand what it’s here to achieve.</p>
            </div>
          )}
          <div className="pf-field" title={lockTitle}>
            <label htmlFor={leadId}>
              Project Lead <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <select
                ref={leadSelectRef}
                id={leadId}
                value={draft.lead}
                disabled={disabled}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors?.lead) || undefined}
                aria-describedby={
                  [fieldErrors?.lead ? leadErrId : undefined, showLeadTooltip ? leadTipId : undefined]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                className={fieldErrors?.lead ? 'eflow-field-invalid' : undefined}
                onFocus={() => setLeadFocused(true)}
                onBlur={() => setLeadFocused(false)}
                onMouseEnter={() => setLeadHovered(true)}
                onMouseLeave={() => setLeadHovered(false)}
                onChange={(event) => update('lead', event.target.value)}
              >
                <option value="">Select Project Lead</option>
                {leadMissingFromList && (
                  <option value={draft.lead}>
                    {profiles.find((person) => person.id === draft.lead)?.full_name || 'Current Project Lead (unavailable)'}
                  </option>
                )}
                {eligibleLeads.map((person) => {
                  const isHead = person.id === resolvedHeadId || person.role === 'head';
                  const loadNote = compactMemberWorkloadAnnotation(workloadByUser?.get(person.id));
                  return (
                    <option key={person.id} value={person.id}>
                      {person.full_name || person.email}
                      {isHead ? ' (Office Head)' : ''}
                      {loadNote}
                    </option>
                  );
                })}
              </select>
              <FieldValidationTooltip
                id={leadTipId}
                anchorRef={leadSelectRef}
                open={showLeadTooltip}
                message={fieldErrors?.lead || ''}
                tone="error"
              />
            </div>
            {fieldErrors?.lead && (
              <div id={leadErrId} className="eflow-bounded-meta">
                <span className="eflow-bounded-meta__hint" data-tone="error" role="alert">
                  {fieldErrors.lead}
                </span>
              </div>
            )}
            <p className="pf-field-help">
              {selectedIsHead
                ? 'Default: Office Head. Task approvals go to the Project Lead, and the Office Head can mark this project complete directly.'
                : 'Task approvals go to this Project Lead (their own tasks go to the Office Head). Before completion, the Project Lead must request final review from the Office Head.'}
            </p>
            {!disabled && draft.lead && workloadByUser?.get(draft.lead) && leadOverride && onLeadOverrideChange && (
              <OverloadMitigationPanel
                userId={draft.lead}
                orgId={workloadOrgId}
                summary={workloadByUser.get(draft.lead)}
                thresholds={workloadThresholds}
                proposedRole="project_lead_planning"
                alreadyAssignedInRole={Boolean(originalLeadId && originalLeadId === draft.lead)}
                override={leadOverride}
                onOverrideChange={onLeadOverrideChange}
                onSwitchMember={(nextUserId) => update('lead', nextUserId)}
                showValidation={showLeadOverrideValidation}
              />
            )}
          </div>
          <div className="pf-field" title={lockTitle}>
            <label htmlFor={titleId}>Project title *</label>
            <BoundedTextInput
              id={titleId}
              autoFocus={!settings}
              readOnly={disabled}
              aria-disabled={disabled || undefined}
              value={draft.title}
              maxLength={INPUT_LIMITS.TITLE}
              error={fieldErrors?.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="For example, Community enterprise support"
            />
          </div>
          <div className="pf-field" title={lockTitle}>
            <label htmlFor={descriptionId}>Description *</label>
            <BoundedTextarea
              id={descriptionId}
              readOnly={disabled}
              aria-disabled={disabled || undefined}
              value={draft.description}
              maxLength={INPUT_LIMITS.PROJECT_DESCRIPTION}
              error={fieldErrors?.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Background, objectives, beneficiaries and expected results."
            />
          </div>
        </>
      )}
      {step === 1 && (
        <>
          {!settings && (
            <div className="pf-section-heading">
              <p className="pf-eyebrow">SCOPE</p>
              <h2>Define the boundaries.</h2>
              <p>Describe what this project includes, its deliverables and anything outside its scope.</p>
            </div>
          )}
          <div className="pf-field" title={lockTitle}>
            <label htmlFor={scopeId}>Scope of the project *</label>
            <BoundedTextarea
              id={scopeId}
              autoFocus={!settings}
              readOnly={disabled}
              aria-disabled={disabled || undefined}
              value={draft.scope}
              maxLength={INPUT_LIMITS.PROJECT_DESCRIPTION}
              error={fieldErrors?.scope}
              onChange={(e) => update('scope', e.target.value)}
              placeholder="What will this project deliver? What is outside the scope?"
            />
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="pf-section-heading">
            <p className="pf-eyebrow">TIMELINE</p>
            <h2>When will the project run?</h2>
            <p>Choose a start date of today or later (Philippine Time · MM/DD/YYYY).</p>
          </div>
          <div className="pf-grid">
            <div className="pf-field">
              <label htmlFor={startId}>Project start date *</label>
              <DateInput
                id={startId}
                value={draft.start}
                min={minStart}
                max={draft.end || undefined}
                disabled={disabled}
                hasError={Boolean(fieldErrors?.start)}
                errorMessage={fieldErrors?.start}
                onInvalidTextChange={(inv) => onDateInvalidChange?.('start', inv)}
                onChange={(event) => update('start', event.target.value)}
              />
            </div>
            <div className="pf-field">
              <label htmlFor={endId}>Project target date *</label>
              <DateInput
                id={endId}
                value={draft.end}
                min={minEnd}
                disabled={disabled}
                hasError={Boolean(fieldErrors?.end)}
                errorMessage={fieldErrors?.end}
                onInvalidTextChange={(inv) => onDateInvalidChange?.('end', inv)}
                onChange={(event) => update('end', event.target.value)}
              />
            </div>
          </div>
        </>
      )}
    </fieldset>
  );
}
