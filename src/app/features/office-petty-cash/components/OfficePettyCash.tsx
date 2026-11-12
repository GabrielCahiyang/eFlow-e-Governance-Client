import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {Banknote,Plus,RefreshCw} from 'lucide-react';
import {useAuth} from '../../../contexts/AuthContext';
import {useToast} from '../../../components/ui/Toast';
import {Modal} from '../../../components/ui/Modal';
import {EmptyState} from '../../../components/ui/EmptyState';
import {StatusPill} from '../../../components/ui/workspace/StatusPill';
import {OfficeCashDialog,actionLabels} from './OfficeCashDialog';
import {commandOfficeCash,loadOfficeCash,openOfficeReceipt} from '../services/officeCash';
import type {OfficeCashCommand,OfficeCashRequest,OfficeCashSnapshot,PettyAction} from '../types';
import '../officePettyCash.css';
const peso=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'});
const requestColumns = ['Purpose / requester', 'Amount', 'Status', 'Receipts', 'Actions'];
const statusTone = {
  pending: 'warning', approved: 'positive', released: 'info', receipt_review: 'warning',
  receipt_approved: 'info', settled: 'positive', rejected: 'negative',
} as const;
export function OfficePettyCash({focusRequestId}:{focusRequestId?:string}={}){
 const {userProfile}=useAuth();const office=userProfile?.org_id||'';const actor=userProfile?.id||'';
 return <ScopedOfficeCash key={`${office}:${actor}`} office={office} actor={actor} role={userProfile?.role||''} focusRequestId={focusRequestId}/>;
}
function ScopedOfficeCash({office,actor,role,focusRequestId}:{office:string;actor:string;role:string;focusRequestId?:string}){
 const requestsHeading = useId();
 const [snapshot,setSnapshot]=useState<OfficeCashSnapshot|null>(null),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[busy,setBusy]=useState(false),[edit,setEdit]=useState<{action:PettyAction;request?:OfficeCashRequest}|null>(null);
 const {toast}=useToast();
 const storageKey=`eflow.office-petty.pending:${office}:${actor}`;
 const [pending,setPending]=useState<OfficeCashCommand|null>(()=>{try{return JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{return null;}});
 const active=useRef(true),saving=useRef(false);const accountant=role==='accounting_staff',head=role==='head';
 const reload=useCallback(async()=>{try{const next=await loadOfficeCash(office);if(active.current){setSnapshot(next);setError('');}}catch(reason){if(active.current)setError((reason as Error).message);}},[office]);
 useEffect(()=>{active.current=true;if(office)void reload();const update=()=>{if(!saving.current&&document.visibilityState==='visible')void reload();};const timer=window.setInterval(update,10000);window.addEventListener('focus',update);window.addEventListener('eflow:office-petty',update);return()=>{active.current=false;window.clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('eflow:office-petty',update);};},[reload,office]);
 useEffect(()=>{if(pending&&!edit)setEdit({action:pending.action,request:snapshot?.requests.find(r=>r.id===pending.data.request)});},[pending,snapshot,edit]);
 const focused=useRef<string|undefined>(undefined);
 useEffect(()=>{
  if(!focusRequestId||focused.current===focusRequestId||!snapshot)return;
  const row=document.getElementById('office-petty-cash-'+focusRequestId);
  if(row){focused.current=focusRequestId;row.focus();}
 },[focusRequestId,snapshot]);
 async function submit(command:OfficeCashCommand){
  if(saving.current)return;saving.current=true;setBusy(true);setActionError('');
  try{sessionStorage.setItem(storageKey,JSON.stringify(command));setPending(command);await commandOfficeCash(office,command);sessionStorage.removeItem(storageKey);setPending(null);setEdit(null);toast(`${actionLabels[command.action]} saved.`,['reject','return_receipts'].includes(command.action)?'warning':'success');await reload();window.dispatchEvent(new Event('eflow:office-petty'));}
  catch(reason){const problem=reason as Error&{definite?:boolean};setActionError(problem.message);if(problem.definite){sessionStorage.removeItem(storageKey);setPending(null);}}
  finally{saving.current=false;setBusy(false);}
 }
 const start=(action:PettyAction,request?:OfficeCashRequest)=>{setActionError('');setEdit({action,request});};
 const button=(action:PettyAction,r:OfficeCashRequest)=><button key={action} disabled={!!error||busy||!!pending} onClick={()=>start(action,r)}>{actionLabels[action]}</button>;
 if(!office)return <p className="opc-error">Active office membership is required.</p>;
 return <section className="opc"><header><div><h2><Banknote size={18}/>Office Petty Cash</h2><p>₱30,000 starting fund · ₱5,000 per receipt. Available to your office’s projects and tasks.</p></div><div className="opc-actions"><button className="opc-primary" disabled={!snapshot||!!error||busy||!!pending} onClick={()=>start('request')}><Plus size={16}/>Request petty cash</button>{accountant&&<button disabled={!snapshot||!!error||busy||!!pending||snapshot.replenishable<=0} onClick={()=>start('replenish')}><RefreshCw size={16}/>Replenish fund</button>}</div></header>
 {error&&<div className="opc-error" role="alert">{error}</div>}
 {!snapshot&&!error&&(
  <div role="status" aria-live="polite" aria-label="Loading office petty cash…">
   <span className="sr-only">Loading office petty cash…</span>
   <div className="opc-metrics" aria-hidden="true">
    {['Available','Pending requests','Unsettled cash'].map(label=>(
     <div key={label}>
      <span>{label}</span>
      <strong><span className="inline-block h-6 w-24 animate-pulse rounded-md bg-neutral-200/80 align-middle"/></strong>
     </div>
    ))}
   </div>
   <div className="opc-scroll" aria-hidden="true">
    <table>
     <thead><tr>{requestColumns.map(label=><th key={label}>{label}</th>)}</tr></thead>
     <tbody>
      {[0,1,2].map(row=>(
       <tr key={row}>
        <td><div className="h-3.5 w-44 animate-pulse rounded bg-neutral-200/80"/><div className="mt-1.5 h-2.5 w-28 animate-pulse rounded bg-neutral-100"/></td>
        <td><div className="h-3.5 w-20 animate-pulse rounded bg-neutral-200/80"/></td>
        <td><div className="h-5 w-20 animate-pulse rounded-full bg-neutral-200/70"/></td>
        <td><div className="h-6 w-24 animate-pulse rounded bg-neutral-100"/></td>
        <td><div className="h-7 w-20 animate-pulse rounded bg-neutral-100"/></td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  </div>
 )}
 {snapshot&&<><div className="opc-metrics">{[['Available',snapshot.available],['Pending requests',snapshot.reserved],['Unsettled cash',snapshot.outstanding]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{peso.format(Number(value))}</strong></div>)}</div>
 {snapshot.available<=0&&<p className="opc-note" role="status">The available petty cash has been used or reserved. Cancel an unused request or ask Accounting to replenish settled expenses.</p>}
 <section className="opc-records" aria-labelledby={requestsHeading}>
  <h3 id={requestsHeading}>Petty cash requests</h3>
  {!snapshot.requests.length ? <EmptyState size="compact" illustration="budget" title="No office petty cash requests yet." /> :
   <div className="opc-scroll" role="region" aria-label="Petty cash request records" tabIndex={0}>
    <table>
     <thead><tr>{requestColumns.map(label=><th key={label} scope="col" className={label==='Amount'?'opc-amount':undefined}>{label}</th>)}</tr></thead>
     <tbody>{snapshot.requests.map(r=><tr key={r.id} id={'office-petty-cash-'+r.id} tabIndex={-1}>
      <td><strong>{r.purpose}</strong><small>{r.requesterName}</small></td>
      <td className="opc-amount">{peso.format(r.amount)}</td>
      <td><span className="opc-status"><StatusPill label={r.status.replace(/_/g,' ')} tone={statusTone[r.status as keyof typeof statusTone]} /></span></td>
      <td><div className="opc-row-actions">{r.receipts.map((receipt,i)=><button key={receipt.path} onClick={()=>void openOfficeReceipt(receipt.path).catch(reason=>setError((reason as Error).message))}>Receipt {i+1} · {peso.format(receipt.amount)}</button>)}</div></td>
      <td>
       <div className="opc-row-actions">
        {actor===r.requester&&['pending','approved'].includes(r.status)&&button('cancel',r)}
        {head&&actor!==r.requester&&r.status==='pending'&&['approve','reject'].map(a=>button(a as PettyAction,r))}
        {accountant&&r.status==='approved'&&button('release',r)}
        {actor===r.requester&&r.status==='released'&&button('receipts',r)}
        {head&&actor!==r.requester&&r.status==='receipt_review'&&['endorse','return_receipts'].map(a=>button(a as PettyAction,r))}
        {accountant&&actor!==r.requester&&r.status==='receipt_approved'&&r.canSettle!==false&&button('settle',r)}
       </div>
       {r.status==='receipt_approved'&&(r.settlementBlocked||accountant&&(actor===r.requester||r.canSettle===false))&&<small>{r.settlementBlocked?(r.headNotified?'Escalated to the Head. An independent Accounting Officer is needed.':'An independent Accounting Officer is needed.'):'An independent Accounting Officer must settle this request.'}{actor===r.requester&&' You can’t settle your own request.'}</small>}
      </td>
     </tr>)}</tbody>
    </table>
   </div>}
 </section>
 {accountant&&<details><summary>Fund details</summary><p>Cash in fund: {peso.format(snapshot.cash)} · Available to replenish: {peso.format(snapshot.replenishable)}</p><p>Only the Accounting Officer can replenish settled expenses. Replenishment does not clear the history.</p></details>}
 {!!snapshot.events.length&&<details><summary>History ({snapshot.events.length})</summary><div className="opc-scroll"><table><thead><tr><th>Recorded</th><th>Action</th><th>Amount</th><th>Reference</th><th>Officer</th></tr></thead><tbody>{snapshot.events.map(event=><tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td>{event.action==='initialize'?'Starting fund':event.action.replace(/_/g,' ')}</td><td>{peso.format(event.amount)}</td><td>{event.reference}</td><td>{event.action==='initialize'?'Automatic setup':event.actorName}</td></tr>)}</tbody></table></div></details>}
 </>}
 {edit&&<OfficeCashDialog key={`${edit.action}:${edit.request?.id||''}`} action={edit.action} request={edit.request} maximum={edit.action==='replenish'?snapshot?.replenishable||0:snapshot?.available||0} busy={busy} pending={pending} error={actionError} onClose={()=>setEdit(null)} onSubmit={submit}/>}
 </section>;
}
export function OfficePettyCashLauncher(){const [open,setOpen]=useState(false);return <><button type="button" className="opc-launcher" onClick={()=>setOpen(true)}><Banknote size={16}/>Office petty cash · separate fund</button>{open&&<Modal isOpen title="Office petty cash" width="max-w-6xl" onClose={()=>setOpen(false)}><OfficePettyCash/></Modal>}</>;}
