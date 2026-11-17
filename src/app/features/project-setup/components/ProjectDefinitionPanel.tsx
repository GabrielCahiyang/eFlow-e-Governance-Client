import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,ClipboardList,RotateCcw,Wallet} from 'lucide-react';
import type {Organization,UserProfile} from '../../../types';
import type {Task} from '../../tasks';
import {useNavigationBlocker} from '../../../shared/navigationGuard';
import {projectFlowCall,readProjectFlow} from '../services/projectFlow';
import {useProjectFlow} from '../useProjectFlow';
import type {ProjectFlow} from '../types';
import {FlowError} from './FlowError';
import {ProjectFundingPanel} from './ProjectFundingPanel';
import {ProjectSetupFields,type SetupDraft} from './ProjectSetupFields';
import {ProjectSetupWizard} from './ProjectSetupWizard';
import '../projectSetup.css';

const toDraft=(p:ProjectFlow['project']):SetupDraft=>({
 title:p.title,
 description:p.description,
 scope:p.scope,
 lead:p.project_lead_id||'',
 start:p.start_date||'',
 end:p.target_date||'',
 noFunding:p.funding_not_required,
});

export function ProjectDefinitionPanel({projectId,profiles,profilesLoading,organizations,tasks,governed,onReady,section='all'}:{projectId:string;profiles:UserProfile[];profilesLoading?:boolean;organizations?:Organization[];tasks?:Task[];governed?:boolean;onReady?:()=>void;section?:'all'|'details'|'funding'}){
 const flow=useProjectFlow(projectId),[open,setOpen]=useState(false),[initialStep,setInitialStep]=useState(0);
 const [draft,setDraft]=useState<SetupDraft>({title:'',description:'',scope:'',lead:'',start:'',end:'',noFunding:false});
 const [busy,setBusy]=useState(false),[fundingModeBusy,setFundingModeBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const syncedRef=useRef('');
 const p=flow.data?.project;
 const baseDraft=p?toDraft(p):undefined;
 const dirty=!!baseDraft&&JSON.stringify(draft)!==JSON.stringify(baseDraft);
 const closed=p?['completed','archived'].includes(p.status):false;
 const planning=!p?.status||p.status==='planning';
 const editable=!!flow.data?.ready&&planning&&!closed&&flow.data.canAuthorize===true&&section!=='funding';

 useEffect(()=>{
  if(!p)return;
  const sig=`${p.id}:${p.updated_at}`;
  if(syncedRef.current!==sig){
   syncedRef.current=sig;
   setDraft(toDraft(p));
   setError('');
  }
 },[p?.id,p?.updated_at]);

 useNavigationBlocker({
  label:'Project settings',
  identity:projectId,
  dirty:editable&&dirty,
  pending:busy,
  onDiscard:()=>{if(baseDraft)setDraft(baseDraft);setError('');setNotice('');},
 });

 if(!flow.data)return <section className="pf-panel"><h2>{section==='funding'?'Project budget':'Project settings'}</h2>{flow.error?<FlowError error={flow.error}/>:<p role="status">{section==='funding'?'Loading project budget…':'Loading project settings…'}</p>}</section>;
 const data=flow.data,project=data.project;
 const launch=(step:number)=>{setInitialStep(step);setOpen(true);};
 const update=(key:keyof SetupDraft,value:string|boolean)=>{setDraft(current=>({...current,[key]:value}));setNotice('');setError('');};

 async function saveInline(event:React.FormEvent){
  event.preventDefault();
  if(busy||!editable)return;
  if(!draft.title.trim()||!draft.description.trim()){setError('Enter the project title and description before saving.');return;}
  if(!draft.scope.trim()){setError('Define the project scope before saving.');return;}
  if(!draft.lead||!draft.start||!draft.end||draft.end<draft.start){setError('Enter valid project start and target dates.');return;}
  if(!navigator.onLine){setError('Reconnect before saving project settings.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const latest=await readProjectFlow(projectId);
   const current=latest.project;
   const meta=(item:ProjectFlow['project'])=>JSON.stringify({...toDraft(item),noFunding:false});
   if(current.updated_at!==project.updated_at&&meta(current)!==meta(project)){
    throw new Error('Project details changed elsewhere. Refresh before saving your edits.');
   }
   const proposed={...draft,noFunding:latest.total>0?false:draft.noFunding};
   await projectFlowCall<ProjectFlow['project']>('save_project_definition',{
    p_project:projectId,
    p_details:{...proposed,version:current.updated_at},
   });
   syncedRef.current='';
   await flow.reload();
   setNotice('Project settings saved.');
  }catch(e){
   setError(e instanceof Error?e.message:'Could not save project settings.');
  }finally{
   setBusy(false);
  }
 }

 async function toggleNoFunding(nextNoFunding:boolean){
  if(fundingModeBusy||!planning||closed||!data.canAuthorize||data.total>0||data.fundingRequests.length>0)return;
  if(!navigator.onLine){setError('Reconnect before updating project funding settings.');return;}
  setFundingModeBusy(true);setError('');setNotice('');
  try{
   const latest=await readProjectFlow(projectId);
   const current=latest.project;
   if(latest.total>0||latest.fundingRequests.length>0){await flow.reload();return;}
   await projectFlowCall<ProjectFlow['project']>('save_project_definition',{
    p_project:projectId,
    p_details:{...toDraft(current),noFunding:nextNoFunding,version:current.updated_at},
   });
   syncedRef.current='';
   await flow.reload();
  }catch(e){
   setError(e instanceof Error?e.message:'Could not update funding requirement.');
  }finally{
   setFundingModeBusy(false);
  }
 }

 return <div className="space-y-5">{section!=='funding'&&(data.ready?<form className="pf-panel" aria-label="Project definition" onSubmit={e=>{void saveInline(e);}}>
  <header>
   <div><h2><ClipboardList size={21}/>Project settings</h2><p>{editable?'Update project details, scope, lead, and schedule.':closed?'Completed and archived project settings are read-only.':!planning?'Project settings are read-only once planning ends.':'Only the appointed lead Office Head can edit project settings.'}</p></div>
  </header>
  <ProjectSetupFields step={0} draft={draft} update={update} profiles={profiles} disabled={!editable||busy} settings/>
  <ProjectSetupFields step={1} draft={draft} update={update} profiles={profiles} disabled={!editable||busy} settings/>
  <ProjectSetupFields step={2} draft={draft} update={update} profiles={profiles} disabled={!editable||busy} settings/>
  {error&&<FlowError error={error}/>}
  {notice&&<p role="status" className="pf-success">{notice}</p>}
  {editable&&<div className="pf-actions">
   <button type="submit" className="pf-primary" disabled={!dirty||busy}><Check size={16}/>{busy?'Saving…':'Save changes'}</button>
   <button type="button" disabled={!dirty||busy} onClick={()=>{if(baseDraft)setDraft(baseDraft);setError('');setNotice('');}}><RotateCcw size={15}/>Discard changes</button>
   <span role="status" className="text-xs text-muted-foreground">{dirty?'Unsaved changes':'All changes saved'}</span>
  </div>}
 </form>:<section className="pf-panel" aria-label="Project definition"><header><div><h2><ClipboardList size={21}/>Project details</h2><p>Complete each section in the setup dialog before adding work or people.</p></div>{planning&&!closed&&<button className="pf-primary" onClick={()=>launch(0)}>Continue project setup<ArrowRight size={16}/></button>}</header><dl className="pf-definition-summary"><div><dt>Project</dt><dd>{project.title}</dd></div><div><dt>Project lead</dt><dd>{profiles.find(person=>person.id===project.project_lead_id)?.full_name||'Not selected'}</dd></div><div><dt>Timeline</dt><dd>{project.start_date&&project.target_date?`${project.start_date} → ${project.target_date}`:'Not set'}</dd></div><div><dt>Scope</dt><dd>{project.scope||'Not defined'}</dd></div></dl></section>)}
 {section!=='details'&&(section==='funding'?<>
  {planning&&!closed&&data.canAuthorize&&data.total===0&&data.fundingRequests.length===0&&<section className="pf-panel" aria-label="Funding requirement">
   <label className="pf-checkbox"><input type="checkbox" checked={project.funding_not_required} disabled={fundingModeBusy} onChange={e=>{void toggleNoFunding(e.target.checked);}}/>No funding required for this project</label>
   {error&&<FlowError error={error}/>}
  </section>}
  <ProjectFundingPanel data={data} reload={flow.reload} allowFundingEntry={planning||!project.funding_not_required} recoveryKey={projectId?`budget:${projectId}`:''}/>
 </>:<><ProjectFundingPanel data={data} reload={flow.reload} allowFundingEntry={false}/>{planning&&!closed&&data.canAllocate&&<div className="pf-actions"><button className="pf-primary" onClick={()=>launch(3)}><Wallet size={16}/>Manage project funding</button></div>}</>)}
 {open&&<ProjectSetupWizard projectId={projectId} profiles={profiles} profilesLoading={profilesLoading} organizations={organizations} tasks={tasks} governed={governed} initialStep={initialStep} onClose={()=>{setOpen(false);void flow.reload();}} onFinish={()=>{setOpen(false);void flow.reload();onReady?.();}}/>}</div>;
}
