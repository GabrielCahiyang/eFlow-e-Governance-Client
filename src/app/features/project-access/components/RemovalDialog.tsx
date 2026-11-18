import {useEffect,useRef,useState} from 'react';
import {FeatureDialog} from '../../../components/ui/FeatureDialog';
import {useNavigationBlocker} from '../../../shared/navigationGuard';
import {previewRemoval,removePerson} from '../services/accessService';
import type {RemovalImpact} from '../types';
import '../projectAccess.css';
type RemovalProps={project:string;user:string;office?:string|null;name:string;onClose:()=>void;onRemoved:()=>void|Promise<void>};
export function RemovalDialog(props:RemovalProps){return <RemovalReview key={`${props.project}:${props.user}:${props.office||''}`} {...props}/>;}
function RemovalReview({project,user,office,name,onClose,onRemoved}:RemovalProps){
 const [impact,setImpact]=useState<RemovalImpact>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[revision,setRevision]=useState(0);
 const request=useRef<string | undefined>(undefined),pending=useRef(false),generation=useRef(0);
 useEffect(()=>{const token=++generation.current;setImpact(undefined);setError('');void previewRemoval(project,user,office).then(data=>{if(token===generation.current)setImpact(data);}).catch(reason=>{if(token===generation.current)setError((reason as Error).message);});return()=>{generation.current++;};},[project,user,office,revision]);
 useNavigationBlocker({label:'Removing project member',dirty:false,pending:busy,onDiscard:()=>{}});
 async function confirm(){if(!impact||pending.current||saved)return;pending.current=true;setBusy(true);setError('');request.current??=crypto.randomUUID();try{await removePerson(impact,request.current);setSaved(true);try{await onRemoved();}catch{setError('Removal saved. Refresh failed; close and reload Members.');}}catch(reason){setError((reason as Error).message);}finally{pending.current=false;setBusy(false);}}
 return <FeatureDialog title={`Review removal · ${name}`} preventClose={busy} onClose={()=>{if(!busy)onClose();}} contentClassName="r9-dialog"><h2>Remove {name} from this project?</h2><p>Removing this member unassigns their tasks and all affected subtasks, clears their Lead roles and related delegations, and ends this membership, related project permissions and pending invitations. Reassign any unfinished work. Previous progress, evidence and authorship remain in the project history.</p><p>This does not change their other projects, account role or Office membership. Previously issued private file links may work until they expire.</p>
 {!impact&&!error&&<p role="status" className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3.5 py-2.5 text-[13px]">Loading all affected work…</p>}
 {impact&&<div className="space-y-3">
  <div className="grid grid-cols-2 gap-2.5">
   <div className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3.5 py-2.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--eflow-text-muted)]">Tasks affected</span>
    <p className="mt-1 mb-0 text-[18px] font-bold text-[var(--eflow-text)]">{impact.tasks.length}</p>
   </div>
   <div className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3.5 py-2.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--eflow-text-muted)]">Subtasks affected</span>
    <p className="mt-1 mb-0 text-[18px] font-bold text-[var(--eflow-text)]">{impact.nodes.length}</p>
   </div>
  </div>
  <p className="sr-only">{impact.tasks.length} tasks · {impact.nodes.length} subtasks affected across this project.</p>
  {(impact.tasks.length>0||impact.nodes.length>0)?<ul className="m-0 max-h-56 list-none space-y-1.5 overflow-y-auto p-0">
   {impact.tasks.map(t=><li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 py-2 text-[13px]">
    <span className="font-medium text-[var(--eflow-text)]">{t.title}</span>
    <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
     <span className="rounded-full border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-2 py-0.5 font-medium text-[var(--eflow-text-secondary)]">{t.status.replace(/_/g,' ')}</span>
     <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Task / Lead / reviewer assignment</span>
    </span>
   </li>)}
   {impact.nodes.map(n=><li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 py-2 text-[13px]">
    <span className="font-medium text-[var(--eflow-text)]">{n.title}</span>
    <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
     <span className="rounded-full border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-2 py-0.5 font-medium text-[var(--eflow-text-secondary)]">{n.status.replace(/_/g,' ')}</span>
     <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Subtask team assignments / delegation</span>
    </span>
   </li>)}
  </ul>:<p className="rounded-xl border border-dashed border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3.5 py-3 text-[13px]">No current work assignments. The applicable project access will end.</p>}
 </div>}
 {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-800">{error}</p>}{saved&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">Removal saved. Affected unfinished work requires reassignment.</p>}
 <footer><button type="button" disabled={busy} onClick={onClose}>{saved?'Done':'Cancel removal'}</button>{!saved&&<><button type="button" disabled={busy} onClick={()=>{request.current=undefined;setRevision(x=>x+1);}}>Refresh impact preview</button><button type="button" className="r9-danger" disabled={busy||!impact} onClick={()=>void confirm()}>{busy?'Removing…':'Confirm removal and unassign work'}</button></>}</footer></FeatureDialog>;
}
