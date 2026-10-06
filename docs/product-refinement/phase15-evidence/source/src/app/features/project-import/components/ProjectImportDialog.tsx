import { ImportImpact } from './ImportImpact';
import { useId, useState } from 'react';
import { ReviewSectionNav } from '../../../components/ui/workspace';
import { useConfirmation } from '../../../components/ui/useConfirmation';
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
  const prefix = useId(); const [section, setSection] = useState('work'), [reviewError, setReviewError] = useState('');
  const close = () => void requestNavigation(onClose);
  const selectSection = (id: string) => { setSection(id); const target = document.getElementById(prefix + id); target?.scrollIntoView({ block: 'start' }); target?.focus({ preventScroll: true }); };
  const summary = draft ? projectImportSummary(draft) : null;
  const confirmImport = async () => {
    if (busy || state.operation.current || !draft) return;
    setReviewError('');
    if (!retryPending) {
      try { reviewedImportPayload(draft, state.sourceName, state.applyDetails); } catch (e) { setReviewError((e as Error).message); return; }
      if (!await confirmation.confirm({ title: 'Add reviewed work to project?', description: `Add to ${projectTitle}. Imported tasks start unassigned; proposed Offices grant no access or responsibility.`, actionLabel: 'Add reviewed work', impact: <ImportImpact summary={summary!} title={projectTitle} proposed={draft.project} current={currentDetails} applyDetails={state.applyDetails}/> })) return;
    }
    await state.save();
  };
  const locked = !!busy || retryPending || !!result;
  const tasks = draft?.groups.flatMap(g => g.tasks) || [], included = tasks.filter(t => t.included);
  const changeTask = (key: string, patch: Partial<ImportTask>) => setDraft(current => current ? { ...current, groups: current.groups.map(g => ({ ...g, tasks: g.tasks.map(t => t.key === key ? { ...t, ...patch } : t) })) } : current);
  return <Dialog open={open} onOpenChange={value => { if (!value) close(); }}><DialogContent className="pi-dialog" showCloseButton={busy !== 'saving'}>
    <header className="pi-header"><div><span className="pi-eyebrow"><Sparkles size={15}/>Project import</span><DialogTitle>{result ? 'Work added to your project' : draft ? 'Review your project plan' : 'Turn a document into project work'}</DialogTitle><DialogDescription>{projectTitle} · Review every suggestion before adding it to the project.</DialogDescription></div></header>
    {confirmation.dialog}{reviewError && <p role="alert" className="pi-error">{reviewError}</p>}
    {state.error && <div role="alert" className="pi-error">{state.error}{retryPending && <p>Your reviewed batch is locked for a safe retry. Retry the same import to check its result without creating duplicates.</p>}</div>}
    {result ? <div className="pi-success"><CheckCircle2 size={44}/><h3>{result.taskCount} tasks and {result.subitemCount} subitems added</h3><p>They now appear in your project table and its views. Office responsibilities remain proposals; owners can be assigned through the normal workflow.</p></div> : !draft ? <div className="pi-source-layout">
      <section className="pi-source-form"><h3>Start with your project document</h3><p>Upload a proposal, implementation plan, or project document. You can also paste a project brief describing the objectives and work.</p>
        <label className="pi-upload"><FileUp size={24}/><strong>Choose a document</strong><span>PDF, .txt or .md · up to 20 MB</span><input aria-label="Project document" type="file" accept=".pdf,.txt,.md" disabled={!!busy} onChange={e => { const file = e.target.files?.[0]; if (file) void state.upload(file); e.target.value = ''; }}/></label>
        <label>Source name<input value={state.sourceName} maxLength={255} disabled={!!busy} onChange={e => state.setSourceName(e.target.value)}/></label>
        <label>Document text or project brief<textarea value={state.source} maxLength={500000} placeholder="Describe the project objectives, activities, timeline, and Offices involved…" disabled={!!busy} onChange={e => state.setSource(e.target.value)}/></label>
      </section><aside className="pi-preview"><h3>{projectTitle}</h3><div className="pi-preview-tabs">Main table <span>Project plan</span></div>{['Preparation', 'Implementation', 'Monitoring'].map((name, i) => <div className="pi-preview-group" key={name} style={{ borderColor: ['#579bfc', '#00c875', '#a25ddc'][i] }}><strong>{name}</strong>{[0,1,2].map(j => <div className="pi-preview-row" key={j}><i/><span/><b/></div>)}</div>)}<p>Your draft will include Groups, Tasks, Subitems, timeline suggestions, and source-named Office responsibilities.</p><p>Existing project details and work are included in the AI context.</p></aside>
    </div> : <div className="pi-review-body">
      <aside id={prefix+'offices'} tabIndex={-1} className="pi-responsibilities eflow-review-target"><div className="pi-review-summary"><ReviewSectionNav selected={section} onSelect={selectSection} sections={[{id:'details',label:'Project details',detail:state.applyDetails ? 'Overwrite selected' : 'Keep current details'},{id:'offices',label:'Detected Offices',detail:`${draft.offices.length} proposals · ${summary?.unconfirmedOffices} need review`},{id:'work',label:'Groups and work',detail:`${summary?.groups} groups · ${summary?.tasks} tasks · ${summary?.subitems} subitems`},{id:'warnings',label:'Warnings',detail:`${draft.warnings.length} review notes`}]} /></div><h3>Detected Offices <span>{draft.offices.length}</span></h3><p>Confirm these project-specific responsibilities. This does not invite people or change the Office directory.</p>{!draft.offices.length && <p>No source-named Offices were verified.</p>}
        {draft.offices.map(o => <article key={o.key}><label><input type="checkbox" checked={o.confirmed} disabled={locked} onChange={e => setDraft({ ...draft, offices: draft.offices.map(x => x.key === o.key ? { ...x, confirmed: e.target.checked } : x) })}/><strong>{o.name}</strong></label><blockquote>{o.evidence}</blockquote><label>Match existing Office<select value={o.officeId} disabled={locked} onChange={e => setDraft({ ...draft, offices: draft.offices.map(x => x.key === o.key ? { ...x, officeId: e.target.value } : x) })}><option value="">Keep proposed name</option>{orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label><button disabled={locked} onClick={() => setDraft({ ...draft, offices: draft.offices.filter(x => x.key !== o.key), groups: draft.groups.map(g => ({ ...g, tasks: g.tasks.map(t => t.officeKey === o.key ? { ...t, officeKey: '' } : t) })) })}>Remove proposal</button></article>)}
        <div id={draft.warnings.length ? undefined : prefix+'warnings'} tabIndex={-1}>{!draft.warnings.length && <p>No analysis warnings were returned. Review all suggestions.</p>}{draft.warnings.length > 0 && <details id={prefix+'warnings'} tabIndex={-1} open><summary>Review notes ({draft.warnings.length})</summary>{draft.warnings.map((w, i) => <p key={i}>{w}</p>)}</details>}</div>
        <p className="pi-authority-note">Imported tasks belong to this project’s Office and start unassigned. Proposed responsibilities do not transfer authority.</p>
      </aside>
      <main id={prefix+'work'} tabIndex={-1} className="pi-draft-main eflow-review-target"><details id={prefix+'details'} tabIndex={-1} className="pi-project-details eflow-review-target" open={section==='details' ? true : undefined}><summary>Project information from the source</summary><div><label>Project name<input value={draft.project.title} maxLength={300} disabled={locked} onChange={e => setDraft({ ...draft, project: { ...draft.project, title: e.target.value } })}/></label><label>Description<textarea value={draft.project.description} rows={3} disabled={locked} maxLength={10000} onChange={e => setDraft({ ...draft, project: { ...draft.project, description: e.target.value } })}/></label><label>Objectives<textarea value={draft.project.objectives} rows={3} disabled={locked} maxLength={10000} onChange={e => setDraft({ ...draft, project: { ...draft.project, objectives: e.target.value } })}/></label><div className="pi-date-pair"><label>Project start<input type="date" value={draft.project.startDate} disabled={locked} onChange={e => setDraft({ ...draft, project: { ...draft.project, startDate: e.target.value } })}/></label><label>Project target<input type="date" value={draft.project.targetDate} disabled={locked} onChange={e => setDraft({ ...draft, project: { ...draft.project, targetDate: e.target.value } })}/></label></div><label><input type="checkbox" checked={state.applyDetails} disabled={locked} onChange={e => state.setApplyDetails(e.target.checked)}/>Use these reviewed details for the current project</label></div></details>
        {draft.groups.map(group => <section className="pi-review-group" key={group.key} style={{ borderLeftColor: group.color }}><header><input aria-label={`Group name ${group.key}`} value={group.title} maxLength={120} disabled={locked} onChange={e => setDraft({ ...draft, groups: draft.groups.map(g => g.key === group.key ? { ...g, title: e.target.value } : g) })}/><span>{group.tasks.filter(t => t.included).length} tasks</span><select aria-label={`Destination ${group.key}`} value={group.existingGroupId} disabled={locked} onChange={e => setDraft({ ...draft, groups: draft.groups.map(g => g.key === group.key ? { ...g, existingGroupId: e.target.value } : g) })}><option value="">Create new group</option>{groups.map(g => <option key={g.id} value={g.id}>Add to {g.title}</option>)}</select></header>
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
          <button className="pi-primary" disabled={!!busy || !included.length} onClick={() => { void confirmImport(); }}>{retryPending ? 'Retry same import' : 'Add to Project'}</button>
        </> : <button className="pi-primary" disabled={!!busy || state.source.trim().split(/\s+/).length < 20} onClick={() => { void state.generate(); }}>Generate draft</button>)}
      </div>
    </footer>
  </DialogContent></Dialog>;
}
