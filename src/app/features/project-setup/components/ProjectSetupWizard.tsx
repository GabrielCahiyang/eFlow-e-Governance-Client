import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ClipboardList,Layers,CalendarDays,Wallet,ShieldCheck,Save} from 'lucide-react';
import {Modal} from '../../../components/ui/Modal';
import {ProjectOpeningPreview} from './ProjectOpeningPreview';
import type {UserProfile} from '../../../types';
import {requestNavigation,useNavigationBlocker} from '../../../shared/navigationGuard';
import {useProjectFlow} from '../useProjectFlow';
import {projectFlowCall,readProjectFlow} from '../services/projectFlow';
import type {ProjectFlow} from '../types';
import {FlowError} from './FlowError';
import {ProjectFundingPanel} from './ProjectFundingPanel';
import {ProjectSetupFields,type SetupDraft} from './ProjectSetupFields';
import '../projectSetup.css';
import '../projectWizardDesign.css';
const steps=[{title:'Details',icon:ClipboardList},{title:'Scope',icon:Layers},{title:'Lead & dates',icon:CalendarDays},{title:'Funding',icon:Wallet},{title:'Review',icon:ShieldCheck}];
const empty:SetupDraft={title:'',description:'',scope:'',lead:'',start:'',end:'',noFunding:false};
const fields=(p:ProjectFlow['project']):SetupDraft=>({title:p.title,description:p.description,scope:p.scope,lead:p.project_lead_id||'',start:p.start_date||'',end:p.target_date||'',noFunding:p.funding_not_required});
export function ProjectSetupWizard({projectId,profiles,officeName,createDraft,onClose,onFinish,initialStep=0}:{projectId?:string;profiles:UserProfile[];officeName?:string;createDraft?:(title:string)=>Promise<string>;onClose:()=>void;onFinish:(id:string)=>void;initialStep?:number}){
 const [id,setId]=useState(projectId||''),[draft,setDraft]=useState<SetupDraft>(empty),[base,setBase]=useState<ProjectFlow['project']>(),[step,setStep]=useState(initialStep),[busy,setBusy]=useState(false),[fundingBusy,setFundingBusy]=useState(false),[fundingDirty,setFundingDirty]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const flow=useProjectFlow(id,!!id),pending=useRef(false),createdId=useRef(id),hydrated=useRef(!projectId);
 useEffect(()=>{if(flow.data&&!hydrated.current){hydrated.current=true;setBase(flow.data.project);setDraft(fields(flow.data.project));}},[flow.data?.project.id]);
 const editable=!projectId||flow.data?.canAuthorize===true,locked=busy||fundingBusy;
 const dirty=JSON.stringify(draft)!==JSON.stringify(base?fields(base):empty);
 useNavigationBlocker({label:'Project setup',identity:id||'new-project',dirty,pending:locked,pendingCheck:()=>pending.current,onDiscard:()=>{setDraft(base?fields(base):empty);setError('');}});
 const close=()=>void requestNavigation(onClose);
 const update=(key:keyof SetupDraft,value:string|boolean)=>setDraft(current=>({...current,[key]:value}));
 async function persist(){
  let target=createdId.current;
  if(!draft.title.trim())throw new Error('Enter a project title before saving.');
  if(!target){if(!createDraft)throw new Error('Project creation is unavailable.');target=await createDraft(draft.title.trim());createdId.current=target;setId(target);}
  const latest=await readProjectFlow(target);let current=latest.project;const metadata=(p:ProjectFlow['project'])=>JSON.stringify({...fields(p),noFunding:false});
  if(base&&current.updated_at!==base.updated_at&&metadata(current)!==metadata(base))throw new Error('Project details changed elsewhere. Your entries are retained; close and reopen setup to review the current project before saving.');
  const proposed={...draft,noFunding:latest.total>0?false:draft.noFunding};
  if(JSON.stringify(proposed)!==JSON.stringify(fields(current))){current=await projectFlowCall<ProjectFlow['project']>('save_project_definition',{p_project:target,p_details:{...proposed,version:current.updated_at}});}
  setBase(current);setDraft(fields(current));return target;
 }
 async function perform(action:()=>Promise<void>){if(pending.current||fundingBusy)return;pending.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Could not save project setup.');}finally{pending.current=false;setBusy(false);}}
 function validate(index:number){
  if(index===0&&(!draft.title.trim()||!draft.description.trim()))throw new Error('Enter the project title and description before continuing.');
  if(index===1&&!draft.scope.trim())throw new Error('Define the project scope before continuing.');
  if(index===2&&(!draft.lead||!draft.start||!draft.end||draft.end<draft.start))throw new Error('Choose an active project lead and valid project start and target dates.');
 }
 const next=()=>void perform(async()=>{
  if(step<3){validate(step);if(step===2){await persist();await flow.reload();}setStep(value=>value+1);return;}
  if(fundingDirty||uncertain)throw new Error('Authorize the funding rows or clear the unsaved entries before continuing.');
  if(!draft.noFunding&&!(flow.data&&flow.data.total>0))throw new Error('Authorize project funding, or explicitly choose No funding required.');
  await persist();await flow.reload();setStep(4);
 });
 const finish=()=>void perform(async()=>{validate(0);validate(1);validate(2);if(fundingDirty||uncertain)throw new Error('Save or remove the funding entries first.');if(!draft.noFunding&&!(flow.data&&flow.data.total>0))throw new Error('Add project funding or select No funding required.');const target=await persist();await projectFlowCall('finish_project_setup',{p_project:target});await flow.reload();window.dispatchEvent(new Event('eflow:project-setup'));window.setTimeout(()=>onFinish(target),0);});
 const saveDraft=()=>void perform(async()=>{await persist();window.dispatchEvent(new Event('eflow:project-setup'));window.setTimeout(onClose,0);});
 const back=()=>{setError('');setStep(value=>Math.max(0,value-1));};
 const loading=!!projectId&&!hydrated.current;
 const jump=(index:number)=>{if(locked||loading||uncertain)return;setError('');setStep(index);};
 const complete=[!!draft.title.trim()&&!!draft.description.trim(),!!draft.scope.trim(),!!draft.lead&&!!draft.start&&!!draft.end&&draft.end>=draft.start,(draft.noFunding||!!flow.data?.total)&&!fundingDirty&&!uncertain];
 const detailsComplete=complete.slice(0,3).every(Boolean);
 const saveForFunding=()=>void perform(async()=>{validate(0);validate(1);validate(2);await persist();await flow.reload();});
 return <Modal isOpen title={projectId?'Project setup':'Create a project'} description="Define the project first. Add tasks and people after setup is complete." width="max-w-7xl" className="pf-wizard-modal" bodyClassName="pf-wizard-body" footerClassName="pf-wizard-footer-shell" onClose={close} preventClose={locked} footer={<div className="pf-wizard-footer"><div className="pf-wizard-footer-left">{step>0&&<button type="button" disabled={locked||loading} onClick={back}><ArrowLeft size={16}/>Back</button>}<p className="pf-wizard-footer-progress">Step {step+1} of {steps.length}<span>{steps[step].title}</span></p></div><div className="pf-wizard-footer-actions">{editable&&<button type="button" disabled={locked||!draft.title.trim()||fundingDirty||uncertain} onClick={saveDraft}><Save size={16}/>Save draft and close</button>}{step<4?<button type="button" className="pf-primary" disabled={locked||loading||uncertain} onClick={next}>{locked?'Saving…':'Next'}<ArrowRight size={16}/></button>:<button type="button" className="pf-primary" disabled={locked||!editable} onClick={finish}><Check size={16}/>{locked?'Finishing…':'Finish setup and open tasks'}</button>}</div></div>}>
  <nav className="pf-wizard-steps" aria-label="Project setup steps">{steps.map((item,index)=><button type="button" key={item.title} disabled={locked||loading||uncertain} onClick={()=>jump(index)} aria-current={step===index?'step':undefined} data-complete={complete[index]||false}><span>{complete[index]?<Check size={17}/>:<item.icon size={17}/>}</span><div><small>{String(index+1).padStart(2,'0')}</small><strong>{item.title}</strong></div></button>)}</nav>
  <div className="pf-wizard-content"><FlowError error={error||flow.error}/>{loading?<p role="status">Loading saved project setup…</p>:<>
   {step<3&&<div className={step===0?'pf-wizard-opening':undefined}><ProjectSetupFields step={step} draft={draft} update={update} profiles={profiles} disabled={locked||!editable} officeName={officeName}/>{step===0&&<ProjectOpeningPreview title={draft.title}/>}</div>}
   <section hidden={step!==3} aria-label="Project funding step"><p className="pf-eyebrow">PROJECT FUNDING</p><h2>Set the funding sources</h2><p>Choose the fiscal year, Office Budget source and amount. The project total is calculated from those rows.</p><label className="pf-checkbox"><input type="checkbox" checked={draft.noFunding} disabled={!editable||!!flow.data?.funds.length||locked||fundingDirty||uncertain} onChange={e=>update('noFunding',e.target.checked)}/>No funding required for this project</label>{!draft.noFunding&&(!id||dirty||!detailsComplete)&&<div className="pf-warning"><p>Save the project details before adding funding. You can visit the other sections to fill them in.</p><button type="button" disabled={locked||!editable||uncertain} onClick={saveForFunding}>Save details and load funding</button></div>}{!draft.noFunding&&flow.data&&<fieldset disabled={busy||dirty||!detailsComplete} className="min-w-0"><ProjectFundingPanel data={flow.data} reload={flow.reload} onBusyChange={setFundingBusy} onDraftChange={setFundingDirty} onUncertainChange={setUncertain}/></fieldset>}</section>
   {step===4&&<section className="pf-wizard-review"><p className="pf-eyebrow">REVIEW</p><h2>Ready to build the work plan?</h2><h3>{draft.title}</h3><p>{draft.description}</p><dl><div><dt>Scope</dt><dd>{draft.scope}</dd></div><div><dt>Project lead</dt><dd>{profiles.find(p=>p.id===draft.lead)?.full_name||'Assigned project lead'}</dd></div><div><dt>Timeline</dt><dd>{draft.start} → {draft.end}</dd></div><div><dt>Project budget</dt><dd>{draft.noFunding?'No funding required':`₱${(flow.data?.total||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`}</dd></div></dl>{!draft.noFunding&&<ul className="pf-review-sources">{flow.data?.funds.map(source=><li key={source.id}><span>FY {source.fiscal_year} · {source.name}</span><strong>₱{source.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></li>)}</ul>}<p>Finish setup to add tasks, subtasks and project people. Activation remains subject to the project checks.</p></section>}
  </>}</div>
 </Modal>;
}
