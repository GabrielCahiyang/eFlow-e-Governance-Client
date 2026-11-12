import {useState} from 'react';
import {ArrowRight,ClipboardList,Wallet} from 'lucide-react';
import type {Organization,UserProfile} from '../../../types';
import type {Task} from '../../tasks';
import {useProjectFlow} from '../useProjectFlow';
import {FlowError} from './FlowError';
import {ProjectFundingPanel} from './ProjectFundingPanel';
import {ProjectSetupWizard} from './ProjectSetupWizard';
import '../projectSetup.css';
export function ProjectDefinitionPanel({projectId,profiles,profilesLoading,organizations,tasks,governed,onReady}:{projectId:string;profiles:UserProfile[];profilesLoading?:boolean;organizations?:Organization[];tasks?:Task[];governed?:boolean;onReady?:()=>void}){
 const flow=useProjectFlow(projectId),[open,setOpen]=useState(false),[initialStep,setInitialStep]=useState(0);
 if(!flow.data)return <section className="pf-panel"><h2>Project details and funding</h2>{flow.error?<FlowError error={flow.error}/>:<p role="status">Loading project setup…</p>}</section>;
 const data=flow.data,p=data.project,closed=['completed','archived'].includes(p.status);
 const launch=(step:number)=>{setInitialStep(step);setOpen(true);};
 return <div className="space-y-5"><section className="pf-panel" aria-label="Project definition"><header><div><h2><ClipboardList size={21}/>Project details</h2><p>{data.ready?'Project definition and setup.':'Complete each section in the setup dialog before adding work or people.'}</p></div>{!closed&&<button className="pf-primary" onClick={()=>launch(0)}>{data.ready?'Edit project details':'Continue project setup'}<ArrowRight size={16}/></button>}</header><dl className="pf-definition-summary"><div><dt>Project</dt><dd>{p.title}</dd></div><div><dt>Project lead</dt><dd>{profiles.find(person=>person.id===p.project_lead_id)?.full_name||'Not selected'}</dd></div><div><dt>Timeline</dt><dd>{p.start_date&&p.target_date?`${p.start_date} → ${p.target_date}`:'Not set'}</dd></div><div><dt>Scope</dt><dd>{p.scope||'Not defined'}</dd></div></dl></section>
 <ProjectFundingPanel data={data} reload={flow.reload} allowFundingEntry={false}/>{!closed&&data.canAllocate&&<div className="pf-actions"><button onClick={()=>launch(3)}><Wallet size={16}/>Manage project funding</button></div>}
 {open&&<ProjectSetupWizard projectId={projectId} profiles={profiles} profilesLoading={profilesLoading} organizations={organizations} tasks={tasks} governed={governed} initialStep={initialStep} onClose={()=>{setOpen(false);void flow.reload();}} onFinish={()=>{setOpen(false);void flow.reload();onReady?.();}}/>}</div>;
}
