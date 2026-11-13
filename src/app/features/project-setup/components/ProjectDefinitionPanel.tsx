import {useRef,useState} from 'react';
import type {UserProfile} from '../../../types';
import {useNavigationBlocker} from '../../../shared/navigationGuard';
import {ProjectFlowError,projectFlowCall} from '../services/projectFlow';
import type {ProjectFlow} from '../types';
import {useProjectFlow} from '../useProjectFlow';
import {FlowError} from './FlowError';
import {ProjectFundingPanel} from './ProjectFundingPanel';
import {ProjectSetupFields,type SetupDraft} from './ProjectSetupFields';
import '../projectSetup.css';

function definition(project:ProjectFlow['project']):SetupDraft {
 return {
  title:project.title,description:project.description,scope:project.scope,lead:project.project_lead_id||'',
  start:project.start_date||'',end:project.target_date||'',noFunding:project.funding_not_required,
 };
}

export function ProjectDefinitionPanel({projectId,profiles,onReady,fundingOnly=false}:{
 projectId:string;profiles:UserProfile[];onReady?:()=>void;fundingOnly?:boolean;
}){
 const flow=useProjectFlow(projectId);
 if(!flow.data)return <section className="pf-panel"><h2>{fundingOnly?'Project funding':'Project Settings'}</h2>
  {flow.error?<FlowError error={flow.error}/>:<p role="status">Loading project details…</p>}
 </section>;
 return <div className="space-y-5">
  {!fundingOnly&&<ProjectDefinitionEditor key={projectId} data={flow.data} profiles={profiles} reload={flow.reload} onReady={onReady}/>}
  <ProjectFundingPanel data={flow.data} reload={flow.reload}/>
 </div>;
}

function ProjectDefinitionEditor({data,profiles,reload,onReady}:{
 data:ProjectFlow;profiles:UserProfile[];reload:()=>Promise<void>;onReady?:()=>void;
}){
 const current=definition(data.project);
 const [edit,setEdit]=useState<{values:SetupDraft;version:string}>();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef(false);
 const editable=data.canAuthorize&&!['completed','archived'].includes(data.project.status);
 const draft=edit?.values??current;
 const conflict=!!edit&&edit.version!==data.project.updated_at;
 const update=(key:keyof SetupDraft,value:string|boolean)=>{
  setError('');setNotice('');
  setEdit(previous=>({values:{...(previous?.values??current),[key]:value},version:previous?.version??data.project.updated_at}));
 };
 useNavigationBlocker({label:'Project Settings',dirty:!!edit,pending:busy,pendingCheck:()=>pending.current,onDiscard:()=>setEdit(undefined)});
 async function save(finish:boolean){
  if(!editable||pending.current||conflict)return;
  pending.current=true;setBusy(true);setError('');setNotice('');
  try{
   if(edit){
    await projectFlowCall('save_project_definition',{p_project:data.project.id,p_details:{...draft,version:edit.version}});
    setEdit(undefined);
   }
   if(finish)await projectFlowCall('finish_project_setup',{p_project:data.project.id});
   await reload();
   window.dispatchEvent(new Event('eflow:project-setup'));
   setNotice(finish?'Project setup complete.':'Project Settings saved.');
   if(finish)onReady?.();
  }catch(caught){
   if(caught instanceof ProjectFlowError&&caught.code==='40001')await reload();
   setError(caught instanceof ProjectFlowError?caught.message:'Could not confirm the save. Check your connection and reload the latest project details.');
  }finally{pending.current=false;setBusy(false);}
 }
 return <section className="pf-panel space-y-4" aria-label="Project Settings">
  <header><div><h2>Project Settings</h2><p>Project details, scope, Project Lead and dates.</p></div></header>
  {[0,1,2].map(step=><ProjectSetupFields key={step} step={step} settings draft={draft} update={update} profiles={profiles} disabled={!editable||busy}/>)}
  <label className="pf-checkbox"><input type="checkbox" checked={draft.noFunding}
    disabled={!editable||busy||data.funds.some(fund=>fund.amount>0)}
    onChange={event=>update('noFunding',event.target.checked)}/>Funding not required</label>
  {conflict&&<div role="alert"><p>This project changed elsewhere. Reload the latest details before saving.</p>
   <button type="button" onClick={()=>{setEdit(undefined);setError('');}}>Use latest project details</button></div>}
  <FlowError error={error}/>{notice&&<p role="status">{notice}</p>}
  {editable&&<div className="pf-actions">
   <button type="button" className="pf-primary" disabled={busy||!edit||conflict||!draft.title.trim()} onClick={()=>void save(false)}>Save project settings</button>
   {!data.ready&&data.project.status==='planning'&&<button type="button" disabled={busy||!!edit} onClick={()=>void save(true)}>Finish project setup</button>}
  </div>}
 </section>;
}
