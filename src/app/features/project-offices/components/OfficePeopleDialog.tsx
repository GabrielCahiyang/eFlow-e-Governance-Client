import { useRef,useState } from 'react';
import { UserPlus,Mail,AlertTriangle } from 'lucide-react';
import { Modal,ModalButton } from '../../../components/ui/Modal';
import { FormField,TextInput,SelectInput } from '../../../components/ui/FormField';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { inviteOfficePerson } from '../services/officePeople';
import type { OfficeIdentity } from '../types';

export function OfficePeopleDialog({office,onClose,onSaved}:{office:OfficeIdentity;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [email,setEmail]=useState(''),[role,setRole]=useState<'representative'|'employee'>('employee'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
 const request=useRef(crypto.randomUUID()),pending=useRef(false),attempted=useRef(false);
 useNavigationBlocker({label:'Sending project invitation',dirty:!!email&&!done,pending:busy,pendingCheck:()=>pending.current,onDiscard:onClose});
 const send=async()=>{if(pending.current)return;pending.current=true;attempted.current=true;setBusy(true);setError('');try{
  const receipt=await inviteOfficePerson(request.current,office.id,email,role);
  setDone(receipt.delivery_error?'Invitation saved. Email delivery failed; retry from the office’s invitation list.':'Invitation sent. Waiting for acceptance.');
  await onSaved();
 }catch(reason){setError((reason as Error).message);await onSaved().catch(()=>{});}finally{pending.current=false;setBusy(false);}};
 return <Modal isOpen preventClose={busy} title={`Invite people · ${office.display_name}`} description="Access is limited to this project. An Office Head is not required." onClose={()=>{if(!busy)onClose();}} width="max-w-xl"
 footer={<><ModalButton disabled={busy} onClick={onClose}>{done?'Done':'Close'}</ModalButton>{!done&&<ModalButton variant="primary" pending={busy} disabled={!email||!/^\S+@\S+\.\S+$/.test(email)} onClick={()=>void send()}><Mail size={16}/> Send invitation</ModalButton>}</>}>
  {done?<p role="status">{done}</p>:<div className="eflow-head-dialog-form"><FormField label="Email address" required><TextInput type="email" maxLength={254} placeholder="name@office.gov.ph" value={email} disabled={busy||attempted.current} onChange={event=>setEmail(event.target.value)}/></FormField>
   <FormField label="Invite as"><SelectInput value={role} disabled={busy||attempted.current} onChange={event=>setRole(event.target.value as typeof role)} options={[{value:'employee',label:'Office employee'},{value:'representative',label:'Office representative / Head'}]}/></FormField>
   <p className="po-project-person-note"><UserPlus size={16}/>Both can join assigned work. The lead Office’s Head manages invitations and staffing.</p><p className="po-help">Project access ends at completion or archive. Their permanent account role and Office stay unchanged.</p></div>}
  {error&&<p role="alert"><AlertTriangle size={16}/>{error} Your request is retained; retry uses the same invitation.</p>}
 </Modal>;
}
