import { readableUiError } from '../../../shared/userFacingError';
import {useEffect,useId,useRef,useState} from 'react';
import {Button} from '@vibe/core';
import {ArrowLeft,ArrowRight,CalendarDays,Check,ClipboardList,Layers,Wallet,ShieldCheck,Save,FileUp} from 'lucide-react';
import {FeedbackState} from '../../../components/ui/FeedbackState';
import {Modal} from '../../../components/ui/Modal';
import {ProjectPdfImportPanel} from '../../project-import';
import {ProjectTaskTemplateLibrary} from '../../work-templates';
import {ProjectOpeningPreview} from './ProjectOpeningPreview';
import type {Organization,UserProfile} from '../../../types';
import type {Task} from '../../tasks';
import {requestNavigation,useNavigationBlocker} from '../../../shared/navigationGuard';
import {scheduledDateError} from '../../../shared/calendarDates';
import {useProjectFlow} from '../useProjectFlow';
import {ProjectFlowError,projectFlowCall,readProjectFlow} from '../services/projectFlow';
import {readProjectDraft,storeProjectDraft,type ProjectDraftRecovery} from '../projectDraftRecovery';
import {readFundingDraft} from '../fundingDraftRecovery';
import type {ProjectFlow} from '../types';
import {FlowError} from './FlowError';
import {ProjectFundingPanel} from './ProjectFundingPanel';
import {ProjectSetupFields,type SetupDraft} from './ProjectSetupFields';
import { ProjectTaskDraftStep } from './ProjectTaskDraftStep';
import { useProjectTaskTemplates } from '../useProjectTaskTemplates';
import '../projectSetup.css';
import '../projectWizardDesign.css';
const steps=[{title:'Details',icon:ClipboardList},{title:'Scope',icon:Layers},{title:'Dates',icon:CalendarDays},{title:'Funding',icon:Wallet},{title:'Review',icon:ShieldCheck},{title:'Draft tasks',icon:ClipboardList}];
const datesStep=2,fundingStep=3,reviewStep=4,tasksStep=5;
const projectStartError=(start:string,original='')=>scheduledDateError(start,{original,label:'Project start date'});
const hasValidDates=({start,end}:SetupDraft,originalStart?:string)=>!!start&&!!end&&start<=end&&!projectStartError(start,originalStart);
const empty:SetupDraft={title:'',description:'',scope:'',lead:'',start:'',end:'',noFunding:false};
const fields=(p:ProjectFlow['project']):SetupDraft=>({title:p.title,description:p.description,scope:p.scope,lead:p.project_lead_id||'',start:p.start_date||'',end:p.target_date||'',noFunding:p.funding_not_required});
export function ProjectSetupWizard({projectId,profiles,profilesLoading: _profilesLoading,organizations: _organizations=[],tasks: _tasks=[],governed: _governed=false,officeName: _officeName,creatorId,recoveryKey='',createDraft,onClose,onFinish,initialStep=0,importPdf=false}:{projectId?:string;profiles:UserProfile[];profilesLoading?:boolean;organizations?:Organization[];tasks?:Task[];governed?:boolean;officeName?:string;creatorId?:string;recoveryKey?:string;createDraft?:(title:string,requestId:string)=>Promise<string>;onClose:(id?:string)=>void;onFinish:(id:string)=>void;initialStep?:number;importPdf?:boolean}){
 const [id,setId]=useState(projectId||''),[draft,setDraft]=useState<SetupDraft>(()=>({...empty,lead:creatorId||''})),[base,setBase]=useState<ProjectFlow['project']>(),[step,setStep]=useState(initialStep),[busy,setBusy]=useState(false),[fundingBusy,setFundingBusy]=useState(false),[fundingDirty,setFundingDirty]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const [pdfMode,setPdfMode]=useState(importPdf);
 const wizardSteps=pdfMode?[...steps.slice(0,tasksStep),{title:'Import AI PDF',icon:FileUp}]:steps;
 const activeTasksStep=tasksStep;
 const [recovery,setRecovery]=useState(()=>projectId?undefined:readProjectDraft(recoveryKey));
 const creationAttempt=useRef<ProjectDraftRecovery['creationAttempt']>(undefined),finished=useRef(false);
 const [readyProjectId,setReadyProjectId]=useState('');
 const flow=useProjectFlow(id,!!id),pending=useRef(false),createdId=useRef(id),hydrated=useRef(!projectId);
 const [optimisticFlow,setOptimisticFlow]=useState<{projectId:string;flow:ProjectFlow}>();
 const activeFlow=flow.data?.project.id===id?(base?.id===id?{...flow.data,project:base}:flow.data):optimisticFlow?.projectId===id?optimisticFlow.flow:undefined;
 useEffect(()=>{if(flow.data&&!hydrated.current){hydrated.current=true;setBase(flow.data.project);setDraft({...fields(flow.data.project),lead:creatorId||flow.data.project.project_lead_id||''});}},[flow.data?.project.id]);
 const [taskDraftBusy,setTaskDraftBusy]=useState(false);
 const actionId=useId(),tasksFormId=actionId+'-tasks';
 const [taskAction,setTaskAction]=useState({label:'Open project',disabled:false});
 const [projectType,setProjectType]=useState('');
 const [manageTemplatesOpen,setManageTemplatesOpen]=useState(false);
 const [templateInitialCreate,setTemplateInitialCreate]=useState(false);
 const editable=!projectId||flow.data?.canAuthorize===true,locked=busy||fundingBusy||taskDraftBusy;
 const templateLibrary=useProjectTaskTemplates(editable&&!pdfMode);
 const selectedTemplate=templateLibrary.templates.find(template=>template.id===projectType);
 const dirty=JSON.stringify(draft)!==JSON.stringify(base?fields(base):{...empty,lead:creatorId||''});
 const [localSaved,setLocalSaved]=useState(false);
 const fundingRecoveryKey=recoveryKey&&id?recoveryKey+':funding:'+id:'';
 useNavigationBlocker({label:'Project setup',identity:id||'new-project',dirty:dirty&&!localSaved,pending:locked,pendingCheck:()=>pending.current,onDiscard:()=>{setDraft(base?fields(base):{...empty,lead:creatorId||''});setError('');}});
 useEffect(()=>{
  if(recoveryKey&&!recovery&&!finished.current&&(id||dirty||creationAttempt.current)){
   setLocalSaved(storeProjectDraft(recoveryKey,{values:draft,step,projectId:id,base,creationAttempt:creationAttempt.current,projectType,readyProjectId,importPdf:pdfMode}));
  }
 },[recoveryKey,recovery,draft,step,id,base,dirty,projectType,readyProjectId,pdfMode]);
 const finish=(target:string)=>{finished.current=true;if(recoveryKey)storeProjectDraft(recoveryKey);onFinish(target);};
 const close=()=>void requestNavigation(() => readyProjectId ? finish(readyProjectId) : onClose(createdId.current||undefined));
 const update=(key:keyof SetupDraft,value:string|boolean)=>setDraft(current=>({...current,[key]:value}));
 const originalStart=projectId?base?.start_date??'':'';
 async function persist(){
  let target=createdId.current;
  if(!draft.title.trim())throw new Error('Enter a project title before saving.');
  const startError=projectStartError(draft.start,originalStart);
  if(startError)throw new Error(startError);
  if(!target){
   if(!createDraft)throw new Error('Project creation is unavailable.');
   creationAttempt.current??={id:crypto.randomUUID(),title:draft.title.trim()};
   storeProjectDraft(recoveryKey,{values:draft,step,projectId:'',projectType,importPdf:pdfMode,creationAttempt:creationAttempt.current});
   try{target=await createDraft(creationAttempt.current.title,creationAttempt.current.id);}
   catch(error){
    if(error instanceof ProjectFlowError){
     creationAttempt.current=undefined;
     storeProjectDraft(recoveryKey,{values:draft,step,projectId:'',projectType,importPdf:pdfMode});
    }
    throw error;
   }
   createdId.current=target;creationAttempt.current=undefined;setId(target);
   storeProjectDraft(recoveryKey,{values:draft,step,projectId:target,projectType,importPdf:pdfMode});
  }

  if(target&&base&&!dirty)return target;
  const latest=await readProjectFlow(target);let current=latest.project;const metadata=(p:ProjectFlow['project'])=>JSON.stringify({...fields(p),noFunding:false});
  if(base&&current.updated_at!==base.updated_at&&metadata(current)!==metadata(base))throw new Error('Project details changed elsewhere. Your entries are retained; close and reopen setup to review the current project before saving.');
  const proposed={...draft,lead:creatorId||draft.lead,noFunding:latest.total>0?false:draft.noFunding};
  if(JSON.stringify(proposed)!==JSON.stringify(fields(current))){current=await projectFlowCall<ProjectFlow['project']>('save_project_definition',{p_project:target,p_details:{...proposed,version:current.updated_at}});setReadyProjectId('');}
  setBase(current);setDraft(fields(current));setOptimisticFlow({projectId:target,flow:{...latest,project:current}});return target;
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
   setError(creationAttempt.current?"We couldn't confirm whether the project was created. Keep this setup open and try again here; don't start another project.":
    e instanceof Error?e.message:'Could not save project setup.');
  }finally{pending.current=false;setBusy(false);}
 }
 function validate(index:number){
  if(index===0&&(!draft.title.trim()||!draft.description.trim()))throw new Error('Enter the project title and description before continuing.');
  if(index===1&&!draft.scope.trim())throw new Error('Define the project scope before continuing.');
  if(index===datesStep){
   const startError=projectStartError(draft.start,originalStart);
   if(startError)throw new Error(startError);
   if(!draft.start||!draft.end||draft.end<draft.start)throw new Error('Enter a project start date and a target date on or after it.');
  }
 }
 const next=()=>{
  if(step<fundingStep){
   try{validate(step);setError('');setStep(value=>value+1);}
   catch(e){setError(readableUiError(e, "Check the project details before continuing.", 'write'));}
   return;
  }
  void perform(async()=>{
  validate(0);validate(1);validate(datesStep);
  if(step===reviewStep){
   if(fundingDirty||uncertain)throw new Error('Save or remove the funding entries first.');
   if(!draft.noFunding&&!(activeFlow&&activeFlow.total>0))throw new Error('Add project funding or select No funding required.');
   const target=await persist();
   await projectFlowCall('finish_project_setup',{p_project:target});
   setReadyProjectId(target);
   setStep(activeTasksStep);
   void flow.reload();
   window.dispatchEvent(new Event('eflow:project-setup'));
   return;
  }
  if(fundingDirty||uncertain)throw new Error('Authorize the funding rows or clear the unsaved entries before continuing.');
  if(!draft.noFunding&&!(activeFlow&&activeFlow.total>0))throw new Error('Authorize project funding, or explicitly choose No funding required.');
  if(dirty||!base){await persist();void flow.reload();}setStep(reviewStep);
  });
 };
 const saveDraft=()=>void perform(async()=>{await persist();window.dispatchEvent(new Event('eflow:project-setup'));window.setTimeout(()=>onClose(createdId.current),0);});
 const loading=!!projectId&&!hydrated.current;
 const datesComplete=hasValidDates(draft,originalStart);
 const canOpenTasks=!!readyProjectId&&datesComplete&&!dirty&&!fundingDirty;
 const jump=(index:number)=>{
  if(locked||loading||uncertain||(index>reviewStep&&!canOpenTasks)||index===step)return;
  const change=()=>{
   setError('');
   setStep(index);
  };
  if(step>reviewStep)void requestNavigation(change);else change();
 };
 const complete=[!!draft.title.trim()&&!!draft.description.trim(),!!draft.scope.trim(),datesComplete,(draft.noFunding||!!activeFlow?.total)&&!fundingDirty&&!uncertain,canOpenTasks,false];
 const detailsComplete=complete.slice(0,fundingStep).every(Boolean);
 const needsFundingDetails=!recovery&&step===fundingStep&&!draft.noFunding&&!uncertain&&detailsComplete&&editable&&(!id||!base||dirty);
 const prepareFunding=()=>void perform(async()=>{await persist();if(id&&base)void flow.reload();});
 const prepareFundingRef=useRef(prepareFunding);
 prepareFundingRef.current=prepareFunding;
 useEffect(()=>{if(needsFundingDetails)prepareFundingRef.current();},[needsFundingDetails,draft]);
 function continueDraft(saved:ProjectDraftRecovery){
  const funding=saved.projectId?readFundingDraft(recoveryKey+':funding:'+saved.projectId):undefined;
  setFundingDirty(!!funding);setUncertain(!!funding?.request);
  createdId.current=saved.projectId;creationAttempt.current=saved.creationAttempt;
  setId(saved.projectId);setDraft({...saved.values,...(creatorId?{lead:creatorId}:{})});setBase(saved.base);setProjectType(saved.projectType??'');
  const nextPdfMode=saved.importPdf??importPdf;
  const validDates=hasValidDates(saved.values);
  const restoredReadyId=validDates?(saved.readyProjectId??saved.peopleProjectId??''):'';
  const oldStep=saved.datesStep||saved.peopleProjectId!==undefined||saved.step>=tasksStep?saved.step:saved.step+Number(saved.step>=datesStep);
  const restoredStep=Math.min(oldStep,restoredReadyId?tasksStep:reviewStep);
  setReadyProjectId(restoredReadyId);
  setPdfMode(nextPdfMode);
  setStep(funding?.request?fundingStep:validDates?restoredStep:Math.min(restoredStep,datesStep));
  setRecovery(undefined);
 }
 if(recovery)return <Modal isOpen title="Create project" description="An unfinished project draft is saved on this device." onClose={close} footer={<div className="pf-actions"><button type="button" disabled={!!recovery.creationAttempt} onClick={()=>{storeProjectDraft(recoveryKey);setRecovery(undefined);}}>Start new project</button><button type="button" className="pf-primary" onClick={()=>continueDraft(recovery)}>Continue draft</button></div>}>{null}</Modal>;
 return <><Modal isOpen={!manageTemplatesOpen} title={projectId?'Project setup':pdfMode?'Create project with AI':'Create a project'} description={pdfMode?'Set up the project and import its work plan with AI.':'Set up the project and draft the work plan.'} width="max-w-7xl" className="pf-wizard-modal" bodyClassName="pf-wizard-body" footerClassName="pf-wizard-footer-shell" onClose={close} preventClose={locked} footer={<div className="pf-wizard-footer">
  <div className="pf-wizard-footer-left">{step>0&&<button type="button" disabled={locked||loading} onClick={()=>jump(step-1)}><ArrowLeft size={16}/>Back</button>}<p className="pf-wizard-footer-progress">Step {step+1} of {wizardSteps.length}<span>{wizardSteps[step].title}</span></p></div>
  <div className="pf-wizard-footer-actions">
   {step===activeTasksStep ? <button type={pdfMode?"button":"submit"} form={pdfMode?undefined:tasksFormId} className="pf-primary" disabled={locked||!pdfMode&&taskAction.disabled} onClick={pdfMode?close:undefined}>{pdfMode?'Open project':taskAction.label}<ArrowRight size={16}/></button> : <>
    {editable&&<button type="button" disabled={locked||!draft.title.trim()||fundingDirty||uncertain} onClick={saveDraft}><Save size={16}/>Save draft and close</button>}
    <button type="button" className="pf-primary" disabled={locked||loading||uncertain||(step===reviewStep&&!editable)} onClick={next}>{locked?'Saving…':step===reviewStep?(pdfMode?'Next: Import AI PDF':'Next: Draft tasks'):'Next'}<ArrowRight size={16}/></button>
   </>}
  </div>
 </div>}>
  <nav className="pf-wizard-steps" aria-label="Project setup steps">{wizardSteps.map((item,index)=><button type="button" key={item.title} disabled={manageTemplatesOpen||locked||loading||uncertain||(index>reviewStep&&!canOpenTasks)} onClick={()=>jump(index)} aria-current={step===index?'step':undefined} data-complete={complete[index]||false}><span>{complete[index]?<Check size={17}/>:<item.icon size={17}/>}</span><div><small>{String(index+1).padStart(2,'0')}</small><strong>{item.title}</strong></div></button>)}</nav>
  <div className="pf-wizard-content"><FlowError error={error||flow.error}/>{loading?<p role="status">Loading saved project setup…</p>:<>
   {step<fundingStep&&<div className={step===0?'pf-wizard-opening':undefined}>
    {step===0 ? <div className="pf-wizard-details">
     <ProjectSetupFields step={step} draft={draft} update={update} profiles={profiles} disabled={locked||!editable}/>
     {editable&&!pdfMode&&<div className="pf-wizard-fields pf-starter-block">
      <div className="pf-starter-header">
       <label>Project type (optional)
        <select value={projectType} disabled={locked||templateLibrary.loading||!templateLibrary.templates.length} onChange={event=>setProjectType(event.target.value)}>
         <option value="">{templateLibrary.loading?'Loading project types…':templateLibrary.templates.length?'Choose a starter template':'No templates yet — create one'}</option>
         {templateLibrary.templates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
       </label>
       <Button type="button" kind="secondary" size="small" disabled={locked} onClick={()=>{setTemplateInitialCreate(!templateLibrary.templates.length);setManageTemplatesOpen(true);}}>
        {templateLibrary.templates.length?'+ New / Manage templates':'Create template'}
       </Button>
      </div>
      {templateLibrary.error && (
       <FeedbackState tone="error" title="Could not load starter templates" onRetry={()=>void templateLibrary.reload()} pending={templateLibrary.loading}>
        {templateLibrary.error}
       </FeedbackState>
      )}
      {!templateLibrary.loading&&!templateLibrary.error&&!templateLibrary.templates.length&&(
       <p className="pf-starter-hint">Create a starter template to reuse standard task groups and subtasks across new projects.</p>
      )}
     </div>}
    </div> : <ProjectSetupFields step={step} draft={draft} update={update} profiles={profiles} disabled={locked||!editable}/>}
    {step===0&&<ProjectOpeningPreview title={draft.title} selectedTemplate={selectedTemplate}/>}
   </div>}
   <section hidden={step!==fundingStep} aria-label="Project funding step"><p className="pf-eyebrow">PROJECT FUNDING</p><h2>Set the funding sources</h2><p>Choose the Office Budget source and amount for the current fiscal year. The project total is calculated from those rows.</p><label className="pf-checkbox"><input type="checkbox" checked={draft.noFunding} disabled={!editable||!!activeFlow?.funds.length||locked||fundingDirty||uncertain} onChange={e=>update('noFunding',e.target.checked)}/>No funding required for this project</label>{!draft.noFunding&&!detailsComplete&&<p className="pf-warning">Complete Details, Scope and Dates before choosing funding.</p>}
    {!draft.noFunding&&detailsComplete&&busy&&needsFundingDetails&&<p role="status">Saving project details…</p>}
    {!draft.noFunding&&detailsComplete&&!locked&&(needsFundingDetails&&error||flow.error)&&<button type="button" className="pf-funding-retry" onClick={needsFundingDetails?prepareFunding:()=>void perform(flow.reload)}>Retry loading funding sources</button>}
    {!draft.noFunding&&id&&base&&activeFlow?.project.id===id&&<fieldset disabled={busy||(!uncertain&&(dirty||!detailsComplete))} className="min-w-0"><ProjectFundingPanel key={id} wizard recoveryKey={fundingRecoveryKey} data={activeFlow} reload={flow.reload} onBusyChange={setFundingBusy} onDraftChange={setFundingDirty} onUncertainChange={setUncertain}/></fieldset>}</section>
   {step===reviewStep&&<section className="pf-wizard-review"><p className="pf-eyebrow">REVIEW</p><h2>Ready to build the work plan?</h2><h3>{draft.title}</h3><p>{draft.description}</p><dl><div><dt>Scope</dt><dd>{draft.scope}</dd></div><div><dt>Project lead</dt><dd>{profiles.find(p=>p.id===draft.lead)?.full_name||'Assigned project lead'}</dd></div><div><dt>Timeline</dt><dd>{draft.start&&draft.end?`${draft.start} → ${draft.end}`:'Set automatically from tasks & subtasks'}</dd></div><div><dt>Project budget</dt><dd>{draft.noFunding?'No funding required':`₱${(activeFlow?.total||0).toLocaleString('en-US',{minimumFractionDigits:2})}`}</dd></div></dl>{!draft.noFunding&&<ul className="pf-review-sources">{activeFlow?.funds.map(source=><li key={source.id}><span>FY {source.fiscal_year} · {source.name}</span><strong>₱{source.amount.toLocaleString('en-US',{minimumFractionDigits:2})}</strong></li>)}</ul>}<p>{pdfMode?'Continue to import your proposal PDF with AI.':'Continue to draft tasks. You can assign people directly to tasks in Main table.'}</p></section>}
   {step===activeTasksStep&&readyProjectId&&(pdfMode
    ? <ProjectPdfImportPanel key={readyProjectId} projectId={readyProjectId} projectTitle={draft.title} startDate={draft.start} projectContext={{title:draft.title,description:draft.description,scope:draft.scope}} projectFunding={activeFlow?{fundingNotRequired:activeFlow.project.funding_not_required||draft.noFunding,total:activeFlow.total,unallocated:activeFlow.unallocated,funds:activeFlow.funds}:undefined} embedded onBusyChange={setTaskDraftBusy}/>
    : <ProjectTaskDraftStep formId={tasksFormId} onSaveStateChange={setTaskAction} key={readyProjectId} projectId={readyProjectId} project={draft} templates={templateLibrary.templates} templateError={templateLibrary.error} initialTemplate={selectedTemplate} onTemplateSaved={saved=>{void templateLibrary.reload();setProjectType(saved.id);}} onSaved={()=>finish(readyProjectId)} onBusyChange={setTaskDraftBusy}/>)}
  </>}</div>
 </Modal>
 {manageTemplatesOpen&&<Modal isOpen title="Project starter templates" description="Create and manage reusable task checklists." width="max-w-5xl" onClose={()=>{setManageTemplatesOpen(false);setTemplateInitialCreate(false);}}>
  <ProjectTaskTemplateLibrary compactHeader initialCreate={templateInitialCreate} onTemplatesChanged={saved=>{
   void templateLibrary.reload();
   if(saved?.id){setProjectType(saved.id);setManageTemplatesOpen(false);setTemplateInitialCreate(false);}
  }}/>
 </Modal>}
 </>;
}
