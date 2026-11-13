import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ClipboardList,Layers,Users,CalendarDays,Wallet,ShieldCheck,Save} from 'lucide-react';
import {Modal} from '../../../components/ui/Modal';
import type {UserProfile} from '../../../types';
import {requestNavigation,useNavigationBlocker} from '../../../shared/navigationGuard';
import {useProjectFlow} from '../useProjectFlow';
import {ProjectFlowError,projectFlowCall,readProjectFlow} from '../services/projectFlow';
import {readProjectDraft,storeProjectDraft,type ProjectDraftRecovery} from '../projectDraftRecovery';
import {readFundingDraft} from '../fundingDraftRecovery';
import type {ProjectFlow} from '../types';
import {FlowError} from './FlowError';
import {ProjectFundingPanel} from './ProjectFundingPanel';
import {ProjectOpeningPreview} from './ProjectOpeningPreview';
import {ProjectSetupFields,type SetupDraft} from './ProjectSetupFields';
import {ProjectSetupPeople} from './ProjectSetupPeople';
import '../projectSetup.css';
import '../projectWizardDesign.css';
const steps=[{title:'Details',icon:ClipboardList},{title:'Scope',icon:Layers},{title:'Lead & dates',icon:CalendarDays},{title:'Funding',icon:Wallet},{title:'People',icon:Users},{title:'Review',icon:ShieldCheck}];
const empty:SetupDraft={title:'',description:'',scope:'',lead:'',start:'',end:'',noFunding:false};
const fields=(p:ProjectFlow['project']):SetupDraft=>({title:p.title,description:p.description,scope:p.scope,lead:p.project_lead_id||'',start:p.start_date||'',end:p.target_date||'',noFunding:p.funding_not_required});
export function ProjectSetupWizard({profiles,officeName,createDraft,onClose,onFinish,recoveryKey}:{profiles:UserProfile[];officeName?:string;createDraft:(title:string,requestId:string)=>Promise<string>;onClose:(id?:string)=>void;onFinish:(id:string)=>void;recoveryKey:string}){
 const [recovery,setRecovery]=useState(()=>readProjectDraft(recoveryKey));
 const [id,setId]=useState(''),[draft,setDraft]=useState<SetupDraft>(empty),[base,setBase]=useState<ProjectFlow['project']>(),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[fundingBusy,setFundingBusy]=useState(false),[fundingDirty,setFundingDirty]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const flow=useProjectFlow(id,!!id&&!!base),pending=useRef(false),createdId=useRef(id),creationAttempt=useRef<ProjectDraftRecovery['creationAttempt']>(undefined),finished=useRef(false);
 const [people,setPeople]=useState<string[]>([]),peopleRequest=useRef<ProjectDraftRecovery['peopleRequest']>(undefined);
 const loading=!!id&&!!base&&!flow.data&&!flow.error;
 const fundingRecoveryKey=recoveryKey&&id?recoveryKey+':funding:'+id:'';
 const editable=!id||flow.data?.canAuthorize===true||!base&&!flow.error,locked=busy||fundingBusy;
 const dirty=JSON.stringify(draft)!==JSON.stringify(base?fields(base):empty);
 const noFunding=draft.noFunding&&!flow.data?.total;
 const [localSaved,setLocalSaved]=useState(false);
 const content=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(content.current)content.current.scrollTop=0;},[step]);
 useEffect(()=>{
  if(recovery||finished.current||!id&&!dirty&&!creationAttempt.current)return;
  setLocalSaved(storeProjectDraft(recoveryKey,{values:draft,step,projectId:id,base,people,peopleRequest:peopleRequest.current,creationAttempt:creationAttempt.current}));
 },[recoveryKey,recovery,draft,step,id,base,dirty,people]);
 useNavigationBlocker({label:'Project creation',identity:recoveryKey,dirty:dirty&&!localSaved,pending:locked,pendingCheck:()=>pending.current,onDiscard:()=>{setDraft(base?fields(base):empty);setError('');}});
 const close=()=>void requestNavigation(()=>onClose());
 function continueDraft(saved:ProjectDraftRecovery){
  const funding=recoveryKey&&saved.projectId&&readFundingDraft(recoveryKey+':funding:'+saved.projectId);
  if(funding){setFundingDirty(true);setUncertain(!!funding.request);}
  setPeople(saved.people??[]);peopleRequest.current=saved.peopleRequest;createdId.current=saved.projectId;creationAttempt.current=saved.creationAttempt;
  setId(saved.projectId);setDraft(saved.values);setBase(saved.base);setStep(funding&&funding.request?3:saved.step);setRecovery(undefined);
 }
 const update=(key:keyof SetupDraft,value:string|boolean)=>setDraft(current=>({...current,[key]:value}));
 async function persist(){
  let target=createdId.current;
  if(!draft.title.trim())throw new Error('Enter a project title before saving.');
  if(!target){
   creationAttempt.current??={id:crypto.randomUUID(),title:draft.title.trim()};
   storeProjectDraft(recoveryKey,{values:draft,step,projectId:'',people,creationAttempt:creationAttempt.current});
   try{target=await createDraft(creationAttempt.current.title,creationAttempt.current.id);}
   catch(error){
    if(error instanceof ProjectFlowError){
     creationAttempt.current=undefined;
     storeProjectDraft(recoveryKey,{values:draft,step,projectId:'',people});
    }
    throw error;
   }
   createdId.current=target;creationAttempt.current=undefined;setId(target);
   storeProjectDraft(recoveryKey,{values:draft,step,projectId:target,people});
  }
  const latest=await readProjectFlow(target);let current=latest.project;const metadata=(p:ProjectFlow['project'])=>JSON.stringify({...fields(p),noFunding:false});
  if(!latest.canAuthorize)throw new Error('Only the appointed Office Head can save this project setup.');
  const proposed={...draft,title:draft.title.trim(),noFunding:latest.total>0?false:draft.noFunding};
  if(JSON.stringify(proposed)!==JSON.stringify(fields(current))){
   if(base&&current.updated_at!==base.updated_at&&metadata(current)!==metadata(base)){
    throw new Error('This project changed elsewhere. Your draft is retained. Open Project Settings to review the latest details.');
   }
   current=await projectFlowCall<ProjectFlow['project']>('save_project_definition',{p_project:target,p_details:{...proposed,version:current.updated_at}});
  }
  const savedValues=fields(current);
  setBase(current);setDraft(savedValues);
  storeProjectDraft(recoveryKey,{values:savedValues,step,projectId:target,base:current,people,peopleRequest:peopleRequest.current});
  return target;
 }
 async function perform(action:()=>Promise<void>){
  if(pending.current||fundingBusy)return;
  if(!navigator.onLine){setError(localSaved?'You’re offline. Your draft is saved on this device.':'You’re offline. Keep this dialog open and reconnect to save your draft.');return;}
  pending.current=true;setBusy(true);setError('');
  try{await action();}catch(caught){
   setError(creationAttempt.current?'Could not confirm project creation. Retry to check the same request.':
    caught instanceof Error&&!/failed to fetch|networkerror|load failed|timeout/i.test(caught.message)?caught.message:'Could not confirm the save. Check your connection and retry.');
  }finally{pending.current=false;setBusy(false);}
 }
 function validate(index:number){
  if(index===0&&(!draft.title.trim()||!draft.description.trim()))throw new Error('Enter the project title and description before continuing.');
  if(index===1&&!draft.scope.trim())throw new Error('Define the project scope before continuing.');
  if(index===2&&!leadAndDatesComplete)throw new Error('Choose an active Project Lead and valid project start and target dates.');
 }
 const next=()=>{
  if(step<3||step===4){
   try{validate(step);setError('');setStep(value=>value+1);}
   catch(caught){setError((caught as Error).message);}
   return;
  }
  void perform(async()=>{
   if(fundingDirty||uncertain)throw new Error('Authorize the funding rows or clear the unsaved entries before continuing.');
   if(!noFunding&&!(flow.data&&flow.data.total>0))throw new Error('Authorize project funding, or choose No funding required.');
   if(dirty||!id){validate(0);validate(1);validate(2);await persist();}
   setStep(4);
  });
 };
 const clearRecovery=()=>{finished.current=true;storeProjectDraft(recoveryKey);};
 async function savePeople(target:string){
  if(!people.length&&!peopleRequest.current)return;
  peopleRequest.current??={id:crypto.randomUUID(),users:[...people]};
  storeProjectDraft(recoveryKey,{values:draft,step,projectId:target,base,people,peopleRequest:peopleRequest.current});
  await projectFlowCall('save_private_project_people',{p_project:target,p_users:peopleRequest.current.users,p_key:peopleRequest.current.id});
  peopleRequest.current=undefined;
 }
 const finish=()=>void perform(async()=>{validate(0);validate(1);validate(2);if(fundingDirty||uncertain)throw new Error('Save or remove the funding entries first.');if(!noFunding&&!(flow.data&&flow.data.total>0))throw new Error('Add project funding or select No funding required.');const target=await persist();await projectFlowCall('finish_project_setup',{p_project:target});await savePeople(target);clearRecovery();await flow.reload();window.dispatchEvent(new Event('eflow:project-setup'));window.setTimeout(()=>onFinish(target),0);});
 const saveDraft=()=>void perform(async()=>{
  const target=await persist();
  if(!people.length&&!peopleRequest.current)clearRecovery();
  window.dispatchEvent(new Event('eflow:project-setup'));
  window.setTimeout(()=>onClose(target),0);
 });
 const back=()=>{if(uncertain)return;setError('');setStep(value=>Math.max(0,value-1));};
 const jump=(index:number)=>{if(locked||loading||uncertain)return;setError('');setStep(index);};
 const leadAndDatesComplete=profiles.some(person=>person.id===draft.lead&&person.is_active!==false&&!['admin','super_admin','viewer'].includes(person.role))
  &&/^\d{4}-\d{2}-\d{2}$/.test(draft.start)&&/^\d{4}-\d{2}-\d{2}$/.test(draft.end)&&draft.end>=draft.start;
 const complete=[!!draft.title.trim()&&!!draft.description.trim(),!!draft.scope.trim(),leadAndDatesComplete,(noFunding||!!flow.data?.total)&&!fundingDirty&&!uncertain];
 const detailsComplete=complete.slice(0,3).every(Boolean);
 const needsFundingDetails=step===3&&!noFunding&&detailsComplete&&editable&&(!id||!base||dirty);
 const prepareFunding=()=>void perform(async()=>{await persist();if(base&&id)await flow.reload();});
 const prepareFundingRef=useRef(prepareFunding);
 prepareFundingRef.current=prepareFunding;
 useEffect(()=>{
  if(needsFundingDetails)prepareFundingRef.current();
 },[needsFundingDetails,draft]);
 if(recovery)return <Modal isOpen title="Create project" description="An unfinished project draft is saved on this device." onClose={close}
  footer={<div className="pf-actions"><button type="button" disabled={!!recovery.creationAttempt} onClick={()=>{storeProjectDraft(recoveryKey);setRecovery(undefined);}}>Start new project</button>
  <button type="button" className="pf-primary" onClick={()=>continueDraft(recovery)}>Continue draft</button></div>}>
  {recovery.creationAttempt&&<p role="status">Continue to verify the previous creation request.</p>}
 </Modal>;
 return <Modal isOpen title="Create project" description="Define the project first. Add tasks and people after setup is complete." width="max-w-7xl" className="pf-wizard-modal" bodyClassName="pf-wizard-body" footerClassName="pf-wizard-footer-shell" onClose={close} preventClose={locked} footer={<div className="pf-wizard-footer"><div className="pf-wizard-footer-left">{step>0&&<button type="button" disabled={locked||loading||uncertain} onClick={back}><ArrowLeft size={16}/>Back</button>}<p className="pf-wizard-footer-progress">Step {step+1} of {steps.length}<span>{steps[step].title}</span></p></div><div className="pf-wizard-footer-actions">{editable&&<button type="button" disabled={locked||!draft.title.trim()||fundingDirty||uncertain} onClick={saveDraft}><Save size={16}/>Save draft and close</button>}{step<5?<button type="button" className="pf-primary" disabled={locked||loading||uncertain} onClick={next}>{locked?'Saving…':'Next'}<ArrowRight size={16}/></button>:<button type="button" className="pf-primary" disabled={locked||!editable} onClick={finish}><Check size={16}/>{locked?'Finishing…':'Create project'}</button>}</div></div>}>
  <nav className="pf-wizard-steps" aria-label="Project setup steps">{steps.map((item,index)=><button type="button" key={item.title} disabled={locked||loading||uncertain} onClick={()=>jump(index)} aria-current={step===index?'step':undefined} data-complete={complete[index]||false}><span>{complete[index]?<Check size={17}/>:<item.icon size={17}/>}</span><div><small>{String(index+1).padStart(2,'0')}</small><strong>{item.title}</strong></div></button>)}</nav>
  <div ref={content} className="pf-wizard-content" role="region" aria-label={steps[step].title} tabIndex={0}>
   <FlowError error={error||flow.error}/>
   {loading&&step!==3?<p role="status">Loading saved project details…</p>:<>
    {step<3&&<div className={step===0?'pf-wizard-opening':undefined}>
     <ProjectSetupFields step={step} draft={draft} update={update} profiles={profiles} disabled={locked||!editable} officeName={officeName}/>
     {step===0&&<ProjectOpeningPreview title={draft.title}/>}
    </div>}
    <section hidden={step!==3} aria-label="Project funding step">
     <p className="pf-eyebrow">PROJECT FUNDING</p>
     <h2>Set the funding sources</h2>
     <p>Choose the fiscal year, Office Budget sources, and amounts. The project total is calculated from those rows.</p>
     <label className="pf-checkbox"><input type="checkbox" checked={noFunding} disabled={!editable||!!flow.data?.total||locked||loading||fundingDirty||uncertain} onChange={e=>update('noFunding',e.target.checked)}/>No funding required for this project</label>
     {!noFunding&&<>
      {!detailsComplete&&<p className="pf-warning">Complete Details, Scope, and Lead &amp; dates to load Office Budget sources.</p>}
      {detailsComplete&&busy&&needsFundingDetails&&<p className="pf-wizard-funding-loading" role="status">Saving project details…</p>}
      {detailsComplete&&(!flow.data&&!flow.error)&&(loading||busy&&!needsFundingDetails)&&<p className="pf-wizard-funding-loading" role="status">Loading Office Budget sources…</p>}
      {detailsComplete&&!locked&&needsFundingDetails&&error&&<button type="button" className="pf-funding-retry" onClick={prepareFunding}>Retry loading funding sources</button>}
      {detailsComplete&&!locked&&flow.error&&!needsFundingDetails&&<button type="button" className="pf-funding-retry" onClick={()=>void perform(flow.reload)}>Retry loading funding sources</button>}
      {flow.data&&id&&<fieldset disabled={busy||dirty||!detailsComplete||!!flow.error} className="min-w-0">
       <ProjectFundingPanel key={id} wizard recoveryKey={fundingRecoveryKey} data={flow.data} reload={flow.reload} onBusyChange={setFundingBusy} onDraftChange={setFundingDirty} onUncertainChange={setUncertain}/>
      </fieldset>}
     </>}
    </section>
   {step===4&&<ProjectSetupPeople profiles={profiles} lead={draft.lead} selected={people} onChange={setPeople} officeName={officeName} disabled={locked||!editable||!!peopleRequest.current}/>}
   {step===5&&<section className="pf-wizard-review"><p className="pf-eyebrow">REVIEW</p><h2>Ready to build the work plan?</h2><h3>{draft.title}</h3><p>{draft.description}</p><dl><div><dt>Scope</dt><dd>{draft.scope}</dd></div><div><dt>Project lead</dt><dd>{profiles.find(p=>p.id===draft.lead)?.full_name||'Assigned project lead'}</dd></div><div><dt>Timeline</dt><dd>{draft.start} → {draft.end}</dd></div><div><dt>Project budget</dt><dd>{noFunding?'No funding required':`₱${(flow.data?.total||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`}</dd></div></dl>{!noFunding&&<ul className="pf-review-sources">{flow.data?.funds.map(source=><li key={source.id}><span>FY {source.fiscal_year} · {source.name}</span><strong>₱{source.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></li>)}</ul>}<p>Finish setup to add tasks, and subtasks. Activation remains subject to the project checks.</p></section>}
  </>}</div>
 </Modal>;
}
