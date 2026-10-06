import { useRef, useState } from 'react';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '../../../components/ui/dialog';
import { WorkspaceIllustration } from '../../../components/ui/WorkspaceIllustration';
import { createProject,type Project } from '../../projects';
import '../projectTable.css';
export function CreateProjectDialog({open,onClose,onCreated,officeId}:{open:boolean;onClose:()=>void;onCreated:(p:Project)=>void;officeId:string}){
 const [title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false);
 useNavigationBlocker({label:'Create project',dirty:open&&Boolean(title.trim()),pending:busy,onDiscard:()=>{setTitle('');setError('');onClose();}});
 const close=()=>{if(!inFlight.current)void requestNavigation(()=>{if(!title.trim())onClose();});};
 async function submit(e:React.FormEvent){e.preventDefault();if(!title.trim()||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{const p=await createProject({title:title.trim(),orgId:officeId,status:'planning',sourceType:'manual'});onCreated(p);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not create the project.');}finally{inFlight.current=false;setBusy(false);}}
 return <Dialog open={open} onOpenChange={v=>{if(!v&&!busy)close();}}><DialogContent className="eflow-project-create" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onInteractOutside={e=>{if(busy)e.preventDefault();}}>
  <form onSubmit={submit}><span className="pt-brand">eFlow.</span><DialogTitle>Let’s start working together</DialogTitle><DialogDescription>Give your project a name. You can add details as you work.</DialogDescription>
   <label htmlFor="pt-project-name">Project name</label><input id="pt-project-name" autoFocus placeholder="My first project" value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} disabled={busy}/>
   <p className="pt-create-hint">Your project opens with a group ready for tasks. Evidence, reviews and budget controls stay connected to your work.</p>
   {error&&<p role="alert">{error}</p>}<footer><button type="button" onClick={close} disabled={busy}>Cancel</button><button className="pt-primary" type="submit" disabled={!title.trim()||busy}>{busy?'Creating…':'Create project →'}</button></footer>
  </form><WorkspaceIllustration title={title.trim() || 'My first project'}/>
 </DialogContent></Dialog>;
}
