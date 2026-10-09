import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { supabase } from '../../../../lib/supabase';
import type { Project } from '../../projects';
import { fetchReadiness, reviewProject, activateReadyProject } from '../services/readinessService';
import { readinessResolution, type ReadinessDestination } from '../resolution';
import type { ProjectReadiness, ReviewKind } from '../types';
import '../readiness.css';

/** Required reviews and activation, embedded in the retained Head completion workflow. */
export function ProjectReadinessPanel({ project, canManage, onResolve, refreshKey = '', onUpdated }: {
 project: Project; canManage: boolean; onResolve?: (view: ReadinessDestination) => void; refreshKey?: string; onUpdated?: () => void;
}) {
 const confirmation = useConfirmation();
 const [state, setState] = useState<{key:string; data?:ProjectReadiness; error?:string}>({key:''});
 const [busy,setBusy] = useState(false), [notice,setNotice] = useState('');
 const version = useRef(0), pending = useRef(false);
 const key = `${project.id}:${project.updatedAt}:${project.status}:${refreshKey}`;
 const closed = ['completed','archived'].includes(project.status);
 useNavigationBlocker({label:'Project readiness review',dirty:false,pending:busy,pendingCheck:()=>pending.current,onDiscard:()=>{}});
 const refresh = useCallback(async () => {
  const request = ++version.current; setState({key});
  try {
   const data = await fetchReadiness(project.id);
   if (request !== version.current) return;
   if(data.projectId !== project.id || !Array.isArray(data.checks)) throw new Error('Invalid project readiness response.');
   setState({key,data});
  } catch(error) { if(request===version.current)setState({key,error:error instanceof Error?error.message:'Could not load readiness reviews.'}); }
 },[project.id,key]);
 useEffect(()=>{
  void refresh();
  const channel = supabase.channel('readiness-'+project.id).on('postgres_changes',{event:'*',schema:'public',table:'project_readiness_reviews',filter:'project_id=eq.'+project.id},()=>{void refresh();onUpdated?.();}).subscribe();
  return()=>{++version.current;void supabase.removeChannel(channel);};
 },[refresh,project.id]);
 const current = state.key===key ? state : {key};
 const data = current.data;
 const run = async (action:()=>Promise<void | false>,message:string) => {
  if(pending.current || !canManage || closed || !data || current.error)return;
  pending.current=true;setBusy(true);setNotice('');
  try {if(await action()===false)return;setNotice(message);await refresh();onUpdated?.();}
  catch(error){await refresh();setState(previous=>({...previous,error:error instanceof Error?error.message:'Review failed. Refresh before retrying.'}));}
  finally{pending.current=false;setBusy(false);}
 };
 return <section className="r4-requirements" aria-label="Project readiness reviews">
  {confirmation.dialog}<header><h3>Plan reviews and activation</h3><Button type="button" variant="outline" disabled={busy} onClick={()=>void refresh()}>Refresh plan reviews</Button></header>
  <p>Material scope, Office, schedule or budget changes require a current review.</p>
  {current.error && <FeedbackState tone="error" title="Plan reviews unavailable">{current.error}</FeedbackState>}
  {!data && !current.error && <p role="status">Loading plan reviews…</p>}
  {notice && <p role="status">{notice}</p>}
  {data && <>
   <p>{data.stage} · {data.checks.filter(check=>check.ok).length} of {data.checks.length} checks confirmed</p>
   {data.governed && <p>Proposal endorsement and approval remain in Proposal Context. {onResolve && <button type="button" className="p7-link" onClick={()=>onResolve('proposal_context')}>Open proposal review</button>}</p>}
   <ul>{data.checks.map(check=>{const resolution=readinessResolution(check.key,data.governed);return <li key={check.key}>
    <strong>{check.label} · {check.ok?'Confirmed':'Needs attention'}</strong><p>{check.detail}</p>
    <div>{canManage && !closed && !data.governed && ['structure','dates','budget'].includes(check.key) && <Button type="button" variant="outline" disabled={busy||Boolean(current.error)||check.ok} onClick={()=>void run(()=>reviewProject(project.id,check.key as ReviewKind),check.label+' confirmed.')}>{check.ok?'Reviewed':'Confirm review'}</Button>}
     {!check.ok && resolution && onResolve && <Button type="button" variant="ghost" disabled={busy} onClick={()=>onResolve(resolution.view)}>{resolution.label}</Button>}</div>
   </li>;})}</ul>
   {canManage && !closed && !data.governed && <Button type="button" disabled={busy||Boolean(current.error)||!data.canActivate} onClick={()=>void run(async()=>{
    if(!await confirmation.confirm({title:'Activate this project?',description:`Activate “${project.title}” for delivery. Current reviews, Office participation, schedule and owners are rechecked by the server.`,actionLabel:'Activate project'}))return false;
    const current=await fetchReadiness(project.id);if(!current.canActivate||current.governed)throw new Error('Readiness changed. Review the current checks before activation.');await activateReadyProject(project.id);
   },'Project activated.')}>{project.status==='active'?'Project active':'Activate project'}</Button>}
  </>}
 </section>;
}
