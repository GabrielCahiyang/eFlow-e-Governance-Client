import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, RefreshCw, Rocket } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { subscribeProjectChecks } from '../services/readinessSubscription';
import type { Project } from '../../projects';
import { fetchReadiness, reviewProject, activateReadyProject } from '../services/readinessService';
import { readinessResolution, type ReadinessDestination } from '../resolution';
import type { ProjectReadiness, ReviewKind } from '../types';
import { ReadinessCheckList } from './ReadinessCheckList';
import { SetupReadinessChecks } from './SetupReadinessChecks';
import '../readiness.css';
import '../setupReadiness.css';

/** Required reviews and activation, embedded in the retained Head completion workflow. */
export function ProjectReadinessPanel({ project, canManage, onResolve, refreshKey = '', onUpdated, setup, footerTarget, shortcuts, onClose, onBusyChange }: {
 project: Project; canManage: boolean; onResolve?: (view: ReadinessDestination) => void; refreshKey?: string; onUpdated?: () => void;
 setup?:boolean; footerTarget?:HTMLElement|null; shortcuts?:ReactNode; onClose?:()=>void; onBusyChange?:(busy:boolean)=>void;
}) {
 const confirmation = useConfirmation();
 const [state, setState] = useState<{key:string; data?:ProjectReadiness; error?:string; loading?:boolean}>({key:''});
 const [busy,setBusy] = useState(false), [notice,setNotice] = useState('');
 const version = useRef(0), pending = useRef(false);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 const key = `${project.id}:${project.updatedAt}:${project.status}:${refreshKey}`;
 const closed = ['completed','archived'].includes(project.status);
 useNavigationBlocker({label:'Project readiness review',dirty:false,pending:busy,pendingCheck:()=>pending.current,onDiscard:()=>{}});
 const refresh = useCallback(async () => {
  const request = ++version.current; setState(previous=>({key,loading:true,data:previous.key===key?previous.data:undefined}));
  try {
   const data = await fetchReadiness(project.id);
   if (request !== version.current) return;
   if(data.projectId !== project.id || !Array.isArray(data.checks)) throw new Error('Invalid project readiness response.');
   setState({key,data});
  } catch(error) { if(request===version.current)setState({key,error:error instanceof Error?error.message:'Could not load readiness reviews.'}); }
 },[project.id,key]);
 useEffect(()=>{
  void refresh();
  return()=>{++version.current;};
 },[refresh]);
 const latest = useRef({refresh,onUpdated});
 latest.current = {refresh,onUpdated};
 useEffect(()=>subscribeProjectChecks(project.id,()=>{
  void latest.current.refresh(); latest.current.onUpdated?.();
 }),[project.id]);
 const current = state.key===key ? state : {key,loading:true};
 const data = current.data;
 const checking = Boolean(current.loading || (!data && !current.error));
 const automaticStatus = <span className="readiness-auto-status" role="status"><RefreshCw size={14} aria-hidden="true" className={checking?'animate-spin':undefined}/>{checking?'Updating checks…':'Updates automatically'}</span>;
 const run = async (action:()=>Promise<void | false>,message:string) => {
  if(pending.current || checking || !canManage || closed || !data || current.error)return;
  pending.current=true;setBusy(true);setNotice('');
  try {if(await action()===false)return;setNotice(message);await refresh();onUpdated?.();}
  catch(error){await refresh();setState(previous=>({...previous,error:error instanceof Error?error.message:'Review failed. Check the current status before trying again.'}));}
  finally{pending.current=false;setBusy(false);}
 };
 const activate=()=>void run(async()=>{
  if(!await confirmation.confirm({title:'Activate this project?',description:`Activate “${project.title}” for delivery. Current reviews, Office participation, schedule and owners are rechecked by the server.`,actionLabel:'Activate project'}))return false;
  const current=await fetchReadiness(project.id);if(!current.canActivate||current.governed)throw new Error('Readiness changed. Review the current checks before activation.');await activateReadyProject(project.id);
 },'Project activated.');
 const mayActivate=canManage&&!closed&&project.status!=='active'&&!data?.governed;
 if(setup){
  const confirmed=data?.checks.filter(check=>check.ok).length||0,total=data?.checks.length||0,remaining=total-confirmed;
  const footer=<div className="setup-readiness__footer"><p>{!data?'Checking project readiness…':current.error?'Readiness checks are unavailable.':data.governed?'Continue through proposal review.':data.canActivate?'Everything is ready. Activate to start delivery.':`${remaining} check${remaining===1?'':'s'} to finish before activation.`}</p><div className="setup-readiness__footer-actions">
   {onClose&&<Button variant="outline" disabled={busy} onClick={onClose}>Done for now</Button>}
   {mayActivate&&<Button disabled={busy||checking||!!current.error||!data?.canActivate} onClick={activate}><Rocket size={16} aria-hidden="true"/>{busy?'Updating…':'Activate project'}</Button>}
  </div></div>;
  return <section className="setup-readiness" aria-label="Project readiness reviews" aria-busy={busy||!data}>
   {confirmation.dialog}<header className="setup-readiness__summary"><div className="setup-readiness__ring"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30"/><circle cx="36" cy="36" r="30" pathLength="100" strokeDasharray={`${total?confirmed/total*100:0} 100`}/></svg><strong>{confirmed}<span className="sr-only"> of </span><span aria-hidden="true">/</span>{total||'–'}</strong></div>
    <div className="setup-readiness__summary-copy"><h3>{data?.canActivate?'Ready for delivery':'Get your project ready'}</h3><p>{total?`${confirmed} of ${total} checks confirmed`:'Checking your work plan…'}</p></div>
    {automaticStatus}
   </header>
   {shortcuts&&<nav className="setup-readiness__tools" aria-label="Project setup shortcuts">{shortcuts}</nav>}
   {current.error&&<FeedbackState tone="error" title="Plan reviews unavailable" onRetry={()=>void refresh()}>{current.error}</FeedbackState>}
   {!data&&!current.error&&<p className="setup-readiness__feedback" role="status">Loading plan reviews…</p>}
   {notice&&<p className="setup-readiness__feedback" role="status">{notice}</p>}
   {data?.governed&&<p className="setup-readiness__governed">Proposal endorsement and approval remain in Proposal Context. {onResolve&&<button className="p7-link" onClick={()=>onResolve('proposal_context')}>Open proposal review</button>}</p>}
   {data&&<SetupReadinessChecks checks={data.checks} actions={check=>{const resolution=readinessResolution(check.key,data.governed),review=['structure','dates','budget'].includes(check.key)&&canManage&&!closed&&!data.governed;
    return <>{resolution&&onResolve&&<Button variant="ghost" disabled={busy} aria-label={resolution.label} onClick={()=>onResolve(resolution.view)}>Review<ArrowRight size={14} aria-hidden="true"/></Button>}
     {review&&<Button variant="outline" disabled={busy||checking||!!current.error} aria-label={`Confirm review: ${check.label}`} onClick={()=>void run(()=>reviewProject(project.id,check.key as ReviewKind),check.label+' confirmed.')}><Check size={14} aria-hidden="true"/>Confirm</Button>}</>;
   }}/>}
   {footerTarget?createPortal(footer,footerTarget):footer}
  </section>;
 }
 return <section className="r4-requirements" aria-label="Project readiness reviews">
  {confirmation.dialog}<header><h3>Plan reviews and activation</h3>{automaticStatus}</header>
  <p>Material scope, Office, schedule or budget changes require a current review.</p>
  {current.error && <FeedbackState tone="error" title="Plan reviews unavailable" onRetry={()=>void refresh()}>{current.error}</FeedbackState>}
  {!data && !current.error && <p role="status">Loading plan reviews…</p>}
  {notice && <p role="status">{notice}</p>}
  {data && <>
   <p>{data.stage} · {data.checks.filter(check=>check.ok).length} of {data.checks.length} checks confirmed</p>
   {data.governed && <p>Proposal endorsement and approval remain in Proposal Context. {onResolve && <button type="button" className="p7-link" onClick={()=>onResolve('proposal_context')}>Open proposal review</button>}</p>}
   <ReadinessCheckList checks={data.checks} actions={check=>{const resolution=readinessResolution(check.key,data.governed);return <div className="flex flex-wrap gap-2">{canManage && !closed && !data.governed && !check.ok && ['structure','dates','budget'].includes(check.key) && <Button type="button" variant="outline" disabled={busy||checking||Boolean(current.error)} onClick={()=>void run(()=>reviewProject(project.id,check.key as ReviewKind),check.label+' confirmed.')}>Confirm review</Button>}
     {!check.ok && resolution && onResolve && <Button type="button" variant="ghost" disabled={busy} onClick={()=>onResolve(resolution.view)}>{resolution.label}</Button>}</div>
   ;}} />
   {mayActivate && <footer className="readiness-activation"><Button type="button" disabled={busy||checking||Boolean(current.error)||!data.canActivate} onClick={activate}><Rocket size={15} aria-hidden="true"/>Activate project</Button></footer>}
  </>}
 </section>;
}
