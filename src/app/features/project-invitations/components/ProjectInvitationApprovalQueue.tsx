import {useEffect,useState} from 'react';
import {supabase} from '../../../../lib/supabase';
import {useAuth} from '../../../contexts/AuthContext';
import {ProjectInvitations} from './ProjectInvitations';
export function ProjectInvitationApprovalQueue(){
 const {user,userProfile}=useAuth();const [rows,setRows]=useState<{project_id:string;title:string}[]>([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;setRows([]);setError('');if(userProfile?.role!=='head')return;
 async function load(){const {data,error:failure}=await supabase.rpc('r8_head_invitation_queue');if(!active)return;if(failure){setRows([]);if(failure.code!=='PGRST202')setError(failure.message);}else setRows(data||[]);}
 void load();window.addEventListener('focus',load);const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);};},[user?.id,userProfile?.role]);
 if(userProfile?.role!=='head'||!rows.length&&!error)return null;
 return <section aria-label="Head invitation approval Inbox"><h2>Project member approval</h2><p>Review requested people and dispatch approved invitations here or in project Members / Invitations.</p>{error&&<p role="alert">{error}</p>}{rows.map(row=><details key={row.project_id}><summary>{row.title} · Membership invitations</summary><ProjectInvitations project={row.project_id}/></details>)}</section>;
}
