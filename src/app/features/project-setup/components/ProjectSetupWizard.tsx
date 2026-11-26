import { readableUiError } from '../../../shared/userFacingError';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, ClipboardList, Layers, RefreshCw, Wallet, ShieldCheck, Save, FileUp, UsersRound } from 'lucide-react';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { Modal } from '../../../components/ui/Modal';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { ProjectPdfImportPanel } from '../../project-import';
import {
  prefetchProjectOffices,
  ProjectOfficeContext,
  ProjectPeoplePage,
  useProjectOffices,
} from '../../project-offices';
import {
  fetchProjectOffices,
  selectProjectOfficeMembersChecked,
} from '../../project-offices/services/projectOfficeService';
import { previewSelection, saveSelection } from '../../project-access';
import { ProjectTaskTemplateLibrary } from '../../work-templates';
import { ProjectOpeningPreview } from './ProjectOpeningPreview';
import type { Organization, UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import { isAppointedOfficeHead } from '../../../shared/officeAuthority';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';
import { scheduledDateError } from '../../../shared/calendarDates';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import { formatPeso, sumCentavos } from '../../../shared/currency';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { useProjectFlow } from '../useProjectFlow';
import { ProjectFlowError, projectFlowCall, readProjectFlow } from '../services/projectFlow';
import { readProjectDraft, storeProjectDraft, type ProjectDraftRecovery } from '../projectDraftRecovery';
import { readFundingDraft, storeFundingDraft } from '../fundingDraftRecovery';
import type { OfficeFundingSourcesPreview, ProjectFlow } from '../types';
import { DraftPeopleStep } from './DraftPeopleStep';
import { FlowError } from './FlowError';
import { ProjectFundingPanel } from './ProjectFundingPanel';
import { ProjectSetupFields, type SetupDraft, type SetupFieldErrors } from './ProjectSetupFields';
import { ProjectTaskDraftStep } from './ProjectTaskDraftStep';
import { useProjectTaskTemplates } from '../useProjectTaskTemplates';
import {
  EMPTY_OVERLOAD_OVERRIDE,
  invalidateWorkloadCache,
  overloadOverrideValidationError,
  projectMemberWorkload,
  recordWorkloadOverloadOverride,
  useOfficeWorkload,
  type OverloadOverrideState,
} from '../../workload';
import '../projectSetup.css';
import '../projectWizardDesign.css';

const steps = [
  { title: 'Details', icon: ClipboardList },
  { title: 'Scope', icon: Layers },
  { title: 'Dates', icon: CalendarDays },
  { title: 'Funding', icon: Wallet },
  { title: 'Review', icon: ShieldCheck },
  { title: 'Add people', icon: UsersRound },
  { title: 'Draft tasks', icon: ClipboardList },
];
const datesStep = 2;
const fundingStep = 3;
const reviewStep = 4;
const peopleStep = 5;
const standardTasksStep = 6;
const aiTasksStep = 5;

const projectStartError = (start: string, original = '') =>
  scheduledDateError(start, { original, label: 'Project start date' });
const hasValidDates = ({ start, end }: SetupDraft, originalStart?: string) =>
  !!start && !!end && start <= end && !projectStartError(start, originalStart);
const titleError = (value: string) =>
  textLengthError(value, 'Project title', { required: true, min: 3, max: INPUT_LIMITS.TITLE });
const descriptionError = (value: string) =>
  textLengthError(value, 'Description', { required: true, min: 3, max: INPUT_LIMITS.PROJECT_DESCRIPTION });
const scopeError = (value: string) =>
  textLengthError(value, 'Scope of the project', { required: true, min: 3, max: INPUT_LIMITS.PROJECT_DESCRIPTION });

const empty: SetupDraft = { title: '', description: '', scope: '', lead: '', start: '', end: '', noFunding: false };
const fields = (p: ProjectFlow['project']): SetupDraft => ({
  title: p.title,
  description: p.description,
  scope: p.scope,
  lead: p.project_lead_id || '',
  start: p.start_date || '',
  end: p.target_date || '',
  noFunding: p.funding_not_required,
});

export function ProjectSetupWizard({
  projectId,
  profiles,
  profilesLoading = false,
  organizations = [],
  tasks = [],
  governed = false,
  officeName: _officeName,
  creatorId,
  recoveryKey = '',
  createDraft,
  onClose,
  onFinish,
  initialStep = 0,
  importPdf = false,
}: {
  projectId?: string;
  profiles: UserProfile[];
  profilesLoading?: boolean;
  organizations?: Organization[];
  tasks?: Task[];
  governed?: boolean;
  officeName?: string;
  creatorId?: string;
  recoveryKey?: string;
  createDraft?: (title: string, requestId: string) => Promise<string>;
  onClose: (id?: string) => void;
  onFinish: (id: string) => void;
  initialStep?: number;
  importPdf?: boolean;
}) {
  const [id, setId] = useState(projectId || '');
  const starterSelectId = useId();
  const [base, setBase] = useState<ProjectFlow['project']>();
  const actorProfile = profiles.find((person) => person.id === creatorId);
  const inferredOrgId = base?.org_id || actorProfile?.org_id || profiles.find((person) => person.org_id)?.org_id;
  const eligibleProfiles = profiles.filter(
    (person) =>
      person.is_active !== false &&
      !['admin', 'super_admin', 'viewer'].includes(person.role) &&
      (!inferredOrgId || person.org_id === inferredOrgId),
  );
  const officeHeadId =
    organizations.find((org) => org.id === inferredOrgId)?.head_user_id ||
    eligibleProfiles.find((person) => person.role === 'head')?.id ||
    '';
  const defaultLeadId = officeHeadId || creatorId || eligibleProfiles[0]?.id || '';
  const [draft, setDraft] = useState<SetupDraft>(() => ({ ...empty, lead: defaultLeadId }));
  const [step, setStep] = useState(initialStep);
  const [busy, setBusy] = useState(false);
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingDirty, setFundingDirty] = useState(false);
  const [fundingHasError, setFundingHasError] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [attemptedSteps, setAttemptedSteps] = useState<Record<number, boolean>>({});
  const [invalidDates, setInvalidDates] = useState<{ start: boolean; end: boolean }>({ start: false, end: false });
  const [confirmSaveWithFundingDraft, setConfirmSaveWithFundingDraft] = useState(false);
  const [aiSkipModal, setAiSkipModal] = useState<{
    targetLabel: string;
    missingSteps: { index: number; number: string; title: string }[];
  } | null>(null);
  const [fundingPreview, setFundingPreview] = useState<{
    data?: OfficeFundingSourcesPreview;
    loading: boolean;
    error: string;
    reloading?: boolean;
  }>({ loading: false, error: '' });
  const [reloadingFlowSources, setReloadingFlowSources] = useState(false);
  const [pdfMode, setPdfMode] = useState(importPdf);
  const activeTasksStep = pdfMode ? aiTasksStep : standardTasksStep;
  const wizardSteps = pdfMode
    ? [...steps.slice(0, peopleStep), { title: 'Import AI PDF', icon: FileUp }]
    : steps;
  const [visitedTasksStep, setVisitedTasksStep] = useState(initialStep === (importPdf ? aiTasksStep : standardTasksStep));
  const [draftPeopleIds, setDraftPeopleIds] = useState<string[]>([]);
  const draftPeopleEdited = useRef(false);
  const peopleRequest = useRef<ProjectDraftRecovery['peopleRequest']>(undefined);
  const [recovery, setRecovery] = useState(() => (projectId ? undefined : readProjectDraft(recoveryKey)));
  const creationAttempt = useRef<ProjectDraftRecovery['creationAttempt']>(undefined);
  const finished = useRef(false);
  const [readyProjectId, setReadyProjectId] = useState('');
  const flow = useProjectFlow(id, !!id);
  const pending = useRef(false);
  const createdId = useRef(id);
  const hydrated = useRef(!projectId);
  const [optimisticFlow, setOptimisticFlow] = useState<{ projectId: string; flow: ProjectFlow }>();

  const draftPeopleDisabledReason = governed
    ? 'Manage this team through the approved work plan’s participation workflow.'
    : organizations.length > 0 && actorProfile && !isAppointedOfficeHead(actorProfile, organizations)
      ? 'Only the appointed Office Head can choose the project team. You can continue straight to 07 Draft tasks.'
      : '';

  const toggleDraftPerson = useCallback((userId: string, checked: boolean) => {
    draftPeopleEdited.current = true;
    setDraftPeopleIds((current) =>
      checked ? (current.includes(userId) ? current : [...current, userId]) : current.filter((item) => item !== userId),
    );
    peopleRequest.current = undefined;
  }, []);

  useEffect(() => {
    if (!projectId || readyProjectId) return;
    let active = true;
    void fetchProjectOffices(projectId)
      .then(({ offices, members }) => {
        if (!active) return;
        const leadOffice = offices.find((office) => office.relationship_type === 'lead') ?? offices[0];
        if (!leadOffice) return;
        const existing = members
          .filter((member) => member.project_office_id === leadOffice.id)
          .map((member) => member.user_id);
        if (existing.length) {
          setDraftPeopleIds((current) => (current.length ? current : existing));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projectId, readyProjectId]);

  const activeFlow =
    flow.data?.project.id === id
      ? base?.id === id
        ? { ...flow.data, project: base }
        : flow.data
      : optimisticFlow?.projectId === id
        ? optimisticFlow.flow
        : undefined;

  useEffect(() => {
    if (flow.data && !hydrated.current) {
      hydrated.current = true;
      setBase(flow.data.project);
      setDraft({ ...fields(flow.data.project), lead: flow.data.project.project_lead_id || defaultLeadId });
    }
  }, [flow.data?.project.id, defaultLeadId]);

  useEffect(() => {
    if (!projectId && !base && defaultLeadId && !draft.lead) {
      setDraft((current) => (current.lead ? current : { ...current, lead: defaultLeadId }));
    }
  }, [projectId, base, defaultLeadId, draft.lead]);

  const [taskDraftBusy, setTaskDraftBusy] = useState(false);
  const actionId = useId();
  const peopleFormId = actionId + '-people';
  const tasksFormId = actionId + '-tasks';
  const [teamAction, setTeamAction] = useState({ label: 'Next: Draft tasks', disabled: false, busy: false });
  const handleTeamSaveStateChange = useCallback(
    (next: { label: string; disabled: boolean; busy: boolean }) =>
      setTeamAction((prev) =>
        prev.label === next.label && prev.disabled === next.disabled && prev.busy === next.busy ? prev : next,
      ),
    [],
  );
  const [taskAction, setTaskAction] = useState({ label: 'Open project', disabled: false });
  const handleTaskSaveStateChange = useCallback(
    (next: { label: string; disabled: boolean }) =>
      setTaskAction((prev) => (prev.label === next.label && prev.disabled === next.disabled ? prev : next)),
    [],
  );
  const [projectType, setProjectType] = useState('');
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [templateInitialCreate, setTemplateInitialCreate] = useState(false);
  const editable = !projectId || flow.data?.canConfigure === true || flow.data?.canAuthorize === true;
  const locked = busy || fundingBusy || taskDraftBusy || teamAction.busy;

  const workload = useOfficeWorkload(inferredOrgId, editable);
  const [leadOverride, setLeadOverride] = useState<OverloadOverrideState>(EMPTY_OVERLOAD_OVERRIDE);
  useEffect(() => {
    setLeadOverride(EMPTY_OVERLOAD_OVERRIDE);
  }, [draft.lead]);
  const leadSummary = draft.lead ? workload.byUserId.get(draft.lead) : undefined;
  const leadAlreadyAssigned = Boolean(base?.project_lead_id && base.project_lead_id === draft.lead);
  const leadProjection = projectMemberWorkload(leadSummary, 'project_lead_planning', workload.thresholds, {
    alreadyAssignedInRole: leadAlreadyAssigned,
  });
  const leadOverloadError = overloadOverrideValidationError(leadProjection, leadOverride);

  const openFundingRequests = activeFlow?.fundingRequests ?? [];
  const awaitingAccounting = openFundingRequests.some((item) => item.status === 'pending_accounting');
  const awaitingHead = openFundingRequests.some((item) => !item.status || item.status === 'pending');
  const hasCertifiedFunding = (activeFlow?.total ?? 0) > 0;
  const hasSubmittedFunding = awaitingAccounting || awaitingHead;
  const hasFundingSatisfied = draft.noFunding || hasCertifiedFunding || hasSubmittedFunding;

  const templateLibrary = useProjectTaskTemplates(editable && !pdfMode);
  const selectedTemplate = templateLibrary.templates.find((template) => template.id === projectType);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base ? fields(base) : { ...empty, lead: defaultLeadId });
  const [localSaved, setLocalSaved] = useState(false);
  const fundingRecoveryKey = recoveryKey ? `${recoveryKey}:funding:${projectId || 'draft'}` : '';

  useNavigationBlocker({
    label: 'Project setup',
    identity: id || 'new-project',
    dirty: dirty && !localSaved,
    pending: locked,
    pendingCheck: () => pending.current,
    onDiscard: () => {
      setDraft(base ? fields(base) : { ...empty, lead: defaultLeadId });
      setError('');
    },
  });

  useEffect(() => {
    if (
      recoveryKey &&
      !recovery &&
      !finished.current &&
      (id || dirty || creationAttempt.current || draftPeopleIds.length > 0)
    ) {
      setLocalSaved(
        storeProjectDraft(recoveryKey, {
          values: draft,
          step,
          projectId: id,
          base,
          creationAttempt: creationAttempt.current,
          people: draftPeopleIds.length ? draftPeopleIds : undefined,
          peopleRequest: peopleRequest.current,
          projectType,
          readyProjectId,
          importPdf: pdfMode,
        }),
      );
    }
  }, [recoveryKey, recovery, draft, step, id, base, dirty, draftPeopleIds, projectType, readyProjectId, pdfMode]);

  const finish = (target: string) => {
    finished.current = true;
    if (recoveryKey) storeProjectDraft(recoveryKey);
    if (fundingRecoveryKey) storeFundingDraft(fundingRecoveryKey);
    onFinish(target);
  };

  const close = () =>
    void requestNavigation(() => (readyProjectId ? finish(readyProjectId) : onClose(createdId.current || undefined)));

  const update = (key: keyof SetupDraft, value: string | boolean) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (error) setError('');
  };

  const originalStart = projectId ? (base?.start_date ?? '') : '';

  const loadFundingPreview = useCallback(async (isRetry = false) => {
    if (createdId.current) return;
    setFundingPreview((prev) => ({
      ...prev,
      loading: true,
      reloading: isRetry || Boolean(prev.data || prev.error),
      error: '',
    }));
    try {
      const result = await projectFlowCall<OfficeFundingSourcesPreview>('office_funding_sources_preview', {});
      if (result && Array.isArray(result.sources)) {
        setFundingPreview({ data: result, loading: false, reloading: false, error: '' });
      } else {
        setFundingPreview({
          data: { orgId: '', canAuthorize: true, hasEligibleAccountingStaff: true, sources: [] },
          loading: false,
          reloading: false,
          error: '',
        });
      }
    } catch (e) {
      setFundingPreview({
        data: undefined,
        loading: false,
        reloading: false,
        error: readableUiError(e, 'Could not load Office Budget sources.', 'read'),
      });
    }
  }, []);

  async function persist() {
    let target = createdId.current;
    const titleIssue = titleError(draft.title);
    if (titleIssue) throw new Error(titleIssue);
    const startError = projectStartError(draft.start, originalStart);
    if (startError) throw new Error(startError);
    if (draft.start && draft.end && draft.end < draft.start) {
      throw new Error('Project target date must be on or after the start date.');
    }
    if (leadOverloadError) {
      throw new Error(leadOverloadError);
    }

    if (!target) {
      if (!createDraft) throw new Error('Project creation is unavailable.');
      creationAttempt.current ??= { id: crypto.randomUUID(), title: draft.title.trim() };
      storeProjectDraft(recoveryKey, {
        values: draft,
        step,
        projectId: '',
        people: draftPeopleIds.length ? draftPeopleIds : undefined,
        peopleRequest: peopleRequest.current,
        projectType,
        importPdf: pdfMode,
        creationAttempt: creationAttempt.current,
      });
      try {
        target = await createDraft(creationAttempt.current.title, creationAttempt.current.id);
      } catch (e) {
        if (e instanceof ProjectFlowError) {
          creationAttempt.current = undefined;
          storeProjectDraft(recoveryKey, {
            values: draft,
            step,
            projectId: '',
            people: draftPeopleIds.length ? draftPeopleIds : undefined,
            peopleRequest: peopleRequest.current,
            projectType,
            importPdf: pdfMode,
          });
        }
        throw e;
      }
      createdId.current = target;
      creationAttempt.current = undefined;
      storeProjectDraft(recoveryKey, {
        values: draft,
        step,
        projectId: target,
        people: draftPeopleIds.length ? draftPeopleIds : undefined,
        peopleRequest: peopleRequest.current,
        projectType,
        importPdf: pdfMode,
      });
    }

    if (target && base && !dirty) {
      if (id !== target) setId(target);
      return target;
    }
    const latest = await readProjectFlow(target);
    let current = latest.project;
    const metadata = (p: ProjectFlow['project']) => JSON.stringify({ ...fields(p), noFunding: false });
    if (base && current.updated_at !== base.updated_at && metadata(current) !== metadata(base)) {
      if (id !== target) setId(target);
      throw new Error(
        'Project details changed elsewhere. Your entries are retained; close and reopen setup to review the current project before saving.',
      );
    }
    const proposed = { ...draft, lead: draft.lead || defaultLeadId, noFunding: latest.total > 0 ? false : draft.noFunding };
    if (JSON.stringify(proposed) !== JSON.stringify(fields(current))) {
      try {
        current = await projectFlowCall<ProjectFlow['project']>('save_project_definition', {
          p_project: target,
          p_details: { ...proposed, version: current.updated_at },
        });
        if (leadProjection?.requiresOverride && proposed.lead) {
          await recordWorkloadOverloadOverride({
            targetUserId: proposed.lead,
            contextType: 'project',
            entityId: target,
            proposedRole: 'project_lead_planning',
            reason: leadOverride.reason,
            snapshot: {
              currentPoints: leadProjection.currentPoints,
              projectedPoints: leadProjection.projectedPoints,
              addedPoints: leadProjection.addedPoints,
              projectedTier: leadProjection.projectedTier,
              reasons: leadProjection.reasons,
            },
          });
        }
        invalidateWorkloadCache();
        setReadyProjectId('');
      } catch (e) {
        if (id !== target) setId(target);
        throw e;
      }
    }
    setId(target);
    setBase(current);
    setDraft(fields(current));
    setOptimisticFlow({ projectId: target, flow: { ...latest, project: current } });
    return target;
  }

  const refreshFundingQuietly = useCallback(async () => {
    const target = createdId.current;
    if (!target) {
      await loadFundingPreview(true);
      return;
    }
    const fresh = await readProjectFlow(target);
    setBase(fresh.project);
    setOptimisticFlow({ projectId: target, flow: fresh });
    await flow.reload();
  }, [flow.reload, loadFundingPreview]);

  const reloadFunding = useCallback(async () => {
    const target = createdId.current;
    if (!target) {
      await loadFundingPreview(true);
      return;
    }
    setReloadingFlowSources(true);
    try {
      await refreshFundingQuietly();
    } finally {
      setReloadingFlowSources(false);
    }
  }, [loadFundingPreview, refreshFundingQuietly]);

  async function applyDraftPeople(targetProjectId: string) {
    if ((!draftPeopleIds.length && !draftPeopleEdited.current) || draftPeopleDisabledReason) return;
    const { offices, members } = await fetchProjectOffices(targetProjectId);
    const leadOffice =
      offices.find((office) => office.relationship_type === 'lead') ??
      offices.find((office) => inferredOrgId && office.office_id === inferredOrgId) ??
      offices[0];
    if (!leadOffice) return;
    const existingIds = members
      .filter((member) => member.project_office_id === leadOffice.id)
      .map((member) => member.user_id);
    const desired = Array.from(
      new Set([
        ...(draftPeopleEdited.current ? [] : existingIds),
        ...draftPeopleIds,
        ...(draft.lead ? [draft.lead] : []),
      ]),
    );
    const sameRoster =
      desired.length === existingIds.length && desired.every((uid) => existingIds.includes(uid));
    if (sameRoster) {
      setDraftPeopleIds([]);
      draftPeopleEdited.current = false;
      peopleRequest.current = undefined;
      return;
    }
    peopleRequest.current ??= { id: crypto.randomUUID(), users: desired };
    const req = peopleRequest.current;
    const impact = await previewSelection(leadOffice.id, req.users);
    if (impact?.fingerprint) {
      await saveSelection(leadOffice.id, req.users, impact.fingerprint, req.id);
    } else {
      await selectProjectOfficeMembersChecked(leadOffice.id, req.users, existingIds, req.id);
    }
    peopleRequest.current = undefined;
    draftPeopleEdited.current = false;
    setDraftPeopleIds([]);
    void prefetchProjectOffices(targetProjectId);
  }

  const ensureProjectForFunding = async () => {
    if (!draft.title.trim() || titleError(draft.title)) {
      setAttemptedSteps((current) => ({ ...current, 0: true }));
      throw new Error(
        'Enter a Project title in Step 01 Details before submitting funding — your funding entries stay saved while you switch tabs.',
      );
    }
    return persist();
  };

  async function perform(action: () => Promise<void>) {
    if (pending.current || fundingBusy) return;
    if (!navigator.onLine) {
      setError(
        localSaved
          ? 'You’re offline. Your draft is saved on this device.'
          : 'You’re offline. Keep this dialog open and reconnect to save your draft.',
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(
        creationAttempt.current
          ? "We couldn't confirm whether the project was created. Keep this setup open and try again here; don't start another project."
          : e instanceof Error
            ? e.message
            : 'Could not save project setup.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function validate(index: number) {
    if (index === 0) {
      const tErr = titleError(draft.title);
      const dErr = descriptionError(draft.description);
      if (tErr && dErr) throw new Error('Enter the project title and description before continuing.');
      if (tErr) throw new Error(tErr);
      if (dErr) throw new Error(dErr);
      if ((eligibleProfiles.length > 0 || creatorId) && !draft.lead) {
        throw new Error('Select a Project Lead before continuing.');
      }
      if (leadOverloadError) {
        throw new Error(leadOverloadError);
      }
    }
    if (index === 1) {
      const sErr = scopeError(draft.scope);
      if (sErr) throw new Error(sErr === 'Scope of the project is required.' ? 'Define the project scope before continuing.' : sErr);
    }
    if (index === datesStep) {
      if (invalidDates.start) throw new Error('Enter a valid project start date in MM/DD/YYYY format.');
      if (invalidDates.end) throw new Error('Enter a valid project target date in MM/DD/YYYY format.');
      const startError = projectStartError(draft.start, originalStart);
      if (startError) throw new Error(startError);
      if (!draft.start || !draft.end || draft.end < draft.start) {
        throw new Error('Enter a project start date and a target date on or after it.');
      }
    }
  }

  const next = () => {
    if (step < fundingStep) {
      setAttemptedSteps((current) => ({ ...current, [step]: true }));
      try {
        validate(step);
        setError('');
        setStep((value) => value + 1);
      } catch (e) {
        setError(readableUiError(e, 'Check the project details before continuing.', 'write'));
      }
      return;
    }
    void perform(async () => {
      if (step === reviewStep) {
        setAttemptedSteps((current) => ({ ...current, 0: true, 1: true, [datesStep]: true }));
        validate(0);
        validate(1);
        validate(datesStep);
        if (fundingDirty || uncertain) throw new Error('Save or remove the funding entries first.');
        if (!hasFundingSatisfied) {
          throw new Error('Submit project funding for Accounting certification, or select No funding required.');
        }
        const target = await persist();
        await projectFlowCall('finish_project_setup', { p_project: target });
        setReadyProjectId(target);
        let peopleSyncError = '';
        if (!pdfMode) {
          try {
            await applyDraftPeople(target);
          } catch (syncError) {
            peopleSyncError = readableUiError(
              syncError,
              'Project setup completed, but your pre-selected team could not be saved yet. Please review and save on Add people.',
              'write',
            );
          }
        }
        if (pdfMode) {
          setStep(activeTasksStep);
        } else {
          await prefetchProjectOffices(target).catch(() => undefined);
          setStep(peopleStep);
        }
        void flow.reload();
        window.dispatchEvent(new Event('eflow:project-setup'));
        if (peopleSyncError) setError(peopleSyncError);
        return;
      }
      // Step 04 -> Step 05 Review (allow advancing even if Steps 01–03 will be completed later)
      if (fundingDirty || uncertain) {
        throw new Error('Submit the funding rows or clear the unsaved entries before continuing.');
      }
      if (!hasFundingSatisfied) {
        throw new Error('Submit project funding for Accounting certification, or explicitly choose No funding required.');
      }
      if (id && (dirty || !base) && detailsComplete) {
        await persist();
        void flow.reload();
      }
      setStep(reviewStep);
    });
  };

  const executeSaveDraft = () =>
    void perform(async () => {
      setAttemptedSteps((current) => ({ ...current, 0: true }));
      if (fundingRecoveryKey) storeFundingDraft(fundingRecoveryKey);
      setFundingDirty(false);
      const target = await persist();
      if (!pdfMode && target) {
        try {
          await applyDraftPeople(target);
        } catch {
          // Keep project draft saved even if optional pre-selected team sync is skipped.
        }
      }
      window.dispatchEvent(new Event('eflow:project-setup'));
      window.setTimeout(() => onClose(createdId.current), 0);
    });

  const saveDraft = () => {
    if (fundingDirty) {
      setConfirmSaveWithFundingDraft(true);
      return;
    }
    executeSaveDraft();
  };

  const loading = !!projectId && !hydrated.current;
  const datesComplete = hasValidDates(draft, originalStart) && !invalidDates.start && !invalidDates.end;
  const step0Complete =
    (!eligibleProfiles.length && !creatorId ? true : Boolean(draft.lead)) &&
    !leadOverloadError &&
    !titleError(draft.title) &&
    !descriptionError(draft.description);
  const step1Complete = !scopeError(draft.scope);
  const effectiveDraftPeople = Array.from(
    new Set([
      ...(draft.lead ? [draft.lead] : []),
      ...draftPeopleIds.filter((uid) => eligibleProfiles.some((person) => person.id === uid)),
    ]),
  );
  const hasExtraDraftPeople = draftPeopleIds.some((uid) => uid !== draft.lead);
  const canOpenTasks = !!readyProjectId && datesComplete && !dirty && !fundingDirty;
  const complete = pdfMode
    ? [
        step0Complete,
        step1Complete,
        datesComplete,
        hasFundingSatisfied && !fundingDirty && !fundingHasError && !uncertain,
        canOpenTasks,
        false,
      ]
    : [
        step0Complete,
        step1Complete,
        datesComplete,
        hasFundingSatisfied && !fundingDirty && !fundingHasError && !uncertain,
        canOpenTasks,
        hasExtraDraftPeople || (canOpenTasks && step > peopleStep),
        false,
      ];
  const detailsComplete = complete.slice(0, fundingStep).every(Boolean);
  const fundingStepBlocked =
    step === fundingStep && (!hasFundingSatisfied || fundingDirty || fundingHasError);
  const fundingBlockedReason = fundingHasError
    ? 'Resolve the funding error before continuing'
    : fundingDirty
      ? 'Submit or clear the funding entries before continuing'
      : 'Submit funding for Accounting certification or select No funding required';

  // Load read-only Office Budget preview on Step 04 without creating a ghost project row.
  useEffect(() => {
    if (
      !recovery &&
      step === fundingStep &&
      !id &&
      !draft.noFunding &&
      editable &&
      !fundingPreview.data &&
      !fundingPreview.loading &&
      !fundingPreview.error
    ) {
      void loadFundingPreview();
    }
  }, [
    recovery,
    step,
    id,
    draft.noFunding,
    editable,
    fundingPreview.data,
    fundingPreview.loading,
    fundingPreview.error,
    loadFundingPreview,
  ]);

  const missingPrereqsForStep = (targetIndex: number) => {
    const missing: { index: number; number: string; title: string }[] = [];
    const prereqEnd = Math.min(targetIndex - 1, fundingStep);
    for (let i = 0; i <= prereqEnd; i++) {
      if (!complete[i]) {
        missing.push({
          index: i,
          number: String(i + 1).padStart(2, '0'),
          title: wizardSteps[i].title,
        });
      }
    }
    if (pdfMode && targetIndex === activeTasksStep && missing.length === 0 && !canOpenTasks) {
      missing.push({
        index: reviewStep,
        number: String(reviewStep + 1).padStart(2, '0'),
        title: wizardSteps[reviewStep].title,
      });
    }
    return missing;
  };

  const jump = (index: number) => {
    if (locked || loading || uncertain || index === step) return;
    if (pdfMode && index === activeTasksStep) {
      const missingSteps = missingPrereqsForStep(index);
      if (missingSteps.length > 0) {
        setAiSkipModal({
          targetLabel: `${String(index + 1).padStart(2, '0')} ${wizardSteps[index].title}`,
          missingSteps,
        });
        return;
      }
    }
    const change = () => {
      setError('');
      if (index === activeTasksStep) setVisitedTasksStep(true);
      setStep(index);
    };
    if (pdfMode && step > reviewStep) void requestNavigation(change);
    else change();
  };

  const missingCoreSteps = [0, 1, datesStep, fundingStep]
    .filter((i) => !complete[i])
    .map((i) => ({ index: i, label: `${String(i + 1).padStart(2, '0')} ${wizardSteps[i].title}`, title: wizardSteps[i].title }));

  const taskDraftIncompleteNotice =
    !pdfMode && missingCoreSteps.length > 0
      ? {
          missingLabels: missingCoreSteps.map((item) => item.title),
          firstMissingStepIndex: missingCoreSteps[0].index,
          firstMissingStepLabel: missingCoreSteps[0].label,
          onGoToStep: (targetIndex: number) => jump(targetIndex),
        }
      : null;

  const ensureProjectReadyForTasks = async () => {
    if (readyProjectId && !dirty && !fundingDirty) return readyProjectId;
    setAttemptedSteps((current) => ({ ...current, 0: true, 1: true, [datesStep]: true }));
    validate(0);
    validate(1);
    validate(datesStep);
    if (fundingDirty || uncertain) {
      throw new Error('Submit or clear the funding entries in Step 04 before creating the project.');
    }
    if (!hasFundingSatisfied) {
      throw new Error('Submit project funding for Accounting certification, or select No funding required in Step 04.');
    }
    const target = await persist();
    await projectFlowCall('finish_project_setup', { p_project: target });
    setReadyProjectId(target);
    if (!pdfMode) {
      await applyDraftPeople(target);
    }
    void flow.reload();
    window.dispatchEvent(new Event('eflow:project-setup'));
    return target;
  };

  const fieldErrors: SetupFieldErrors = {
    lead: attemptedSteps[0] && !draft.lead ? 'Select a Project Lead.' : undefined,
    title: attemptedSteps[0] ? titleError(draft.title) || undefined : undefined,
    description: attemptedSteps[0] ? descriptionError(draft.description) || undefined : undefined,
    scope: attemptedSteps[1] ? scopeError(draft.scope) || undefined : undefined,
    start: attemptedSteps[datesStep]
      ? invalidDates.start
        ? 'Enter a valid date in MM/DD/YYYY format.'
        : !draft.start
          ? 'Enter a project start date.'
          : projectStartError(draft.start, originalStart) || undefined
      : undefined,
    end: attemptedSteps[datesStep]
      ? invalidDates.end
        ? 'Enter a valid date in MM/DD/YYYY format.'
        : !draft.end
          ? 'Enter a project target date.'
          : draft.start && draft.end < draft.start
            ? 'Target date must be on or after the start date.'
            : undefined
      : undefined,
  };

  function continueDraft(saved: ProjectDraftRecovery) {
    const legacyKey = saved.projectId ? `${recoveryKey}:funding:${saved.projectId}` : `${recoveryKey}:funding:draft`;
    const funding = readFundingDraft(legacyKey) ?? (fundingRecoveryKey ? readFundingDraft(fundingRecoveryKey) : undefined);
    setFundingDirty(!!funding);
    setUncertain(!!funding?.request);
    createdId.current = saved.projectId;
    creationAttempt.current = saved.creationAttempt;
    setId(saved.projectId);
    setDraft({ ...saved.values, lead: saved.values.lead || defaultLeadId });
    setBase(saved.base);
    setDraftPeopleIds(saved.people ?? []);
    peopleRequest.current = saved.peopleRequest;
    setProjectType(saved.projectType ?? '');
    const nextPdfMode = saved.importPdf ?? importPdf;
    const targetTasksStep = nextPdfMode ? aiTasksStep : standardTasksStep;
    const validDates = hasValidDates(saved.values);
    const restoredReadyId = validDates ? (saved.readyProjectId ?? saved.peopleProjectId ?? '') : '';
    const oldStep =
      saved.datesStep || saved.peopleProjectId !== undefined || saved.step >= targetTasksStep
        ? saved.step
        : saved.step + Number(saved.step >= datesStep);
    const restoredStep = Math.min(oldStep, restoredReadyId || !nextPdfMode ? targetTasksStep : reviewStep);
    setReadyProjectId(restoredReadyId);
    setPdfMode(nextPdfMode);
    if (restoredStep === targetTasksStep) setVisitedTasksStep(true);
    setStep(
      funding?.request
        ? fundingStep
        : !nextPdfMode || validDates
          ? restoredStep
          : Math.min(restoredStep, datesStep),
    );
    setRecovery(undefined);
  }

  const previewFlow: ProjectFlow | undefined =
    fundingPreview.data
      ? {
          project: {
            id: id || '',
            status: 'planning',
            title: draft.title,
            description: draft.description,
            scope: draft.scope,
            project_lead_id: draft.lead || defaultLeadId || null,
            start_date: draft.start || null,
            target_date: draft.end || null,
            funding_not_required: draft.noFunding,
            updated_at: '',
          },
          ready: false,
          canDraftWork: false,
          hasEligibleAccountingStaff: fundingPreview.data.hasEligibleAccountingStaff,
          canConfigure: true,
          canAuthorize: fundingPreview.data.canAuthorize,
          canAllocate: true,
          funds: [],
          sources: fundingPreview.data.sources,
          requests: [],
          taskFunding: [],
          liquidations: [],
          fundingRequests: [],
          total: 0,
          allocated: 0,
          unallocated: 0,
          released: 0,
          spent: 0,
        }
      : undefined;

  const fundingPanelData = (id && base && activeFlow?.project.id === id ? activeFlow : undefined) ?? previewFlow;
  const pendingFundingTotal = sumCentavos(
    openFundingRequests.map((req) =>
      typeof req.totalAmount === 'number'
        ? req.totalAmount
        : sumCentavos(req.lines.map((line) => Number(line?.amount || 0))),
    ),
  );
  const reviewSources =
    activeFlow?.funds.length
      ? activeFlow.funds.map((source) => ({
          key: source.id,
          label: `FY ${source.fiscal_year} · ${source.name}`,
          amount: source.amount,
          status: 'Certified',
        }))
      : openFundingRequests.flatMap((req) =>
          req.lines.map((line, idx) => {
            const matched = activeFlow?.sources.find((s) => s.id === line.partitionId);
            return {
              key: `${req.id}-${line.partitionId || idx}`,
              label: matched ? `FY ${matched.year} · ${matched.name}` : 'Selected Office Budget source',
              amount: Number(line.amount || 0),
              status: req.status === 'pending_accounting' ? 'Pending Accounting' : 'Pending Head',
            };
          }),
        );

  if (recovery) {
    const startNewDisabled = !!recovery.creationAttempt;
    const startNewBlocker = startNewDisabled
      ? 'A previous project creation request may still be pending. Continue the draft first to verify before starting a new project.'
      : '';
    const startNewTip = !startNewDisabled
      ? 'Permanently discards your saved local draft and starts a fresh project.'
      : '';
    return (
      <Modal
        isOpen
        title="Create project"
        description="An unfinished project draft is saved on this device."
        onClose={close}
        footer={
          <div className="pf-actions">
            <ActionBlockerGroup actionLabel="Start new project" blockers={startNewBlocker}>
              <WorkspaceTooltip content={startNewTip} disabled={!startNewTip}>
                <span className="inline-flex">
                  <button
                    type="button"
                    disabled={startNewDisabled}
                    onClick={() => {
                      storeProjectDraft(recoveryKey);
                      if (fundingRecoveryKey) storeFundingDraft(fundingRecoveryKey);
                      setRecovery(undefined);
                    }}
                  >
                    Start new project
                  </button>
                </span>
              </WorkspaceTooltip>
            </ActionBlockerGroup>
            <button type="button" className="pf-primary" onClick={() => continueDraft(recovery)}>
              Continue draft
            </button>
          </div>
        }
      >
        {null}
      </Modal>
    );
  }

  const peopleSubmitDisabled = locked || teamAction.disabled;
  const peopleSubmitTip = !peopleSubmitDisabled || locked
    ? ''
    : draftPeopleDisabledReason || 'Resolve team assignment requirements before continuing.';
  const nextDraftTasksDisabled = locked || loading;
  const nextDraftTasksTip = !nextDraftTasksDisabled || locked ? '' : 'Loading saved project setup…';
  const taskSubmitDisabled = locked || (!pdfMode && taskAction.disabled);
  const taskSubmitTip = !taskSubmitDisabled || locked
    ? ''
    : taskDraftIncompleteNotice
      ? `Complete ${taskDraftIncompleteNotice.missingLabels.join(', ')} before creating the project.`
      : 'Complete required draft task details before continuing.';
  const saveDraftDisabled = locked || !draft.title.trim() || uncertain;
  const saveDraftTip = !saveDraftDisabled || locked
    ? ''
    : uncertain
      ? 'Verify your pending funding submission before saving and closing.'
      : 'Enter a Project title in Step 01 Details before saving a draft.';
  const nextDisabled = locked || loading || uncertain || fundingStepBlocked || (step === reviewStep && !editable);
  const nextTip = !nextDisabled || locked
    ? ''
    : loading
      ? 'Loading saved project setup…'
      : uncertain
        ? 'Verify your pending funding submission before continuing.'
        : fundingStepBlocked
          ? fundingBlockedReason
          : step === reviewStep && !editable
            ? 'Only authorized editors can finish project setup.'
            : '';

  return (
    <>
      <Modal
        isOpen={!manageTemplatesOpen}
        title={projectId ? 'Project setup' : pdfMode ? 'Create project with AI' : 'Create a project'}
        description={
          pdfMode
            ? 'Set up the project and import its work plan with AI.'
            : 'Set up the project and draft the work plan.'
        }
        width="max-w-7xl"
        className="pf-wizard-modal"
        bodyClassName="pf-wizard-body"
        footerClassName="pf-wizard-footer-shell"
        onClose={close}
        preventClose={locked}
        footer={
          <div className="pf-wizard-footer">
            <div className="pf-wizard-footer-left">
              {step > 0 && (
                <button type="button" disabled={locked || loading} onClick={() => jump(step - 1)}>
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              <p className="pf-wizard-footer-progress">
                Step {step + 1} of {wizardSteps.length}
                <span>{wizardSteps[step].title}</span>
              </p>
            </div>
            <div className="pf-wizard-footer-actions">
              {!pdfMode && step === peopleStep ? (
                readyProjectId ? (
                  <ActionBlockerGroup
                    actionLabel={teamAction.label}
                    blockers={peopleSubmitTip}
                    busy={locked}
                  >
                    <button
                      type="submit"
                      form={peopleFormId}
                      className="pf-primary"
                      disabled={peopleSubmitDisabled}
                    >
                      {teamAction.label}
                      <ArrowRight size={16} />
                    </button>
                  </ActionBlockerGroup>
                ) : (
                  <ActionBlockerGroup
                    actionLabel="Next: Draft tasks"
                    blockers={nextDraftTasksTip}
                    busy={locked || loading}
                  >
                    <button
                      type="button"
                      className="pf-primary"
                      disabled={nextDraftTasksDisabled}
                      onClick={() => jump(activeTasksStep)}
                    >
                      Next: Draft tasks
                      <ArrowRight size={16} />
                    </button>
                  </ActionBlockerGroup>
                )
              ) : step === activeTasksStep ? (
                <ActionBlockerGroup
                  actionLabel={pdfMode ? 'Open project' : taskAction.label}
                  blockers={taskSubmitTip}
                  busy={locked}
                >
                  <button
                    type={pdfMode ? 'button' : 'submit'}
                    form={pdfMode ? undefined : tasksFormId}
                    className="pf-primary"
                    disabled={taskSubmitDisabled}
                    onClick={pdfMode ? close : undefined}
                  >
                    {pdfMode ? 'Open project' : taskAction.label}
                    <ArrowRight size={16} />
                  </button>
                </ActionBlockerGroup>
              ) : (
                <>
                  {editable && (
                    <ActionBlockerGroup
                      actionLabel="Save draft and close"
                      blockers={saveDraftTip}
                      busy={locked}
                    >
                      <button
                        type="button"
                        disabled={saveDraftDisabled}
                        onClick={saveDraft}
                      >
                        <Save size={16} />
                        Save draft and close
                      </button>
                    </ActionBlockerGroup>
                  )}
                  <ActionBlockerGroup
                    actionLabel={
                      step === reviewStep
                        ? pdfMode
                          ? 'Next: Import AI PDF'
                          : 'Next: Add people'
                        : 'Next'
                    }
                    blockers={nextTip}
                    busy={locked || loading}
                  >
                    <button
                      type="button"
                      className="pf-primary"
                      disabled={nextDisabled}
                      onClick={next}
                    >
                      {locked
                        ? 'Saving…'
                        : step === reviewStep
                          ? pdfMode
                            ? 'Next: Import AI PDF'
                            : 'Next: Add people'
                          : 'Next'}
                      <ArrowRight size={16} />
                    </button>
                  </ActionBlockerGroup>
                </>
              )}
            </div>
          </div>
        }
      >
        <nav className="pf-wizard-steps" data-step-count={wizardSteps.length} aria-label="Project setup steps">
          {wizardSteps.map((item, index) => (
            <button
              type="button"
              key={item.title}
              disabled={manageTemplatesOpen || locked || loading || uncertain}
              onClick={() => jump(index)}
              aria-current={step === index ? 'step' : undefined}
              data-complete={complete[index] || false}
            >
              <span>{complete[index] ? <Check size={17} /> : <item.icon size={17} />}</span>
              <div>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <strong>{item.title}</strong>
              </div>
            </button>
          ))}
        </nav>

        <div className="pf-wizard-content">
          <FlowError error={error || flow.error} />
          {loading ? (
            <p role="status">Loading saved project setup…</p>
          ) : (
            <>
              {step < fundingStep && (
                <div className={step === 0 ? 'pf-wizard-opening' : undefined}>
                  {step === 0 ? (
                    <div className="pf-wizard-details">
                      <ProjectSetupFields
                        step={step}
                        draft={draft}
                        update={update}
                        profiles={inferredOrgId ? profiles.filter((person) => person.org_id === inferredOrgId) : profiles}
                        officeHeadId={officeHeadId}
                        disabled={locked || !editable}
                        originalStart={originalStart}
                        fieldErrors={fieldErrors}
                        workloadByUser={workload.byUserId}
                        workloadThresholds={workload.thresholds}
                        workloadOrgId={inferredOrgId}
                        originalLeadId={base?.project_lead_id || ''}
                        leadOverride={leadOverride}
                        onLeadOverrideChange={setLeadOverride}
                        showLeadOverrideValidation={Boolean(attemptedSteps[0])}
                      />
                      {editable && !pdfMode && (
                        <div className="pf-wizard-fields pf-starter-block">
                          <label htmlFor={starterSelectId}>Project type (optional)</label>
                          <div className="pf-starter-header">
                            <select
                              id={starterSelectId}
                              value={projectType}
                              disabled={locked || templateLibrary.loading || !templateLibrary.templates.length}
                              onChange={(event) => setProjectType(event.target.value)}
                            >
                              <option value="">
                                {templateLibrary.loading
                                  ? 'Loading project types…'
                                  : templateLibrary.templates.length
                                    ? 'Choose a starter template'
                                    : 'No templates yet — create one'}
                              </option>
                              {templateLibrary.templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              kind="secondary"
                              size="medium"
                              className="pf-starter-manage-btn"
                              disabled={locked}
                              onClick={() => {
                                setTemplateInitialCreate(!templateLibrary.templates.length);
                                setManageTemplatesOpen(true);
                              }}
                            >
                              {templateLibrary.templates.length ? '+ New / Manage templates' : 'Create template'}
                            </Button>
                          </div>
                          {templateLibrary.error && (
                            <FeedbackState
                              tone="error"
                              title="Could not load starter templates"
                              onRetry={() => void templateLibrary.reload()}
                              pending={templateLibrary.loading}
                            >
                              {templateLibrary.error}
                            </FeedbackState>
                          )}
                          {!templateLibrary.loading && !templateLibrary.error && !templateLibrary.templates.length && (
                            <p className="pf-starter-hint">
                              Create a starter template to reuse standard task groups and subtasks across new projects.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <ProjectSetupFields
                      step={step}
                      draft={draft}
                      update={update}
                      profiles={profiles}
                      disabled={locked || !editable}
                      originalStart={originalStart}
                      fieldErrors={fieldErrors}
                      onDateInvalidChange={(field, inv) =>
                        setInvalidDates((current) => ({ ...current, [field]: inv }))
                      }
                    />
                  )}
                  {step === 0 && <ProjectOpeningPreview title={draft.title} selectedTemplate={selectedTemplate} />}
                </div>
              )}

              <section hidden={step !== fundingStep} aria-label="Project funding step">
                <p className="pf-eyebrow">PROJECT FUNDING</p>
                <h2>Set the funding sources</h2>
                <p>
                  Choose the Office Budget source and amount for the current fiscal year. Funded projects require
                  independent Accounting Staff certification before funds are reserved.
                </p>
                <div className="pf-funding-toolbar">
                  {(() => {
                    const noFundingDisabled =
                      !editable ||
                      !!activeFlow?.funds.length ||
                      openFundingRequests.length > 0 ||
                      locked ||
                      fundingDirty ||
                      uncertain;
                    const noFundingTip = !noFundingDisabled
                      ? ''
                      : !editable
                        ? 'Only authorized editors can change project funding settings.'
                        : activeFlow?.funds.length
                          ? 'Certified funding is already linked to this project.'
                          : openFundingRequests.length > 0
                            ? 'Withdraw pending funding requests before choosing No funding required.'
                            : uncertain
                              ? 'Verify your pending funding submission before changing this setting.'
                              : fundingDirty
                                ? 'Clear your unsaved funding entries below before choosing No funding required.'
                                : 'Wait for the current save action to finish.';
                    return (
                      <ActionBlockerGroup
                        actionLabel="No funding required"
                        blockers={noFundingTip}
                        busy={locked}
                        size="sm"
                      >
                        <label className="pf-checkbox">
                          <input
                            type="checkbox"
                            checked={draft.noFunding}
                            disabled={noFundingDisabled}
                            onChange={(e) => update('noFunding', e.target.checked)}
                          />
                          No funding required for this project
                        </label>
                      </ActionBlockerGroup>
                    );
                  })()}
                  {!draft.noFunding && fundingPanelData && (
                    <button
                      type="button"
                      className="pf-funding-refresh-inline"
                      disabled={locked || fundingPreview.loading || reloadingFlowSources}
                      onClick={() => void reloadFunding()}
                    >
                      <RefreshCw
                        size={13}
                        aria-hidden="true"
                        className={fundingPreview.loading || reloadingFlowSources ? 'pf-spin' : undefined}
                      />
                      {fundingPreview.loading || reloadingFlowSources ? 'Reloading…' : 'Reload sources'}
                    </button>
                  )}
                </div>
                {!draft.noFunding && !fundingPanelData && ((!id && fundingPreview.loading) || reloadingFlowSources) && (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    className="pf-funding-loading-card"
                  >
                    <div className="pf-funding-loading-head">
                      <span className="pf-funding-loading-icon" aria-hidden="true">
                        <RefreshCw size={16} className="pf-spin" />
                      </span>
                      <div>
                        <strong>
                          {fundingPreview.reloading || reloadingFlowSources
                            ? 'Reloading Office Budget sources…'
                            : 'Loading Office Budget sources…'}
                        </strong>
                        <p>Checking locked fiscal year accounts and available balances.</p>
                      </div>
                    </div>
                    <div className="pf-funding-loading-skeleton" aria-hidden="true">
                      <span className="pf-funding-loading-bar" />
                      <span className="pf-funding-loading-bar" />
                    </div>
                  </div>
                )}
                {!draft.noFunding && !fundingPreview.loading && !reloadingFlowSources && ((!id && fundingPreview.error) || flow.error) && (
                  <div role="alert" className="pf-funding-error-card">
                    <div className="pf-funding-error-main">
                      <span className="pf-funding-error-icon" aria-hidden="true">
                        <AlertCircle size={17} />
                      </span>
                      <div>
                        <strong>Could not load Office Budget sources</strong>
                        <p>{(!id && fundingPreview.error) || flow.error}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="pf-funding-reload-btn"
                      disabled={locked || fundingPreview.loading || reloadingFlowSources}
                      onClick={!id ? () => void loadFundingPreview(true) : () => void reloadFunding()}
                    >
                      <RefreshCw size={14} aria-hidden="true" />
                      Reload funding sources
                    </button>
                  </div>
                )}
                {!draft.noFunding && fundingPanelData && (
                  <fieldset disabled={busy} className="min-w-0">
                    <ProjectFundingPanel
                      key={projectId || 'wizard-funding-panel'}
                      wizard
                      recoveryKey={fundingRecoveryKey}
                      data={fundingPanelData}
                      ensureProject={!id ? ensureProjectForFunding : undefined}
                      reload={refreshFundingQuietly}
                      onBusyChange={setFundingBusy}
                      onDraftChange={setFundingDirty}
                      onErrorChange={setFundingHasError}
                      onUncertainChange={setUncertain}
                    />
                  </fieldset>
                )}
              </section>

              {step === reviewStep && (
                <section className="pf-wizard-review">
                  <p className="pf-eyebrow">REVIEW</p>
                  <h2>Ready to build the work plan?</h2>
                  <h3>{draft.title.trim() || 'Untitled project'}</h3>
                  <p>{draft.description.trim() || 'Required — complete Step 01 Details.'}</p>
                  {missingCoreSteps.length > 0 && (
                    <div className="pf-draft-ahead-banner" role="status">
                      <div>
                        <strong>Complete remaining setup tabs before finalizing</strong>
                        <p>
                          Still needed: {missingCoreSteps.map((s) => s.label).join(', ')}. You can jump to any tab in
                          any order — all entries stay saved.
                        </p>
                      </div>
                      <div className="pf-actions">
                        <button type="button" onClick={() => jump(missingCoreSteps[0].index)}>
                          Go to {missingCoreSteps[0].label}
                        </button>
                      </div>
                    </div>
                  )}
                  <dl>
                    <div>
                      <dt>Scope</dt>
                      <dd>{draft.scope.trim() || 'Required — complete Step 02 Scope'}</dd>
                    </div>
                    <div>
                      <dt>Project lead</dt>
                      <dd>{profiles.find((p) => p.id === draft.lead)?.full_name || 'Assigned project lead'}</dd>
                    </div>
                    <div>
                      <dt>Timeline</dt>
                      <dd>
                        {draft.start && draft.end
                          ? `${formatManilaDate(draft.start, draft.start)} → ${formatManilaDate(draft.end, draft.end)}`
                          : 'Required — complete Step 03 Dates'}
                      </dd>
                    </div>
                    <div>
                      <dt>Project budget</dt>
                      <dd>
                        {draft.noFunding
                          ? 'No funding required'
                          : hasCertifiedFunding
                            ? `${formatPeso(activeFlow?.total || 0)} (Certified)`
                            : awaitingAccounting
                              ? `${formatPeso(pendingFundingTotal)} (Pending Accounting Staff certification)`
                              : awaitingHead
                                ? `${formatPeso(pendingFundingTotal)} (Pending Head endorsement & Accounting certification)`
                                : 'Not set'}
                      </dd>
                    </div>
                    {!pdfMode && hasExtraDraftPeople && (
                      <div>
                        <dt>Project team</dt>
                        <dd>
                          {effectiveDraftPeople.length}{' '}
                          {effectiveDraftPeople.length === 1 ? 'member' : 'members'} selected (
                          {effectiveDraftPeople
                            .map((uid) => profiles.find((person) => person.id === uid)?.full_name)
                            .filter(Boolean)
                            .join(', ')}
                          )
                        </dd>
                      </div>
                    )}
                  </dl>
                  {!draft.noFunding && reviewSources.length > 0 && (
                    <ul className="pf-review-sources">
                      {reviewSources.map((source) => (
                        <li key={source.key}>
                          <span>{source.label}</span>
                          <div className="pf-review-source-right">
                            <span
                              className="pf-status-badge"
                              data-tone={source.status === 'Certified' ? 'positive' : 'warning'}
                            >
                              {source.status}
                            </span>
                            <strong>{formatPeso(source.amount)}</strong>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!draft.noFunding && !hasCertifiedFunding && hasSubmittedFunding && (
                    <p className="pf-warning">
                      Funding certification pending — you can finish setup and draft tasks now. Project activation and
                      task budget allocation remain locked until independent Accounting Staff certifies funding.
                    </p>
                  )}
                  <p>
                    {pdfMode
                      ? 'Continue to import your proposal PDF with AI. AI automatically pulls from all active members of your office.'
                      : 'Continue to choose your project team (optional), or skip straight to Draft tasks.'}
                  </p>
                </section>
              )}

              {!pdfMode && step === peopleStep && (
                readyProjectId ? (
                  <SetupPeople
                    key={readyProjectId}
                    projectId={readyProjectId}
                    projectTitle={draft.title}
                    projectLeadId={draft.lead}
                    projectStatus={activeFlow?.project.status || 'planning'}
                    governed={governed}
                    profiles={profiles}
                    profilesLoading={profilesLoading}
                    organizations={organizations}
                    tasks={tasks}
                    formId={peopleFormId}
                    onSaveStateChange={handleTeamSaveStateChange}
                    onClose={() => {
                      setTeamAction({ label: 'Next: Draft tasks', disabled: false, busy: false });
                      setVisitedTasksStep(true);
                      setStep(activeTasksStep);
                    }}
                  />
                ) : (
                  <DraftPeopleStep
                    profiles={profiles}
                    profilesLoading={profilesLoading}
                    orgId={inferredOrgId || undefined}
                    projectLeadId={draft.lead}
                    selectedIds={draftPeopleIds}
                    disabled={locked || !editable}
                    disabledReason={draftPeopleDisabledReason}
                    workloadByUser={workload.byUserId}
                    onToggle={toggleDraftPerson}
                  />
                )
              )}

              {pdfMode && step === activeTasksStep && readyProjectId && (
                <ProjectPdfImportPanel
                  key={readyProjectId}
                  projectId={readyProjectId}
                  projectTitle={draft.title}
                  startDate={draft.start}
                  projectContext={{ title: draft.title, description: draft.description, scope: draft.scope }}
                  projectFunding={
                    activeFlow
                      ? {
                          fundingNotRequired: activeFlow.project.funding_not_required || draft.noFunding,
                          total: activeFlow.total,
                          unallocated: activeFlow.unallocated,
                          funds: activeFlow.funds,
                        }
                      : undefined
                  }
                  embedded
                  onBusyChange={setTaskDraftBusy}
                />
              )}
              {!pdfMode && (visitedTasksStep || readyProjectId) && (
                <div hidden={step !== activeTasksStep}>
                  <ProjectTaskDraftStep
                    formId={tasksFormId}
                    onSaveStateChange={handleTaskSaveStateChange}
                    key={projectId || 'wizard-task-draft'}
                    projectId={readyProjectId}
                    project={draft}
                    templates={templateLibrary.templates}
                    templateError={templateLibrary.error}
                    initialTemplate={selectedTemplate}
                    setupIncompleteNotice={taskDraftIncompleteNotice}
                    onEnsureReady={ensureProjectReadyForTasks}
                    onTemplateSaved={(saved) => {
                      void templateLibrary.reload();
                      setProjectType(saved.id);
                    }}
                    onSaved={(savedId) => finish(savedId || readyProjectId)}
                    onBusyChange={setTaskDraftBusy}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {aiSkipModal && (
        <Modal
          isOpen
          title="Complete earlier setup steps for AI import"
          description={`Cannot skip ahead to ${aiSkipModal.targetLabel} yet.`}
          width="max-w-lg"
          onClose={() => setAiSkipModal(null)}
          footer={
            <div className="pf-actions">
              <button type="button" onClick={() => setAiSkipModal(null)}>
                Close
              </button>
              <button
                type="button"
                className="pf-primary"
                onClick={() => {
                  const first = aiSkipModal.missingSteps[0];
                  setAiSkipModal(null);
                  if (first) {
                    setError('');
                    setStep(first.index);
                  }
                }}
              >
                Go to {aiSkipModal.missingSteps[0]?.number} {aiSkipModal.missingSteps[0]?.title}
              </button>
            </div>
          }
        >
          <div className="pf-ai-skip-body">
            <p>
              <strong>Create project with AI</strong> relies on your project’s <strong>Details</strong>,{' '}
              <strong>Scope</strong>, <strong>Dates</strong>, and <strong>Funding</strong> so the AI importer can
              extract accurate tasks, align realistic schedules, and map budget requirements properly.
            </p>
            <div className="pf-ai-skip-list" role="region" aria-label="Steps required before skipping">
              <small>Complete these steps first</small>
              <ul>
                {aiSkipModal.missingSteps.map((item) => (
                  <li key={item.index}>
                    <span className="pf-status-badge" data-tone="warning">
                      Step {item.number}
                    </span>
                    <strong>{item.title}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}

      {confirmSaveWithFundingDraft && (
        <DecisionModal
          title="Save project draft without unsubmitted funding?"
          description="You have unsaved funding entries in Step 04 that have not been submitted for certification. Saving this draft stores your project details and discards the unsubmitted funding form entries."
          decision="changes"
          confirmLabel="Save draft & discard funding entries"
          requireReason={false}
          busy={busy}
          onCancel={() => setConfirmSaveWithFundingDraft(false)}
          onConfirm={() => {
            setConfirmSaveWithFundingDraft(false);
            executeSaveDraft();
          }}
        />
      )}

      {manageTemplatesOpen && (
        <Modal
          isOpen
          title="Project starter templates"
          description="Create and manage reusable task checklists."
          width="max-w-5xl"
          onClose={() => {
            setManageTemplatesOpen(false);
            setTemplateInitialCreate(false);
          }}
        >
          <ProjectTaskTemplateLibrary
            compactHeader
            initialCreate={templateInitialCreate}
            onTemplatesChanged={(saved) => {
              void templateLibrary.reload();
              if (saved?.id) {
                setProjectType(saved.id);
                setManageTemplatesOpen(false);
                setTemplateInitialCreate(false);
              }
            }}
          />
        </Modal>
      )}
    </>
  );
}

function SetupPeople({
  projectId,
  ...props
}: { projectId: string } & Parameters<typeof ProjectPeoplePage>[0]) {
  const offices = useProjectOffices(projectId);
  return (
    <ProjectOfficeContext.Provider value={offices}>
      <ProjectPeoplePage {...props} embedded />
    </ProjectOfficeContext.Provider>
  );
}
