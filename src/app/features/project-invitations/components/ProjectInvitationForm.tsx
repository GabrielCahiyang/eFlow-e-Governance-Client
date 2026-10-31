import {useRef,useState,type MutableRefObject} from 'react';
import {Mail,Plus,ShieldCheck,UserRoundPlus} from 'lucide-react';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {useConfirmation} from '../../../components/ui/useConfirmation';
import {sendProjectInvitation,submitProjectInvitation} from '../services/projectInvitationService';
import type {InvitationDraft} from '../types';

const blank=():InvitationDraft=>({id:crypto.randomUUID(),email:'',summary:'',skills:'',engagement:'Other',end:'',untilClose:true});
export function ProjectInvitationForm({project,office,root,node,timezone,canSend=false,onDone,onClose,closeRef}:{project:string;office:string;root?:string;node?:string;timezone:string;canSend?:boolean;onDone:()=>void;onClose:()=>void;closeRef?:MutableRefObject<(()=>void)|undefined>}){
 const [rows,setRows]=useState<InvitationDraft[]>(()=>[blank()]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipts,setReceipts]=useState<Record<string,string>>({});
 const attempted=useRef(new Set<string>()),dirty=rows.some(row=>!!row.email&&!receipts[row.id]);
 const guard=useExplicitDraft('Project invitations',dirty,busy,onClose),confirmation=useConfirmation();
 async function close(){if(guard.pendingRef.current||busy)return;if(dirty&&!await confirmation.confirm({title:'Discard unsent invitation details?',description:'Saved requests and sent invitations remain available in the invitation list.',actionLabel:'Discard unsent details'}))return;if(guard.pendingRef.current)return;guard.markClean();onClose();}
 if(closeRef)closeRef.current=()=>void close();
 const change=(id:string,patch:Partial<InvitationDraft>)=>setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row));
 async function send(){
  if(guard.pendingRef.current)return;guard.pendingRef.current=true;setBusy(true);setError('');const failures:string[]=[],next={...receipts};
  try{
   for(const row of rows.filter(row=>row.email.trim())){
    if(next[row.id])continue;attempted.current.add(row.id);
    try{
     if(canSend){const result=await sendProjectInvitation(project,office,row,timezone,root,node);next[row.id]=result.status;}
     else{await submitProjectInvitation(project,office,row,timezone,root,node);next[row.id]='Request submitted · pending Head approval';}
     setReceipts({...next});onDone();
    }catch(reason){failures.push(`${row.email}: ${(reason as Error).message}`);}
   }
   setError(failures.join('\n'));if(!failures.length)guard.markClean();
  }finally{guard.pendingRef.current=false;setBusy(false);}
 }
 return <div className="r8-form">
  <div className="r8-invite-explanation"><UserRoundPlus size={22} aria-hidden="true"/><div><strong>{canSend?'Invite people to this project':'Request a project invitation'}</strong><p>{canSend?'Send an invitation to their email. They enter their own name, choose a password and complete their profile when they join.':'Your sponsoring Head reviews the request before an invitation is sent. The recipient completes their own profile and password.'}</p></div></div>
  <form onSubmit={event=>{event.preventDefault();event.stopPropagation();void send();}}>
   {rows.map((row,index)=><div key={row.id}><fieldset className="r8-invite-person" disabled={busy||attempted.current.has(row.id)}><legend>Person {index+1}</legend>
    <label>Email address {index+1}<input type="email" autoComplete="off" required value={row.email} maxLength={254} placeholder="name@example.com" onChange={event=>change(row.id,{email:event.target.value})}/></label>
    <label>Engagement<select aria-label="Engagement" value={row.engagement} onChange={event=>change(row.id,{engagement:event.target.value as InvitationDraft['engagement']})}>{['Permanent','Job Order','OJT','Consultant','Other'].map(value=><option key={value}>{value}</option>)}</select></label>
    <label className="r8-invite-until"><input type="checkbox" checked={row.untilClose} onChange={event=>change(row.id,{untilClose:event.target.checked,end:event.target.checked?'':row.end})}/>Until project completion or archive</label>
    {!row.untilClose&&<label>Access ends after this date · {timezone}<input type="date" required={row.engagement!=='Permanent'} value={row.end} onChange={event=>change(row.id,{end:event.target.value})}/></label>}
    <p className="r8-invite-scope"><ShieldCheck size={15} aria-hidden="true"/>Project-only access{root?' · selected task':''}{node?' / subitem':''}. This does not grant a permanent account role.</p>
   </fieldset>{receipts[row.id]&&<p role="status" className="r8-invite-receipt">{row.email}: {receipts[row.id]}</p>}</div>)}
   {rows.length<5&&<button type="button" className="r8-add-person" disabled={busy} onClick={()=>setRows(current=>[...current,blank()])}><Plus size={16} aria-hidden="true"/>Add another person</button>}
   {error&&<p role="alert">{error} Successful invitations are excluded from retry. Saved request details are retained to prevent duplicates.</p>}
   <footer><button type="button" disabled={busy} onClick={()=>void close()}>{canSend?'Close invitation form':'Close request form'}</button><button type="submit" className="r8-send-primary" disabled={busy||!rows.some(row=>row.email.trim()&&!receipts[row.id])||rows.some(row=>row.email.trim()&&row.engagement!=='Permanent'&&!row.end&&!row.untilClose)}><Mail size={16} aria-hidden="true"/>{busy?canSend?'Sending…':'Submitting…':canSend?'Send invitations':'Submit requests for Head approval'}</button></footer>
  </form>{confirmation.dialog}
 </div>;
}
