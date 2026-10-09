import {accessEnd,accessEndDate} from '../../../shared/accessTerms';
import {useRef,useState} from 'react';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {requestNavigation} from '../../../shared/navigationGuard';
import {ENGAGEMENT_TYPES,type Engagement,type SelectedMember} from '../types';
import {saveMemberTerms} from '../services/memberService';
export function MemberTermsEditor({project,member,onClose,onSaved,timezone='Asia/Singapore'}:{project:string;member:SelectedMember;onClose:()=>void;onSaved:()=>void|Promise<void>;timezone?:string}){
 const [engagement,setEngagement]=useState<Engagement>(member.engagement),[end,setEnd]=useState(accessEndDate(member.access_end,timezone)),[until,setUntil]=useState(member.until_close),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const request=useRef<string | undefined>(undefined),pending=useRef(false);const guard=useExplicitDraft('Project access terms',!saved&&(!!request.current||engagement!==member.engagement||end!==(accessEndDate(member.access_end,timezone))||until!==member.until_close),busy,onClose);
 async function save(){if(pending.current||saved)return;pending.current=true;setBusy(true);setError('');try{request.current??=crypto.randomUUID();await saveMemberTerms(project,member,engagement,accessEnd(end,timezone),until,request.current);setSaved(true);guard.markClean();await onSaved();}catch(reason){setError((reason as Error).message);}finally{pending.current=false;setBusy(false);}}
 return <form className="r7-members r7-form" aria-label={`Access terms for ${member.name}`} onSubmit={e=>{e.preventDefault();void save();}}><h3>{member.name} · Project access terms</h3>
 <label>Engagement<select value={engagement} disabled={busy||saved||!!request.current} onChange={e=>setEngagement(e.target.value as Engagement)}>{ENGAGEMENT_TYPES.map(value=><option key={value}>{value}</option>)}</select></label>
 <label>Access ends after this date · {timezone}<input type="date" value={end} disabled={busy||saved||!!request.current} onChange={e=>setEnd(e.target.value)}/></label>
 <label><input type="checkbox" checked={until} disabled={busy||saved||!!request.current} onChange={e=>setUntil(e.target.checked)}/>Until project completion or archive</label>
 <p>Temporary engagement requires an end date or project-close term. Account role and Office affiliation stay unchanged. Ended access does not return automatically when the project is restored. Saving with R9 explicitly reapproves this selected membership; assignments are not restored.</p>
 {error&&<p role="alert">{error} The original request is retained. Retry it before editing different terms, or cancel and reload Members.</p>}{saved&&<p role="status">Access terms saved.</p>}<footer><button type="button" disabled={busy} onClick={()=>void requestNavigation(onClose)}>{saved?'Done':'Cancel changes'}</button>{!saved&&<button disabled={busy||engagement!=='Permanent'&&!end&&!until}>Save access terms</button>}</footer></form>;
}
