import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Skeleton } from '@vibe/core';
import * as m from 'motion/react-m';
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { completeProject, archiveCompletedProject, fetchProjectCompletionReadiness, type ProjectCompletionReadiness, type Project } from '../../projects';
import { fetchReadiness, fetchCloseoutSummary, reviewProject, activateReadyProject } from '../services/readinessService';
import type { ProjectReadiness, CloseoutSummary, ReviewKind } from '../types';
import '../readiness.css';

export function ProjectReadinessPanel({ project, canManage, onOpenTask }: {project: Project; canManage: boolean; onOpenTask: (id: string) => void}) {
  const [readiness, setReadiness] = useState<ProjectReadiness | null>(null);
  const [summary, setSummary] = useState<CloseoutSummary | null>(null);
  const [completion, setCompletion] = useState<ProjectCompletionReadiness | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const [r, s, c] = await Promise.all([fetchReadiness(project.id), fetchCloseoutSummary(project.id), canManage ? fetchProjectCompletionReadiness(project.id) : Promise.resolve(null)]);
      if (version !== requestVersion.current) return;
      setReadiness(r); setSummary(s); setCompletion(c); setError('');
    } catch (e) { if (version === requestVersion.current) setError(e instanceof Error ? e.message : 'Could not load project checks.'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [project.id, canManage]);
  useEffect(() => {
    setReadiness(null); setSummary(null); setCompletion(null); setLoading(true); setNotice('');
    void refresh();
    const channel = supabase.channel('readiness-' + project.id).on('postgres_changes', {event:'*', schema:'public', table:'project_readiness_reviews', filter:'project_id=eq.'+project.id}, () => {void refresh();}).subscribe();
    return () => {++requestVersion.current; void supabase.removeChannel(channel);};
  }, [project.id, project.status, refresh]);
  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); setNotice(message); }
    catch (e) {await refresh(); setError(e instanceof Error ? e.message : 'This action could not finish.');}
    finally {setBusy(false);}
  };
  const closed = ['completed','archived'].includes(project.status);
  return <m.section className="p7-panel" aria-label="Project readiness and closeout" initial={{opacity:0}} animate={{opacity:1}}>
    <header className="p7-heading"><div><span className="p7-eyebrow">Delivery governance</span><h2><ShieldCheck size={24}/>Readiness & closeout</h2><p>Confirm the plan before activation. Material scope, Office, schedule or budget changes require another review.</p></div><Button kind="secondary" size="small" onClick={()=>void refresh()} disabled={busy || loading}>Refresh checks</Button></header>
    {error && <div role="alert" className="p7-error">{error}</div>}
    {notice && <p role="status" className="p7-notice">{notice}</p>}
    {loading ? <div role="status" aria-label="Loading readiness"><Skeleton type="rectangle" size="custom" height={320} fullWidth/></div> : readiness && summary && <>
      <div className="p7-stage"><strong>{readiness.stage}</strong><span>{readiness.checks.filter(c=>c.ok).length} of {readiness.checks.length} readiness checks confirmed</span></div>
      {readiness.governed && <p className="p7-notice">This project uses the existing proposal endorsement and approval workflow. Continue its sign-offs in Approval Status.</p>}
      <div className="p7-checks">{readiness.checks.map(check=><article key={check.key} className={'p7-check '+(check.ok?'p7-check--done':'')}><div className="p7-check-content">{check.ok?<CheckCircle2 size={22} aria-label="Confirmed"/>:<Circle size={22} aria-label="Needs attention"/>}<div><h3>{check.label}</h3><p>{check.detail}</p></div></div>{canManage && !closed && !readiness.governed && ['structure','dates','budget'].includes(check.key) && <Button kind="secondary" size="small" disabled={busy || check.ok} onClick={()=>void run(()=>reviewProject(project.id,check.key as ReviewKind),check.label+' confirmed.')}>{check.ok?'Reviewed':'Confirm review'}</Button>}</article>)}</div>
      {canManage && !closed && !readiness.governed && <div className="p7-actions"><p>Confirm structure in Main table, responsibilities in Offices, dates in Timeline, and estimates in Budget Overview.</p><Button disabled={busy || !readiness.canActivate} onClick={()=>void run(()=>activateReadyProject(project.id),'Project activated. All current readiness checks passed.')}>{project.status==='active'?'Project active':'Activate project'}</Button></div>}
      <div className="p7-closeout"><h3>Closeout summary</h3><div className="p7-stats">{[['Completed tasks',`${summary.completed} / ${summary.tasks-summary.cancelled}`],['Joined Offices',summary.offices],['Approved submissions',summary.evidence],['Contributors',summary.contributors],['Estimated budget',summary.budgetEstimate.toLocaleString()],['Open cash requests',summary.financial.open]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><p>Timeline: {summary.startDate || 'Not set'} → {summary.targetDate || 'Not set'}. Requested: {summary.financial.requested.toLocaleString()}; approved: {summary.financial.approved.toLocaleString()}; settled requests: {summary.financial.settled}. Estimates are separate from approved funds.</p></div>
      {completion && !closed && <div className="p7-completion"><h3>{completion.canComplete?'Ready for Head closeout':'Closeout blockers'}</h3>{completion.blockers.length>0?<ul>{completion.blockers.map((b,i)=><li key={b.kind+b.id+i}><strong>{b.title}</strong><p>{b.detail}</p>{b.taskId && <button className="p7-link" onClick={()=>onOpenTask(b.taskId!)}>Open task</button>}</li>)}</ul>:<p>Required work, approved submissions, governance and financial settlement checks have passed.</p>}<label>Closeout note<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Record the delivered outcome and any handover notes." rows={3} maxLength={4000}/></label><Button disabled={busy || !completion.canComplete || !note.trim()} onClick={()=>void run(()=>completeProject(project.id,note),'Project closed with an audit record.')}>Close project</Button></div>}
      {canManage && project.status==='completed' && <div className="p7-actions"><p>This project is closed. Archive it when the handover is complete.</p><Button kind="secondary" disabled={busy} onClick={()=>void run(()=>archiveCompletedProject(project.id,'Phase 7 closeout'),'Project archived.')}>Archive project</Button></div>}
    </>}
  </m.section>;
}
