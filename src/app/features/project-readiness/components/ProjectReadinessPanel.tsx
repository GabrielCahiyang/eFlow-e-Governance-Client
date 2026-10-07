import { useConfirmation } from '../../../components/ui/useConfirmation';
import { readinessResolution, closeoutResolution, type ReadinessDestination } from '../resolution';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Skeleton } from '@vibe/core';
import * as m from 'motion/react-m';
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { completeProject, archiveCompletedProject, fetchProjectCompletionReadiness, type ProjectCompletionReadiness, type Project } from '../../projects';
import { fetchReadiness, fetchCloseoutSummary, reviewProject, activateReadyProject, publishReadyProject } from '../services/readinessService';
import { DraftPublicationAction } from './DraftPublicationAction';
import type { ProjectReadiness, CloseoutSummary, ReviewKind } from '../types';
import '../readiness.css';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { useReadinessSummaryContext } from './ProjectReadinessSummary';

export function ProjectReadinessPanel({ project, canManage, onOpenTask, onOpenOffices, onResolve, refreshKey }: {project: Project; canManage: boolean; onOpenTask: (id: string) => void; onOpenOffices?: () => void; onResolve?: (view: ReadinessDestination) => void; refreshKey?: string}) {
  const confirmation = useConfirmation();
  const updateSummary = useReadinessSummaryContext()?.update;
  const [readiness, setReadiness] = useState<ProjectReadiness | null>(null);
  const [summary, setSummary] = useState<CloseoutSummary | null>(null);
  const [completion, setCompletion] = useState<ProjectCompletionReadiness | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const requestVersion = useRef(0);
  const mutationPending = useRef(false);
  useNavigationBlocker({label:'Project closeout note',dirty:Boolean(note.trim()) && !['completed','archived'].includes(project.status),pending:busy,pendingCheck:()=>mutationPending.current,onDiscard:()=>setNote('')});
  useEffect(() => { setNote(''); setNotice(''); }, [project.id]);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const [r, s, c] = await Promise.all([fetchReadiness(project.id), fetchCloseoutSummary(project.id), canManage && project.publicationState !== 'draft' ? fetchProjectCompletionReadiness(project.id) : Promise.resolve(null)]);
      if (version !== requestVersion.current) return;
      setReadiness(r); setSummary(s); setCompletion(c); setError('');
      updateSummary?.(r);
    } catch (e) { if (version === requestVersion.current) setError(e instanceof Error ? e.message : 'Could not load project checks.'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [project.id, project.publicationState, canManage, updateSummary]);
  useEffect(() => {
    setReadiness(null); setSummary(null); setCompletion(null); setLoading(true);
    void refresh();
    const channel = supabase.channel('readiness-' + project.id).on('postgres_changes', {event:'*', schema:'public', table:'project_readiness_reviews', filter:'project_id=eq.'+project.id}, () => {void refresh();}).subscribe();
    return () => {++requestVersion.current; void supabase.removeChannel(channel);};
  }, [project.id, project.status, refreshKey, refresh]);
  const run = async (action: () => Promise<void>, message: string, review?: Parameters<typeof confirmation.confirm>[0]) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true); setError(''); setNotice('');
    try { if (review && !await confirmation.confirm(review)) return; await action(); setNotice(message); await refresh(); }
    catch (e) {await refresh(); setError(e instanceof Error ? e.message : 'This action could not finish.');}
    finally {mutationPending.current=false;setBusy(false);}
  };
  const closed = ['completed','archived'].includes(project.status);
  const draft = project.publicationState === 'draft';
  return <m.section className="p7-panel" aria-label="Project readiness and closeout" initial={{opacity:0}} animate={{opacity:1}}>
    {confirmation.dialog}<header className="p7-heading"><div><span className="p7-eyebrow">Delivery governance</span><h2><ShieldCheck size={24}/>Readiness & closeout</h2><p>Confirm the plan before activation. Material scope, Office, schedule or budget changes require another review.</p></div><Button kind="secondary" size="small" onClick={()=>void refresh()} disabled={busy || loading || error.includes('not installed yet')}>Refresh checks</Button></header>
    {error && <div role="alert" className="p7-error">{error}{error.includes('not installed yet') ? <p>Ask an administrator to install the existing readiness database update. This panel cannot install it.</p> : <p>Refresh checks to verify the current result before another action.</p>}</div>}
    {notice && <p role="status" className="p7-notice">{notice}</p>}
    {loading ? <div role="status" aria-label="Loading readiness"><Skeleton type="rectangle" size="custom" height={320} fullWidth/></div> : readiness && summary && <>
      <div className="p7-stage"><strong>{readiness.stage}</strong><span>{readiness.checks.filter(c=>c.ok).length} of {readiness.checks.length} readiness checks confirmed</span></div>
      {readiness.governed && <p className="p7-notice">This project uses the existing proposal endorsement and approval workflow. Continue its sign-offs in Approval Status. {onResolve && <button className="p7-link" onClick={()=>onResolve('signoff')}>Open Approval Status</button>}</p>}
      <div className="p7-checks">{readiness.checks.map(check=>{const resolution=readinessResolution(check.key, readiness.governed);return <article key={check.key} className={'p7-check '+(check.ok?'p7-check--done':'')}><div className="p7-check-content">{check.ok?<CheckCircle2 size={22} aria-label="Confirmed"/>:<Circle size={22} aria-label="Needs attention"/>}<div><h3>{check.label}</h3><p>{check.detail}</p></div></div>{canManage && !closed && !readiness.governed && ['structure','dates','budget'].includes(check.key) && <Button kind="secondary" size="small" disabled={busy || !!error || check.ok} onClick={()=>void run(()=>reviewProject(project.id,check.key as ReviewKind),check.label+' confirmed.')}>{check.ok?'Reviewed':'Confirm review'}</Button>}{!check.ok && resolution && (onResolve || resolution.view==='offices' && onOpenOffices) && <Button kind="secondary" size="small" onClick={()=>onResolve ? onResolve(resolution.view) : onOpenOffices?.()}>{resolution.label}</Button>}</article>;})}</div>
      {draft && !closed && !readiness.governed && <DraftPublicationAction readiness={readiness} busy={busy||!!error} onPublish={()=>void run(async()=>{const current=await fetchReadiness(project.id);if(!current.canActivate||!current.canPublish)throw new Error('Required details or reviews changed. Resolve the current blockers before publishing.');await publishReadyProject(project.id);},'Project published. It is now in Open Projects.',{title:'Publish this project?',description:`Publish “${project.title}” and make it available for delivery? The server will recheck all required details and Head permissions.`,actionLabel:'Publish project'})}/>}
      {canManage && !draft && !closed && !readiness.governed && <div className="p7-actions"><p>Confirm structure in Main table, responsibilities in Offices, dates in Gantt, and estimates in Budget Overview. {!readiness.canActivate && <span>{project.status==='active' ? 'The project is already active.' : 'Activation is unavailable until every current check is confirmed.'}</span>}</p><Button disabled={busy || !!error || !readiness.canActivate} onClick={()=>void run(async()=>{const current=await fetchReadiness(project.id);if(!current.canActivate || current.governed)throw new Error('Readiness changed. Review the current blockers before activation.');await activateReadyProject(project.id);},'Project activated. All current readiness checks passed.',{title:'Activate this project?',description:`Activate “${project.title}” for delivery. The server rechecks current reviews, Office participation, schedule and required owners.`,actionLabel:'Activate project',impact:<p>{readiness.checks.filter(check=>check.ok).length} of {readiness.checks.length} current checks confirmed. AI cannot activate the project.</p>})}>{project.status==='active'?'Project active':'Activate project'}</Button></div>}
      <div className="p7-closeout"><h3>Closeout summary</h3><div className="p7-stats">{[['Completed tasks',`${summary.completed} / ${summary.tasks-summary.cancelled}`],['Joined Offices',summary.offices],['Approved submissions',summary.evidence],['Contributors',summary.contributors],['Estimated budget',summary.budgetEstimate.toLocaleString()],['Open cash requests',summary.financial.open]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><p>Timeline: {summary.startDate || 'Not set'} → {summary.targetDate || 'Not set'}. Requested: {summary.financial.requested.toLocaleString()}; approved: {summary.financial.approved.toLocaleString()}; settled requests: {summary.financial.settled}. Estimates are separate from approved funds.</p></div>
      {completion && !draft && !closed && <div className="p7-completion"><h3>{completion.canComplete?'Ready for Head closeout':'Closeout blockers'}</h3>{completion.blockers.length>0?<ul>{completion.blockers.map((b,i)=>{const resolution=closeoutResolution(b.kind);return <li key={b.kind+b.id+i}><strong>{b.title}</strong><p>{b.detail}</p>{b.taskId && <button className="p7-link" onClick={()=>onOpenTask(b.taskId!)}>Open task</button>}{!b.taskId && resolution && onResolve && <button className="p7-link" onClick={()=>onResolve(resolution.view)}>{resolution.label}</button>}</li>;})}</ul>:<p>Required work, approved submissions, governance and financial settlement checks have passed.</p>}<label>Closeout note<textarea value={note} disabled={busy} onChange={e=>setNote(e.target.value)} placeholder="Record the delivered outcome and any handover notes." rows={3} maxLength={4000}/></label><Button disabled={busy || !!error || !completion.canComplete || !note.trim()} onClick={()=>void run(async()=>{const current=await fetchProjectCompletionReadiness(project.id);if(!current.canComplete)throw new Error('Closeout blockers changed. Resolve them before closing the project.');await completeProject(project.id,note);setNote('');},'Project closed with an audit record.',{title:'Close this project?',description:`Close “${project.title}” with an audit record. Work, evidence, governance and financial settlement are rechecked by the server.`,actionLabel:'Close project',danger:true,impact:<p>Closeout note: {note}</p>})}>Close project</Button><p>{!completion.canComplete ? 'Resolve all official closeout blockers first.' : !note.trim() ? 'Enter a closeout note before closing the project.' : 'The Head confirms closeout after all required checks pass.'}</p></div>}
      {canManage && project.status==='completed' && <div className="p7-actions"><p>This project is closed. Archive it when the handover is complete.</p><Button kind="secondary" disabled={busy} onClick={()=>void run(()=>archiveCompletedProject(project.id,'Phase 7 closeout'),'Project archived.',{title:'Archive completed project?',description:`Archive “${project.title}” after handover. Its existing record and history remain accessible.`,actionLabel:'Archive project',danger:true})}>Archive project</Button></div>}
    </>}
  </m.section>;
}
