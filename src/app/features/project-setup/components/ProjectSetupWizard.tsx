import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ClipboardList,Layers,CalendarDays,Wallet,ShieldCheck,Save,UsersRound} from 'lucide-react';
import {Modal} from '../../../components/ui/Modal';
import {ProjectOpeningPreview} from './ProjectOpeningPreview';
import type {Organization,UserProfile} from '../../../types';
import {ProjectOfficeContext,ProjectPeoplePage,useProjectOffices} from '../../project-offices';
import type {Task} from '../../tasks';
import {requestNavigation,useNavigationBlocker} from '../../../shared/navigationGuard';
import {useProjectFlow} from '../useProjectFlow';
import {ProjectFlowError,projectFlowCall,readProjectFlow} from '../services/projectFlow';
import {readProjectDraft,storeProjectDraft,type ProjectDraftRecovery} from '../projectDraftRecovery';
import {readFundingDraft} from '../fundingDraftRecovery';
import type {ProjectFlow} from '../types';
import {FlowError} from './FlowError';
import {ProjectFundingPanel} from './ProjectFundingPanel';
import {ProjectSetupFields,type SetupDraft} from './ProjectSetupFields';
import {ProjectSetupPeople} from './ProjectSetupPeople';
import { ProjectTaskDraftStep } from './ProjectTaskDraftStep';
import { useProjectTaskTemplates } from '../useProjectTaskTemplates';
import '../projectSetup.css';
import '../projectWizardDesign.css';
const steps=[{title:'Details',icon:ClipboardList},{title:'Scope',icon:Layers},{title:'Lead & dates',icon:CalendarDays},{title:'Funding',icon:Wallet},{title:'Review',icon:ShieldCheck},{title:'Add people',icon:UsersRound},{title:'Draft tasks',icon:ClipboardList}];
const reviewStep=4,peopleStep=5,tasksStep=6;
const empty:SetupDraft={title:'',description:'',scope:'',lead:'',start:'',end:'',noFunding:false};
const fields=(p:ProjectFlow['project']):SetupDraft=>({title:p.title,description:p.description,scope:p.scope,lead:p.project_lead_id||'',start:p.start_date||'',end:p.target_date||'',noFunding:p.funding_not_required});
export function ProjectSetupWizard({projectId,profiles,profilesLoading,organizations=[],tasks=[],governed=false,officeName,recoveryKey='',createDraft,onClose,onFinish,initialStep=0}:{projectId?:string;profiles:UserProfile[];profilesLoading?:boolean;organizations?:Organization[];tasks?:Task[];governed?:boolean;officeName?:string;recoveryKey?:string;createDraft?:(title:string,requestId:string)=>Promise<string>;onClose:(id?:string)=>void;onFinish:(id:string)=>void;initialStep?:number}){
 const [id,setId]=useState(projectId||''),[draft,setDraft]=useState<SetupDraft>(empty),[base,setBase]=useState<ProjectFlow['project']>(),[step,setStep]=useState(initialStep),[busy,setBusy]=useState(false),[fundingBusy,setFundingBusy]=useState(false),[fundingDirty,setFundingDirty]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const [recovery,setRecovery]=useState(()=>projectId?undefined:readProjectDraft(recoveryKey));
 const creationAttempt=useRef<ProjectDraftRecovery['creationAttempt']>(undefined),finished=useRef(false);
 const [people,setPeople]=useState<string[]>([]);
 const peopleRequest=useRef<ProjectDraftRecovery['peopleRequest']>(undefined);
 const [peopleProjectId,setPeopleProjectId]=useState('');
 const flow=useProjectFlow(id,!!id),pending=useRef(false),createdId=useRef(id),hydrated=useRef(!projectId);
 useEffect(()=>{if(flow.data&&!hydrated.current){hydrated.current=true;setBase(flow.data.project);setDraft(fields(flow.data.project));}},[flow.data?.project.id]);
 const [taskDraftBusy,setTaskDraftBusy]=useState(false);
 const [projectType,setProjectType]=useState('');
 const editable=!projectId||flow.data?.canAuthorize===true,locked=busy||fundingBusy||taskDraftBusy;
 const templateLibrary=useProjectTaskTemplates(editable);
 const dirty=JSON.stringify(draft)!==JSON.stringify(base?fields(base):empty);
 const [localSaved,setLocalSaved]=useState(false);
 const fundingRecoveryKey=recoveryKey&&id?recoveryKey+':funding:'+id:'';
 useNavigationBlocker({label:'Project setup',identity:id||'new-project',dirty:dirty&&!localSaved,pending:locked,pendingCheck:()=>pending.current,onDiscard:()=>{setDraft(base?fields(base):empty);setError('');}});
 useEffect(()=>{
  if(recoveryKey&&!recovery&&!finished.current&&(id||dirty||creationAttempt.current)){
   setLocalSaved(storeProjectDraft(recoveryKey,{values:draft,step,projectId:id,base,people,peopleRequest:peopleRequest.current,creationAttempt:creationAttempt.current,projectType,peopleProjectId}));
  }
 },[recoveryKey,recovery,draft,step,id,base,dirty,people,projectType,peopleProjectId]);
 const finish=(target:string)=>{finished.current=true;if(recoveryKey)storeProjectDraft(recoveryKey);onFinish(target);};
 const close=()=>void requestNavigation(() => peopleProjectId ? finish(peopleProjectId) : onClose(createdId.current||undefined));
 const update=(key:keyof SetupDraft,value:string|boolean)=>setDraft(current=>({...current,[key]:value}));
 async function persist(){
  let target=createdId.current;
  if(!draft.title.trim())throw new Error('Enter a project title before saving.');
  if(!target){
   if(!createDraft)throw new Error('Project creation is unavailable.');
   creationAttempt.current??={id:crypto.randomUUID(),title:draft.title.trim()};
   storeProjectDraft(recoveryKey,{values:draft,step,projectId:'',people,projectType,creationAttempt:creationAttempt.current});
   try{target=await createDraft(creationAttempt.current.title,creationAttempt.current.id);}
   catch(error){
    if(error instanceof ProjectFlowError){
     creationAttempt.current=undefined;
     storeProjectDraft(recoveryKey,{values:draft,step,projectId:'',people,projectType});
    }
    throw error;
   }
   createdId.current=target;creationAttempt.current=undefined;setId(target);
   storeProjectDraft(recoveryKey,{values:draft,step,projectId:target,people,projectType});
  }

  const latest=await readProjectFlow(target);let current=latest.project;const metadata=(p:ProjectFlow['project'])=>JSON.stringify({...fields(p),noFunding:false});
  if(base&&current.updated_at!==base.updated_at&&metadata(current)!==metadata(base))throw new Error('Project details changed elsewhere. Your entries are retained; close and reopen setup to review the current project before saving.');
  const proposed={...draft,noFunding:latest.total>0?false:draft.noFunding};
  if(JSON.stringify(proposed)!==JSON.stringify(fields(current))){current=await projectFlowCall<ProjectFlow['project']>('save_project_definition',{p_project:target,p_details:{...proposed,version:current.updated_at}});setPeopleProjectId('');}
  setBase(current);setDraft(fields(current));return target;
 }
 async function perform(action:()=>Promise<void>){
  if(pending.current||fundingBusy)return;
  if(!navigator.onLine){
   setError(localSaved?'You’re offline. Your draft is saved on this device.':'You’re offline. Keep this dialog open and reconnect to save your draft.');
   return;
  }
  pending.current=true;setBusy(true);setError('');
  try{await action();}
  catch(e){
   setError(creationAttempt.current?'Could not confirm project creation. Retry to check the same request.':
    e instanceof Error?e.message:'Could not save project setup.');
  }finally{pending.current=false;setBusy(false);}
 }
 function validate(index:number){
  if(index===0&&(!draft.title.trim()||!draft.description.trim()))throw new Error('Enter the project title and description before continuing.');
  if(index===1&&!draft.scope.trim())throw new Error('Define the project scope before continuing.');
  if(index===2&&(!draft.lead||!draft.start||!draft.end||draft.end<draft.start))throw new Error('Choose an active project lead and valid project start and target dates.');
 }
 const next=()=>{
  if(step<3){
   try{validate(step);setError('');setStep(value=>value+1);}
   catch(e){setError(e instanceof Error?e.message:'Check the project details before continuing.');}
   return;
  }
  void perform(async()=>{
  if(step===reviewStep){
   validate(0);validate(1);validate(2);
   if(fundingDirty||uncertain)throw new Error('Save or remove the funding entries first.');
   if(!draft.noFunding&&!(flow.data&&flow.data.total>0))throw new Error('Add project funding or select No funding required.');
   const target=await persist();
   await projectFlowCall('finish_project_setup',{p_project:target});
   if(people.length||peopleRequest.current){
    peopleRequest.current??={id:crypto.randomUUID(),users:[...people]};
    storeProjectDraft(recoveryKey,{values:draft,step,projectId:target,base,people,projectType,peopleRequest:peopleRequest.current});
    await projectFlowCall('save_private_project_people',{p_project:target,p_users:peopleRequest.current.users,p_key:peopleRequest.current.id});
    peopleRequest.current=undefined;
    setPeople([]);
   }
   setPeopleProjectId(target);
   setStep(peopleStep);
   void flow.reload();
   window.dispatchEvent(new Event('eflow:project-setup'));
   return;
  }
  if(fundingDirty||uncertain)throw new Error('Authorize the funding rows or clear the unsaved entries before continuing.');
  if(!draft.noFunding&&!(flow.data&&flow.data.total>0))throw new Error('Authorize project funding, or explicitly choose No funding required.');
  await persist();await flow.reload();setStep(reviewStep);
  });
 };
 const saveDraft=()=>void perform(async()=>{await persist();window.dispatchEvent(new Event('eflow:project-setup'));window.setTimeout(()=>onClose(createdId.current),0);});
 const loading=!!projectId&&!hydrated.current;
 const canOpenPeople=!!peopleProjectId&&!dirty&&!fundingDirty;
 const jump=(index:number)=>{
  if(locked||loading||uncertain||(index>=peopleStep&&!canOpenPeople)||index===step)return;
  const change=()=>{setError('');setStep(index);};
  if(step>=peopleStep)void requestNavigation(change);else change();
 };
 const complete=[!!draft.title.trim()&&!!draft.description.trim(),!!draft.scope.trim(),!!draft.lead&&!!draft.start&&!!draft.end&&draft.end>=draft.start,(draft.noFunding||!!flow.data?.total)&&!fundingDirty&&!uncertain,canOpenPeople];
 const detailsComplete=complete.slice(0,3).every(Boolean);
 const needsFundingDetails=!recovery&&step===3&&!draft.noFunding&&detailsComplete&&editable&&(!id||!base||dirty);
 const prepareFunding=()=>void perform(async()=>{await persist();if(id&&base)await flow.reload();});
 const prepareFundingRef=useRef(prepareFunding);
 prepareFundingRef.current=prepareFunding;
 useEffect(()=>{if(needsFundingDetails)prepareFundingRef.current();},[needsFundingDetails,draft]);
 function continueDraft(saved:ProjectDraftRecovery){
  const funding=saved.projectId?readFundingDraft(recoveryKey+':funding:'+saved.projectId):undefined;
  setFundingDirty(!!funding);setUncertain(!!funding?.request);
  createdId.current=saved.projectId;creationAttempt.current=saved.creationAttempt;peopleRequest.current=saved.peopleRequest;
  setId(saved.projectId);setDraft(saved.values);setBase(saved.base);setPeople(saved.people??[]);setProjectType(saved.projectType??'');
  setPeopleProjectId(saved.peopleProjectId??'');
  setStep(funding?.request?3:saved.peopleProjectId?saved.step:Math.min(saved.step,reviewStep));
  setRecovery(undefined);
 }
 if(recovery)return <Modal isOpen title="Create project" description="An unfinished project draft is saved on this device." onClose={close} footer={<div className="pf-actions"><button type="button" disabled={!!recovery.creationAttempt} onClick={()=>{storeProjectDraft(recoveryKey);setRecovery(undefined);}}>Start new project</button><button type="button" className="pf-primary" onClick={()=>continueDraft(recovery)}>Continue draft</button></div>}/>;
 return <Modal isOpen title={projectId?'Project setup':'Create a project'} description="Set up the project, choose its team, and draft the work plan." width="max-w-7xl" className="pf-wizard-modal" bodyClassName="pf-wizard-body" footerClassName="pf-wizard-footer-shell" onClose={close} preventClose={locked} footer={<div className="pf-wizard-footer">
  <div className="pf-wizard-footer-left">{step>0&&<button type="button" disabled={locked||loading} onClick={()=>jump(step-1)}><ArrowLeft size={16}/>Back</button>}<p className="pf-wizard-footer-progress">Step {step+1} of {steps.length}<span>{steps[step].title}</span></p></div>
  <div className="pf-wizard-footer-actions">
   {step===tasksStep ? <button type="button" disabled={locked} onClick={close}>Open project<ArrowRight size={16}/></button> : step===peopleStep ? <button type="button" disabled={locked} onClick={()=>jump(tasksStep)}>Next: Draft tasks<ArrowRight size={16}/></button> : <>
    {editable&&<button type="button" disabled={locked||!draft.title.trim()||fundingDirty||uncertain} onClick={saveDraft}><Save size={16}/>Save draft and close</button>}
    <button type="button" className="pf-primary" disabled={locked||loading||uncertain||(step===reviewStep&&!editable)} onClick={next}>{locked?'Saving…':step===reviewStep?'Next: Add people':'Next'}<ArrowRight size={16}/></button>
   </>}
  </div>
 </div>}>
  <nav className="pf-wizard-steps" aria-label="Project setup steps">{steps.map((item,index)=><button type="button" key={item.title} disabled={locked||loading||uncertain||(index>=peopleStep&&!canOpenPeople)} onClick={()=>jump(index)} aria-current={step===index?'step':undefined} data-complete={complete[index]||false}><span>{complete[index]?<Check size={17}/>:<item.icon size={17}/>}</span><div><small>{String(index+1).padStart(2,'0')}</small><strong>{item.title}</strong></div></button>)}</nav>
  <div className="pf-wizard-content"><FlowError error={error||flow.error}/>{loading?<p role="status">Loading saved project setup…</p>:<>
   {step<3&&<div className={step===0?'pf-wizard-opening':undefined}>
    {step===0 ? <div className="pf-wizard-details">
     <ProjectSetupFields step={step} draft={draft} update={update} profiles={profiles} disabled={locked||!editable} officeName={officeName}/>
     {editable&&<div className="pf-wizard-fields"><label>Project type (optional)
      <select value={projectType} disabled={locked||templateLibrary.loading||!templateLibrary.templates.length} onChange={event=>setProjectType(event.target.value)}>
       <option value="">{templateLibrary.loading?'Loading project types…':'Choose a starter template'}</option>
       {templateLibrary.templates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}
      </select>
     </label></div>}
    </div> : <ProjectSetupFields step={step} draft={draft} update={update} profiles={profiles} disabled={locked||!editable} officeName={officeName}/>}
    {step===0&&<ProjectOpeningPreview title={draft.title}/>}
   </div>}
   <section hidden={step!==3} aria-label="Project funding step"><p className="pf-eyebrow">PROJECT FUNDING</p><h2>Set the funding sources</h2><p>Choose the fiscal year, Office Budget source and amount. The project total is calculated from those rows.</p><label className="pf-checkbox"><input type="checkbox" checked={draft.noFunding} disabled={!editable||!!flow.data?.funds.length||locked||fundingDirty||uncertain} onChange={e=>update('noFunding',e.target.checked)}/>No funding required for this project</label>{!draft.noFunding&&!detailsComplete&&<p className="pf-warning">Complete Details, Scope, and Lead &amp; dates before choosing funding.</p>}
    {!draft.noFunding&&detailsComplete&&busy&&needsFundingDetails&&<p role="status">Saving project details…</p>}
    {!draft.noFunding&&detailsComplete&&!locked&&(needsFundingDetails&&error||flow.error)&&<button type="button" className="pf-funding-retry" onClick={needsFundingDetails?prepareFunding:()=>void perform(flow.reload)}>Retry loading funding sources</button>}
    {!draft.noFunding&&id&&base&&flow.data?.project.id===id&&<fieldset disabled={busy||dirty||!detailsComplete} className="min-w-0"><ProjectFundingPanel key={id} wizard recoveryKey={fundingRecoveryKey} data={flow.data} reload={flow.reload} onBusyChange={setFundingBusy} onDraftChange={setFundingDirty} onUncertainChange={setUncertain}/></fieldset>}</section>
   {step===reviewStep&&<section className="pf-wizard-review"><p className="pf-eyebrow">REVIEW</p><h2>Ready to build the work plan?</h2><h3>{draft.title}</h3><p>{draft.description}</p><dl><div><dt>Scope</dt><dd>{draft.scope}</dd></div><div><dt>Project lead</dt><dd>{profiles.find(p=>p.id===draft.lead)?.full_name||'Assigned project lead'}</dd></div><div><dt>Timeline</dt><dd>{draft.start} → {draft.end}</dd></div><div><dt>Project budget</dt><dd>{draft.noFunding?'No funding required':`₱${(flow.data?.total||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`}</dd></div></dl>{!draft.noFunding&&<ul className="pf-review-sources">{flow.data?.funds.map(source=><li key={source.id}><span>FY {source.fiscal_year} · {source.name}</span><strong>₱{source.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></li>)}</ul>}<p>Continue to choose your team, or open the project and add people later.</p>{!projectId&&!peopleProjectId&&<ProjectSetupPeople profiles={profiles} lead={draft.lead} selected={people} onChange={setPeople} officeName={officeName} disabled={locked||!!peopleRequest.current}/>}</section>}
   {step===peopleStep&&peopleProjectId&&<SetupPeople key={peopleProjectId} projectId={peopleProjectId} projectTitle={draft.title} projectLeadId={draft.lead} projectStatus={flow.data?.project.status||'planning'} governed={governed} profiles={profiles} profilesLoading={profilesLoading} organizations={organizations} tasks={tasks} onClose={()=>setStep(tasksStep)}/>}
   {step===tasksStep&&peopleProjectId&&<ProjectTaskDraftStep key={peopleProjectId} projectId={peopleProjectId} project={draft} templates={templateLibrary.templates} templateError={templateLibrary.error} initialTemplate={templateLibrary.templates.find(template=>template.id===projectType)} onSaved={()=>finish(peopleProjectId)} onBusyChange={setTaskDraftBusy}/>}
  </>}</div>
 </Modal>;
}

function SetupPeople({projectId,...props}: {projectId:string} & Parameters<typeof ProjectPeoplePage>[0]){
 const offices=useProjectOffices(projectId);
 return <ProjectOfficeContext.Provider value={offices}><ProjectPeoplePage {...props} embedded/></ProjectOfficeContext.Provider>;
}
