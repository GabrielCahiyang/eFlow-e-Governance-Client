import {useRef,useState,type MutableRefObject} from 'react';
import {InvitationPersonFields} from '../../invitations';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {useConfirmation} from '../../../components/ui/useConfirmation';
import {submitProjectInvitation,uploadRequestPds} from '../services/projectInvitationService';
import type {InvitationDraft,ProjectInvitation} from '../types';
const blank=():InvitationDraft=>({id:crypto.randomUUID(),email:'',summary:'',skills:'',engagement:'Consultant',end:'',untilClose:true});
export function ProjectInvitationForm({project,office,root,node,timezone,onDone,onClose,closeRef}:{project:string;office:string;root?:string;node?:string;timezone:string;onDone:()=>void;onClose:()=>void;closeRef?:MutableRefObject<(()=>void)|undefined>}){
 const [rows,setRows]=useState<InvitationDraft[]>(()=>[blank()]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipts,setReceipts]=useState<Record<string,{item:ProjectInvitation;pds:string}>>({});
 const attempted=useRef(new Set<string>());const dirty=rows.some(r=>(!!r.email||!!r.file)&&!receipts[r.id]||receipts[r.id]?.pds==='Attachment failed');const guard=useExplicitDraft('Project invitation requests',dirty,busy,onClose);const confirmation=useConfirmation();
 async function close(){if(guard.pendingRef.current||busy)return;if(dirty&&!await confirmation.confirm({title:'Discard invitation request draft?',description:'Submitted requests remain saved. Discard only the unsent request fields or pending PDS attachment in this form.',actionLabel:'Discard request draft'}))return;if(guard.pendingRef.current)return;guard.markClean();onClose();}
 if(closeRef)closeRef.current=()=>void close();
 const change=(id:string,patch:Partial<InvitationDraft>)=>setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row));
 async function send(){if(guard.pendingRef.current)return;guard.pendingRef.current=true;setBusy(true);setError('');const failures:string[]=[];let next={...receipts};
  try{for(const row of rows.filter(r=>r.email.trim())){
   if(next[row.id])continue;attempted.current.add(row.id);
   try{const item=await submitProjectInvitation(project,office,row,timezone,root,node);next[row.id]={item,pds:row.file?'Pending attachment':'Optional · not attached'};setReceipts({...next});onDone();
    if(row.file){try{await uploadRequestPds(row.file,item.id);next[row.id].pds='Attached · processing';}catch(reason){next[row.id].pds='Attachment failed';failures.push(`${row.email}: request submitted; PDS failed. ${(reason as Error).message}`);}setReceipts({...next});}
   }catch(reason){failures.push(`${row.email}: ${(reason as Error).message}`);}
  }setError(failures.join('\n'));if(!failures.length)guard.markClean();}
  finally{guard.pendingRef.current=false;setBusy(false);}
 }
 async function retryPds(row:InvitationDraft){if(!row.file||busy)return;setBusy(true);setError('');try{await uploadRequestPds(row.file,row.id);setReceipts(current=>({...current,[row.id]:{...current[row.id],pds:'Attached · processing'}}));onDone();}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
 return <div className="r8-form"><h3>Request a project invitation</h3><p>The appointed sponsoring Head approves first. Submitting creates no email, invitation link, membership or work assignment. PDS is optional and private.</p>
 <form onSubmit={e=>{e.preventDefault();e.stopPropagation();void send();}}>{rows.map((row,index)=><div key={row.id}><InvitationPersonFields id={row.id} index={index} email={row.email} file={row.file} disabled={busy||attempted.current.has(row.id)} onEmail={email=>change(row.id,{email})} onFile={file=>change(row.id,{file})} onError={setError}>
 <label>Requested skills<input value={row.skills} maxLength={1000} placeholder="Skills, separated by commas" onChange={e=>change(row.id,{skills:e.target.value})}/></label><label>Professional summary<textarea value={row.summary} maxLength={1500} onChange={e=>change(row.id,{summary:e.target.value})}/></label>
 <label>Engagement<select value={row.engagement} onChange={e=>change(row.id,{engagement:e.target.value as InvitationDraft['engagement']})}>{['Permanent','Job Order','OJT','Consultant','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Access ends after this date · {timezone}<input type="date" value={row.end} onChange={e=>change(row.id,{end:e.target.value})}/></label><label><input type="checkbox" checked={row.untilClose} onChange={e=>change(row.id,{untilClose:e.target.checked})}/>Until project completion or archive</label>
 <p>Scope: this project{root?' · selected task':''}{node?' / subitem':''}. Engagement does not grant an account role.</p></InvitationPersonFields>
 {receipts[row.id]&&<p role="status">{row.email}: Request submitted · Pending Head approval · PDS: {receipts[row.id].pds}</p>}
 {receipts[row.id]?.pds==='Attachment failed'&&<button type="button" disabled={busy} onClick={()=>void retryPds(row)}>Retry PDS only for {row.email}</button>}</div>)}
 {rows.length<5&&<button type="button" disabled={busy} onClick={()=>setRows(current=>[...current,blank()])}>Add another person</button>}
 {error&&<p role="alert">{error} Submitted requests will be excluded from retry. Attempted terms stay frozen for safe recovery.</p>}
 <footer><button type="button" disabled={busy} onClick={()=>void close()}>Close request form</button><button type="submit" disabled={busy||!rows.some(r=>r.email.trim()&&!receipts[r.id])||rows.some(r=>r.email.trim()&&r.engagement!=='Permanent'&&!r.end&&!r.untilClose)}>{busy?'Submitting…':'Submit requests for Head approval'}</button></footer></form>{confirmation.dialog}</div>;
}
