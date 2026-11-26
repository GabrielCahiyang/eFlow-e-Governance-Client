import { getPhilippineCalendarDate, scheduledDateError } from '../../../shared/calendarDates';
import { ImportImpact } from './ImportImpact';
import { useId, useState } from 'react';
import { BoundedTextarea, BoundedTextInput } from '../../../components/ui/BoundedInput';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { ReviewSectionNav, WorkspaceTooltip } from '../../../components/ui/workspace';
import { DateInput } from '../../../components/ui/DateInput';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { reviewedImportPayload } from '../selectors/draftValidation';
import { projectImportSummary } from '../selectors/reviewSummary';
import { FileUp, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import type { ProjectGroup } from '../../project-table';
import type { Organization } from '../../../types';
import { useProjectImport } from '../hooks/useProjectImport';
import { ImportTaskReview } from './ImportTaskReview';
import type { ImportTask, ImportProjectDetails } from '../types';
import '../projectImport.css';

export function ProjectImportDialog({ open, onClose, projectId, projectTitle, groups, orgs, onImported, currentDetails }: {
  open: boolean; onClose: () => void; projectId: string; projectTitle: string; groups: ProjectGroup[]; orgs: Organization[]; onImported: () => void; currentDetails?: Partial<ImportProjectDetails>;
}) {
  const state = useProjectImport(projectId, onImported);
  const { draft, setDraft, busy, result, retryPending } = state;
  const confirmation = useConfirmation();
  const guard = useExplicitDraft('Reviewed project import', open && !result && (!!draft || !!state.source.trim()), open && !!busy, () => {});
  guard.pendingRef.current = open && state.operation.current;
  const prefix = useId();
  const [section, setSection] = useState('work');
  const [reviewError, setReviewError] = useState('');
  const [sourceTouched, setSourceTouched] = useState(false);
  const [invalidProjectDates, setInvalidProjectDates] = useState<{ start: boolean; target: boolean }>({ start: false, target: false });
  const close = () => void requestNavigation(onClose);
  const selectSection = (id: string) => { setSection(id); const target = document.getElementById(prefix + id); target?.scrollIntoView({ block: 'start' }); target?.focus({ preventScroll: true }); };
  const summary = draft ? projectImportSummary(draft) : null;
  const todayManila = getPhilippineCalendarDate();
  const sourceWords = state.source.trim() ? state.source.trim().split(/\s+/).length : 0;
  const sourceError = sourceWords === 0
    ? 'Enter or upload a project document brief (at least 20 words).'
    : sourceWords < 20
      ? `Enter at least 20 words so AI can draft tasks (${20 - sourceWords} more ${20 - sourceWords === 1 ? 'word' : 'words'} needed).`
      : '';
  const visibleSourceError = sourceTouched || state.source.length > 0 ? sourceError : '';

  const projectStartError = draft
    ? invalidProjectDates.start
      ? 'Enter a valid start date in MM/DD/YYYY format.'
      : draft.project.startDate && draft.project.targetDate && draft.project.startDate > draft.project.targetDate
        ? 'Project start must be on or before the target date.'
        : scheduledDateError(draft.project.startDate, { earliest: todayManila, latest: draft.project.targetDate || '', label: 'Project start' })
    : '';
  const projectTargetEarliest = draft?.project.startDate && draft.project.startDate > todayManila ? draft.project.startDate : todayManila;
  const projectTargetError = draft
    ? invalidProjectDates.target
      ? 'Enter a valid target date in MM/DD/YYYY format.'
      : draft.project.startDate && draft.project.targetDate && draft.project.targetDate < draft.project.startDate
        ? 'Project target must be on or after the start date.'
        : scheduledDateError(draft.project.targetDate, { earliest: projectTargetEarliest, label: 'Project target' })
    : '';

  const confirmImport = async () => {
    if (busy || state.operation.current || !draft) return;
    setReviewError('');
    if (!retryPending) {
      if (state.applyDetails && (invalidProjectDates.start || invalidProjectDates.target)) {
        setReviewError(projectStartError || projectTargetError || 'Enter valid project dates in MM/DD/YYYY format.');
        return;
      }
      try { reviewedImportPayload(draft, state.sourceName, state.applyDetails); } catch (e) { setReviewError((e as Error).message); return; }
      if (!await confirmation.confirm({ title: 'Add reviewed work to project?', description: `Add to ${projectTitle}. Imported tasks start unassigned; proposed Offices grant no access or responsibility.`, actionLabel: 'Add reviewed work', impact: <ImportImpact summary={summary!} title={projectTitle} proposed={draft.project} current={currentDetails} applyDetails={state.applyDetails}/> })) return;
    }
    await state.save();
  };
  const locked = !!busy || retryPending || !!result;
  const tasks = draft?.groups.flatMap(g => g.tasks) || [], included = tasks.filter(t => t.included);
  const changeTask = (key: string, patch: Partial<ImportTask>) => setDraft(current => current ? { ...current, groups: current.groups.map(g => ({ ...g, tasks: g.tasks.map(t => t.key === key ? { ...t, ...patch } : t) })) } : current);
  const generateDisabled = !!busy || sourceWords < 20;
  const addDisabled = !!busy || !included.length;
  const addBlocker = !included.length ? 'Select at least one task to add to this project.' : '';
  const retryEnabledTip = !addDisabled && retryPending
    ? 'Retries the same locked import batch safely without creating duplicates.'
    : '';

  return <Dialog open={open} onOpenChange={value => { if (!value) close(); }}><DialogContent className="pi-dialog" showCloseButton={busy !== 'saving'}>
    <header className="pi-header"><div><span className="pi-eyebrow"><Sparkles size={15}/>Project import</span><DialogTitle>{result ? 'Work added to your project' : draft ? 'Review your project plan' : 'Turn a document into project work'}</DialogTitle><DialogDescription>{projectTitle} · Review every suggestion before adding it to the project.</DialogDescription></div></header>
    {confirmation.dialog}{reviewError && <p role="alert" className="pi-error">{reviewError}</p>}
    {state.error && <div role="alert" className="pi-error">{state.error}{retryPending && <p>Your reviewed batch is locked for a safe retry. Retry the same import to check its result without creating duplicates.</p>}</div>}
    {result ? <div className="pi-success"><CheckCircle2 size={44}/><h3>{result.taskCount} tasks and {result.subitemCount} subitems added</h3><p>They now appear in your project table and its views. Office responsibilities remain proposals; owners can be assigned through the normal workflow.</p></div> : !draft ? <div className="pi-source-layout">
      <section className="pi-source-form"><h3>Start with your project document</h3><p>Upload a proposal, implementation plan, or project document. You can also paste a project brief describing the objectives and work.</p>
        <label className="pi-upload"><FileUp size={24}/><strong>Choose a document</strong><span>PDF, .txt or .md · up to 20 MB</span><input aria-label="Project document" type="file" accept=".pdf,.txt,.md" disabled={!!busy} onChange={e => { const file = e.target.files?.[0]; if (file) void state.upload(file); e.target.value = ''; }}/></label>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-source-name`}>Source name</label>
          <BoundedTextInput
            id={`${prefix}-source-name`}
            value={state.sourceName}
            maxLength={INPUT_LIMITS.TITLE}
            disabled={!!busy}
            onChange={e => state.setSourceName(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-source-text`}>
            Document text or project brief <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
          </label>
          <BoundedTextarea
            id={`${prefix}-source-text`}
            value={state.source}
            maxLength={500000}
            aria-required="true"
            placeholder="Describe the project objectives, activities, timeline, and Offices involved (at least 20 words)…"
            disabled={!!busy}
            error={visibleSourceError || undefined}
            onBlur={() => setSourceTouched(true)}
            onChange={e => {
              state.setSource(e.target.value);
              if (!sourceTouched) setSourceTouched(true);
            }}
          />
        </div>
      </section><aside className="pi-preview"><h3>{projectTitle}</h3><div className="pi-preview-tabs">Main table <span>Project plan</span></div>{['Preparation', 'Implementation', 'Monitoring'].map((name, i) => <div className="pi-preview-group" key={name} style={{ borderColor: ['#579bfc', '#00c875', '#a25ddc'][i] }}><strong>{name}</strong>{[0,1,2].map(j => <div className="pi-preview-row" key={j}><i/><span/><b/></div>)}</div>)}<p>Review draft groups, tasks, subtasks, suggested dates, and Offices named in your document.</p><p>eFlow uses your existing project details and work to prepare the draft.</p></aside>
    </div> : <div className="pi-review-body">
      <aside id={prefix+'offices'} tabIndex={-1} className="pi-responsibilities eflow-review-target"><div className="pi-review-summary"><ReviewSectionNav selected={section} onSelect={selectSection} sections={[{id:'details',label:'Project details',detail:state.applyDetails ? 'Overwrite selected' : 'Keep current details'},{id:'offices',label:'Detected Offices',detail:`${draft.offices.length} proposals · ${summary?.unconfirmedOffices} need review`},{id:'work',label:'Groups and work',detail:`${summary?.groups} groups · ${summary?.tasks} tasks · ${summary?.subitems} subitems`},{id:'warnings',label:'Warnings',detail:`${draft.warnings.length} review notes`}]} /></div><h3>Detected Offices <span>{draft.offices.length}</span></h3><p>Confirm these project-specific responsibilities. This does not invite people or change the Office directory.</p>{!draft.offices.length && <p>No source-named Offices were verified.</p>}
        {draft.offices.map(o => <article key={o.key}><label><input type="checkbox" checked={o.confirmed} disabled={locked} onChange={e => setDraft({ ...draft, offices: draft.offices.map(x => x.key === o.key ? { ...x, confirmed: e.target.checked } : x) })}/><strong>{o.name}</strong></label><blockquote>{o.evidence}</blockquote><label>Match existing Office<select value={o.officeId} disabled={locked} onChange={e => setDraft({ ...draft, offices: draft.offices.map(x => x.key === o.key ? { ...x, officeId: e.target.value } : x) })}><option value="">Keep proposed name</option>{orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label><WorkspaceTooltip content={locked ? '' : `Removes “${o.name}” from proposed Offices and clears it from tasks linked to it.`} disabled={locked}><span className="inline-flex"><button type="button" disabled={locked} onClick={() => setDraft({ ...draft, offices: draft.offices.filter(x => x.key !== o.key), groups: draft.groups.map(g => ({ ...g, tasks: g.tasks.map(t => t.officeKey === o.key ? { ...t, officeKey: '' } : t) })) })}>Remove proposal</button></span></WorkspaceTooltip></article>)}
        <div id={draft.warnings.length ? undefined : prefix+'warnings'} tabIndex={-1}>{!draft.warnings.length && <p>No analysis warnings were returned. Review all suggestions.</p>}{draft.warnings.length > 0 && <details id={prefix+'warnings'} tabIndex={-1} open><summary>Review notes ({draft.warnings.length})</summary>{draft.warnings.map((w, i) => <p key={i}>{w}</p>)}</details>}</div>
        <p className="pi-authority-note">Imported tasks belong to this project’s Office and start unassigned. Proposed responsibilities do not transfer authority.</p>
      </aside>
      <main id={prefix+'work'} tabIndex={-1} className="pi-draft-main eflow-review-target"><details id={prefix+'details'} tabIndex={-1} className="pi-project-details eflow-review-target" open={section==='details' ? true : undefined}><summary>Project information from the source</summary><div>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-proj-name`}>
            Project name {state.applyDetails && <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>}
          </label>
          <BoundedTextInput
            id={`${prefix}-proj-name`}
            value={draft.project.title}
            maxLength={INPUT_LIMITS.TITLE}
            disabled={locked}
            aria-required={state.applyDetails || undefined}
            error={state.applyDetails && !draft.project.title.trim() ? 'Enter a project name.' : undefined}
            onChange={e => setDraft({ ...draft, project: { ...draft.project, title: e.target.value } })}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-proj-desc`}>Description</label>
          <BoundedTextarea
            id={`${prefix}-proj-desc`}
            value={draft.project.description}
            rows={3}
            disabled={locked}
            maxLength={INPUT_LIMITS.DESCRIPTION}
            onChange={e => setDraft({ ...draft, project: { ...draft.project, description: e.target.value } })}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${prefix}-proj-obj`}>Objectives</label>
          <BoundedTextarea
            id={`${prefix}-proj-obj`}
            value={draft.project.objectives}
            rows={3}
            disabled={locked}
            maxLength={INPUT_LIMITS.DESCRIPTION}
            onChange={e => setDraft({ ...draft, project: { ...draft.project, objectives: e.target.value } })}
          />
        </div>
        <div className="pi-date-pair">
          <div className="grid gap-1">
            <label htmlFor={`${prefix}-proj-start`}>Project start</label>
            <DateInput
              id={`${prefix}-proj-start`}
              value={draft.project.startDate}
              min={todayManila}
              max={draft.project.targetDate || undefined}
              disabled={locked}
              hasError={Boolean(projectStartError)}
              errorMessage={projectStartError || undefined}
              onInvalidTextChange={inv => setInvalidProjectDates(prev => ({ ...prev, start: inv }))}
              onChange={e => setDraft({ ...draft, project: { ...draft.project, startDate: e.target.value } })}
            />
            {projectStartError && <div className="eflow-bounded-meta"><span className="eflow-bounded-meta__hint" data-tone="error" role="alert">{projectStartError}</span></div>}
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${prefix}-proj-target`}>Project target</label>
            <DateInput
              id={`${prefix}-proj-target`}
              value={draft.project.targetDate}
              min={projectTargetEarliest}
              disabled={locked}
              hasError={Boolean(projectTargetError)}
              errorMessage={projectTargetError || undefined}
              onInvalidTextChange={inv => setInvalidProjectDates(prev => ({ ...prev, target: inv }))}
              onChange={e => setDraft({ ...draft, project: { ...draft.project, targetDate: e.target.value } })}
            />
            {projectTargetError && <div className="eflow-bounded-meta"><span className="eflow-bounded-meta__hint" data-tone="error" role="alert">{projectTargetError}</span></div>}
          </div>
        </div>
        <label><input type="checkbox" checked={state.applyDetails} disabled={locked} onChange={e => state.setApplyDetails(e.target.checked)}/>Use these reviewed details for the current project</label>
      </div></details>
        {draft.groups.map(group => <section className="pi-review-group" key={group.key} style={{ borderLeftColor: group.color }}><header><BoundedTextInput aria-label={`Group name ${group.key}`} aria-required="true" value={group.title} maxLength={INPUT_LIMITS.GROUP_TITLE} disabled={locked} error={!group.title.trim() ? 'Group name is required.' : undefined} onChange={e => setDraft({ ...draft, groups: draft.groups.map(g => g.key === group.key ? { ...g, title: e.target.value } : g) })}/><span>{group.tasks.filter(t => t.included).length} tasks</span><select aria-label={`Destination ${group.key}`} value={group.existingGroupId} disabled={locked} onChange={e => setDraft({ ...draft, groups: draft.groups.map(g => g.key === group.key ? { ...g, existingGroupId: e.target.value } : g) })}><option value="">Create new group</option>{groups.map(g => <option key={g.id} value={g.id}>Add to {g.title}</option>)}</select></header>
          <ImportTaskReview tasks={group.tasks} allTasks={tasks} offices={draft.offices} disabled={locked} onChange={changeTask}/></section>)}
      </main>
    </div>}
    <footer className="pi-footer">
      <div>{busy ? <span role="status" className="pi-progress"><RefreshCw size={17} className="pi-spinning"/>{busy === 'saving' ? 'Adding your reviewed work…' : busy === 'reading' ? 'Reading the document…' : state.progress}</span> : draft && !result ? <span>{included.length} tasks · {included.reduce((n, t) => n+t.subitems.length, 0)} subitems selected</span> : <span>Your project stays unchanged until you confirm.</span>}</div>
      <div className="pi-footer-actions">
        {result && <button onClick={() => void requestNavigation(state.newImport)}>Import another document</button>}
        <button disabled={busy === 'saving'} onClick={close}>{result ? 'Close' : 'Remind me later'}</button>
        {!result && (draft ? <>
          <button disabled={locked} onClick={() => void requestNavigation(() => setDraft(null))}>Edit source</button>
          <button disabled={locked} onClick={() => void requestNavigation(() => { void state.generate(); })}>Regenerate</button>
          <ActionBlockerGroup
            actionLabel={retryPending ? 'Retry same import' : 'Add to Project'}
            blockers={addBlocker}
            busy={Boolean(busy)}
          >
            <WorkspaceTooltip content={retryEnabledTip} disabled={!retryEnabledTip}>
              <button className="pi-primary" disabled={addDisabled} onClick={() => { void confirmImport(); }}>{retryPending ? 'Retry same import' : 'Add to Project'}</button>
            </WorkspaceTooltip>
          </ActionBlockerGroup>
        </> : <ActionBlockerGroup actionLabel="Generate draft" blockers={sourceError} busy={Boolean(busy)}>
          <button className="pi-primary" disabled={generateDisabled} onClick={() => { setSourceTouched(true); void state.generate(); }}>Generate draft</button>
        </ActionBlockerGroup>)}
      </div>
    </footer>
  </DialogContent></Dialog>;
}
