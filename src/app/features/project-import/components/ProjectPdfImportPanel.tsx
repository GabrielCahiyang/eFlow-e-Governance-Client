import { useEffect, useId, useState } from 'react';
import { FileUp,LoaderCircle,CheckCircle2,Building2,Sparkles,ArrowRight,AlertTriangle,Play,Trash2,ListTodo,Wallet } from 'lucide-react';
import { Modal,ModalButton } from '../../../components/ui/Modal';
import { DateInput } from '../../../components/ui/DateInput';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { getPhilippineCalendarDate,scheduledDateError } from '../../../shared/calendarDates';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { ProposalPdfForm, type PdfEnrichmentProjectContext, type ProposalImportOptions } from '../../proposal-import';
import { usePdfImportSession } from '../hooks/usePdfImportSession';
import { PdfOfficeReview } from './PdfOfficeReview';
import type { ProjectImportResult } from '../types';
import '../projectPdfImport.css';

export function ProjectPdfImportPanel({projectId,projectTitle,startDate,projectContext,projectFunding,onClose,onImported,onOffices,embedded=false,onBusyChange}:{projectId:string;projectTitle:string;startDate?:string;projectContext?:{title?:string;description?:string;scope?:string};projectFunding?:{fundingNotRequired:boolean;total:number;unallocated:number;funds:Array<{id:string;name:string;fiscal_year:number;amount:number;available:number}>};onClose?:()=>void;onImported?:(result:ProjectImportResult)=>void;onOffices?:()=>void;embedded?:boolean;onBusyChange?:(busy:boolean)=>void}){
 const today=getPhilippineCalendarDate();
 const scheduleId=useId();
 const [anchor,setAnchor]=useState(startDate&&startDate>=today?startDate:today),[anchorInvalid,setAnchorInvalid]=useState(false),[anchorTouched,setAnchorTouched]=useState(false),[addOffices,setAddOffices]=useState(false),[autoAssign,setAutoAssign]=useState(true),[localError,setLocalError]=useState('');
 const [addBudget,setAddBudget]=useState(true),[addSubtasks,setAddSubtasks]=useState(true);
 const enrichmentContext:PdfEnrichmentProjectContext|undefined=projectContext||projectFunding?{
  title:projectContext?.title??projectTitle,
  description:projectContext?.description??'',
  scope:projectContext?.scope??'',
  ...(projectFunding?{authorizedBudget:{fundingNotRequired:projectFunding.fundingNotRequired,totalAvailable:projectFunding.unallocated,sources:projectFunding.funds.map(f=>({id:f.id,name:f.name,fiscalYear:f.fiscal_year,available:f.available}))}}:{}),
 }:undefined;
 const flow=usePdfImportSession(projectId,result=>onImported?.(result),enrichmentContext),state=flow.session?.state;
 const activeFunding=flow.projectContext?.authorizedBudget??enrichmentContext?.authorizedBudget;
 const budgetForbidden=!!activeFunding&&(activeFunding.fundingNotRequired||activeFunding.totalAvailable<=0);
 const effectiveAddBudget=budgetForbidden?false:addBudget;
 const budgetDisabledReason=activeFunding?.fundingNotRequired?'Disabled: Head selected No funding required in Step 04 Funding.':budgetForbidden?'Disabled: no unallocated project funding left in Step 04 Funding.':'';
 const review=state?.stage==='review_offices'&&!state.officesReviewed;
 const anchorError=anchorInvalid
  ?'Enter a valid schedule start date in MM/DD/YYYY format.'
  :!anchor
   ?'Select a schedule start date before importing.'
   :scheduledDateError(anchor,{earliest:today,label:'Schedule start'});
 const visibleAnchorError=anchorInvalid||anchorTouched||Boolean(anchor)?anchorError:'';
 const choosePdfDisabled=flow.busy||Boolean(anchorError);
 useEffect(()=>{onBusyChange?.(flow.busy);},[flow.busy,onBusyChange]);
 useNavigationBlocker({label:'PDF import is processing',dirty:false,pending:flow.busy,pendingCheck:()=>flow.busy,onDiscard:()=>{}});
 const close=()=>{if(!flow.busy)onClose?.();};
 const upload=(file:File)=>{setAnchorTouched(true);if(anchorError){setLocalError(anchorError);return;}setLocalError('');void flow.upload(file,anchor,addOffices,autoAssign,{addBudget:effectiveAddBudget,addSubtasks});};
 const schedule = <div className="grid gap-1">
  <label htmlFor={scheduleId}>Schedule starts <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span></label>
  <DateInput
   id={scheduleId}
   aria-label="PDF schedule starts"
   aria-required="true"
   min={today}
   value={anchor}
   hasError={Boolean(visibleAnchorError)}
   errorMessage={visibleAnchorError||undefined}
   onInvalidTextChange={setAnchorInvalid}
   onBlur={()=>setAnchorTouched(true)}
   onChange={event=>{setAnchor(event.target.value);setAnchorTouched(true);if(localError)setLocalError('');}}
  />
  {visibleAnchorError&&<div className="eflow-bounded-meta"><span className="eflow-bounded-meta__hint" data-tone="error" role="alert">{visibleAnchorError}</span></div>}
  <small>“Month 1” starts on this date; the project timeline adjusts automatically to fit all tasks and subtasks.</small>
 </div>;
 const changeOptions = (options:ProposalImportOptions)=>{
  setAddBudget(budgetForbidden?false:options.addBudget);
  setAddSubtasks(options.addSubtasks);
  setAutoAssign(options.assignPeople);
 };
 const content = <section className={embedded?'project-pdf-import pf-task-draft':'project-pdf-import'} aria-label="Import PDF into project" aria-busy={flow.busy}>
   {embedded&&<header><h2>Import AI PDF</h2><p>Use a proposal PDF to build the task table for {projectTitle}, grounded in Details, Scope, Dates, and Funding. AI automatically pulls from all active members of your office — no manual Add people step is needed.</p></header>}
   {!state&&!flow.result&&activeFunding&&<p className="pf-starter-hint" role="note">{activeFunding.fundingNotRequired?'Project funding is set to No funding required — AI will not allocate task budgets.':`Head-authorized project funding ceiling: ₱${activeFunding.totalAvailable.toLocaleString('en-US',{minimumFractionDigits:2})} available. AI works strictly within this budget.`}</p>}
   {flow.loading?<p role="status"><LoaderCircle className="project-pdf-import__spin" size={20}/>Checking saved imports…</p>:!state&&!flow.result?embedded?<div className="space-y-4">
    <div className="project-pdf-import__controls">{schedule}</div>
    <ProposalPdfForm
     options={{addTasks:true,addBudget:effectiveAddBudget,addSubtasks,assignPeople:autoAssign}}
     onOptionsChange={changeOptions}
     onStart={upload}
     busy={flow.busy}
     disabled={flow.busy||Boolean(anchorError)}
     disabledReason={!flow.busy&&anchorError?anchorError:''}
     budgetDisabledReason={budgetDisabledReason}
     hint="Tasks are added to this project. You can review them in the Main table."
    />
   </div>:<>
    <div className="pdf-import-intro"><span><FileUp size={24}/></span><div><h3>From PDF to work plan</h3><p>Import the source groups and tasks. Choose the extra details to include.</p></div></div>
    <div className="project-pdf-import__controls">{schedule}
     <ActionBlockerGroup actionLabel="Choose PDF" blockers={anchorError} busy={flow.busy}>
      <label className="project-pdf-import__upload"><FileUp size={24}/><span><strong>Choose PDF</strong><small>Up to 20 MB</small></span><input aria-label="Import project PDF" type="file" accept=".pdf,application/pdf" disabled={choosePdfDisabled} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)upload(file);}}/></label>
     </ActionBlockerGroup>
    </div>
    <div className="pdf-import-options"><label><input type="checkbox" checked={autoAssign} onChange={event=>setAutoAssign(event.target.checked)}/><Sparkles size={19}/><span><strong>Choose people during import</strong><small>eFlow uses skills and workload to assign eligible office members to imported tasks where it can.</small></span></label>
     <label><input type="checkbox" checked={addSubtasks} onChange={event=>setAddSubtasks(event.target.checked)}/><ListTodo size={19}/><span><strong>Add subtasks</strong><small>Include source steps and practical preparation.</small></span></label>
     <label><input type="checkbox" disabled={budgetForbidden} checked={effectiveAddBudget} onChange={event=>setAddBudget(event.target.checked)}/><Wallet size={19}/><span><strong>Add task budgets</strong><small>{budgetDisabledReason||'Work strictly within the Head-authorized project budget.'}</small></span></label>
     <label><input type="checkbox" checked={addOffices} onChange={event=>setAddOffices(event.target.checked)}/><Building2 size={19}/><span><strong>Add offices found in the PDF</strong><small>Check their names here. Invite representatives or employees yourself afterward.</small></span></label></div>
   </>:null}
   {state&&!flow.result&&<>
    <div className="pdf-import-document"><FileUp size={18}/><strong>{state.sourceName}</strong><small>Saved import</small></div>
    {!!state.events.length&&<ol className="pdf-import-activity" aria-label="Import activity">{state.events.slice(-8).map((text,index,list)=><li key={text} className={flow.busy&&index===list.length-1?'is-current':''}>{flow.busy&&index===list.length-1?<LoaderCircle size={18} className="project-pdf-import__spin"/>:<CheckCircle2 size={18}/>}<span>{text}</span></li>)}</ol>}
    {flow.busy&&<div className="pdf-import-current" role="status"><Sparkles size={18}/><span>{flow.message||'Preparing your import…'}</span><i/></div>}
    {review&&!flow.busy&&state.draft&&<PdfOfficeReview offices={state.draft.offices} clarification={state.extraction?.clarification||[]} onConfirm={flow.confirmOffices}/>}
    {!flow.busy&&!review&&<div className="pdf-import-resume"><p>{state.events.length?'Continue from your last saved step.':'Your PDF is saved and ready to process.'}</p><ModalButton variant="primary" onClick={()=>void flow.resume()}><Play size={16}/> Resume import</ModalButton><WorkspaceTooltip content="Permanently deletes this saved PDF import draft and its progress. This cannot be undone."><span className="inline-flex"><ModalButton onClick={()=>{void flow.discard().catch(reason=>setLocalError((reason as Error).message));}}><Trash2 size={16}/> Discard saved draft</ModalButton></span></WorkspaceTooltip>
     {!state.sourceText&&<label className="pdf-source-restore">Restore PDF if needed<input type="file" accept=".pdf,application/pdf" onChange={event=>{const file=event.target.files?.[0];if(file)upload(file);}}/></label>}</div>}
   </>}
   {!flow.result&&(flow.error||localError)&&<div role="alert"><AlertTriangle size={18}/><span>{flow.error||localError}</span><small>Your saved import is kept. Resume retries safely without adding work twice.</small></div>}
   {flow.result&&<div className="pdf-import-success" role="status"><CheckCircle2 size={38}/><h3>{flow.result.alreadyImported?'This PDF is already in your project':'Your project table is ready'}</h3><p>{flow.result.alreadyImported?`${flow.result.existingTaskCount||0} existing tasks were kept. Nothing was added or reassigned.`:`${flow.result.taskCount} tasks imported · ${flow.result.officeCount||0} offices added · ${flow.result.assignedTaskCount||0} tasks assigned`}</p>{!flow.result.alreadyImported&&!!flow.result.needsPeopleCount&&<p><ArrowRight size={16}/>{flow.result.needsPeopleCount} tasks still need people. For Offices that haven’t joined yet, assign people after they accept their invitations.</p>}</div>}
  </section>;
 if(embedded)return content;
 return <Modal isOpen title={`Import PDF into ${projectTitle}`} description="Turn your proposal into a project table." onClose={close} preventClose={flow.busy} width="max-w-3xl" className="pdf-import-modal"
  footer={<div className="pdf-import-footer"><span>{flow.busy?'Keep this window open. Progress is saved as each step finishes.':state&&!flow.result?'Your progress is saved. You can close and resume later.':'Tasks use Philippine calendar due dates.'}</span>
   {flow.result?<><ModalButton onClick={close}>Open project table</ModalButton>{(flow.result.officeCount||0)>0&&onOffices&&<ModalButton variant="primary" onClick={()=>{close();onOffices();}}>Set up office invitations</ModalButton>}</>:<ModalButton disabled={flow.busy} onClick={close}>Close</ModalButton>}</div>}>
  {content}
 </Modal>;
}
