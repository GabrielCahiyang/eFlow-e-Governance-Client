import {useRef,useState} from 'react';
import {CheckCircle2,ArrowRight} from 'lucide-react';
import {ProfessionalProfilePanel} from '../../professional-profile';
import {completeProjectOnboarding} from '../../project-invitations';
import {useAuth} from '../../../contexts/AuthContext';
import {requestNavigation} from '../../../shared/navigationGuard';

/** Recipient-owned details, after verified acceptance and protected sign-in. */
export function ProjectInviteOnboarding({requestId,onContinue}:{requestId:string;onContinue:()=>void}){
 const {user}=useAuth(),[busy,setBusy]=useState(false),[error,setError]=useState(''),pending=useRef(false);
 const finish=()=>void requestNavigation(()=>{
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  void completeProjectOnboarding(requestId).then(onContinue).catch(reason=>setError((reason as Error).message)).finally(()=>{pending.current=false;setBusy(false);});
 });
 return <section className="eflow-invite-onboarding" aria-label="Complete your profile">
  <header><CheckCircle2 size={28} aria-hidden="true"/><h1>Your project access is ready.</h1><p>Add your own skills, experience and professional summary below. You can also upload your private PDS. These details are optional and can be updated from your profile later.</p></header>
  {user?<ProfessionalProfilePanel userId={user.id} projectRequestId={requestId}/>:<p role="status">Finishing your sign-in…</p>}
  {error&&<p role="alert" className="eflow-form-error">{error} Your account and project access are saved. Retry continuing without creating another account.</p>}
  <button type="button" className="eflow-primary-button" disabled={busy||!user} onClick={finish}>{busy?'Opening project…':'Continue to project'}<ArrowRight size={17} aria-hidden="true"/></button>
 </section>;
}
