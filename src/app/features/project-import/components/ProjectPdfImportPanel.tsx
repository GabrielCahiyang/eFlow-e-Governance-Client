import { useState } from 'react';
import { FileUp,LoaderCircle,CheckCircle2,Building2,Sparkles,ArrowRight,AlertTriangle,Play,Trash2 } from 'lucide-react';
import { Modal,ModalButton } from '../../../components/ui/Modal';
import { getPhilippineCalendarDate,scheduledDateError } from '../../../shared/calendarDates';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { usePdfImportSession } from '../hooks/usePdfImportSession';
import { PdfOfficeReview } from './PdfOfficeReview';
import type { ProjectImportResult } from '../types';
import '../projectPdfImport.css';

export function ProjectPdfImportPanel({projectId,projectTitle,startDate,onClose,onImported,onOffices}:{projectId:string;projectTitle:string;startDate?:string;onClose:()=>void;onImported:(result:ProjectImportResult)=>void;onOffices?:()=>void}){
 const today=getPhilippineCalendarDate();
 const [anchor,setAnchor]=useState(startDate&&startDate>=today?startDate:today),[addOffices,setAddOffices]=useState(false),[autoAssign,setAutoAssign]=useState(true),[localError,setLocalError]=useState('');
 const flow=usePdfImportSession(projectId,onImported),state=flow.session?.state;
 const review=state?.stage==='review_offices'&&!state.officesReviewed;
 useNavigationBlocker({label:'PDF import is processing',dirty:false,pending:flow.busy,pendingCheck:()=>flow.busy,onDiscard:()=>{}});
 const close=()=>{if(!flow.busy)onClose();};
 const upload=(file:File)=>{const issue=scheduledDateError(anchor,{label:'Schedule start'});if(issue){setLocalError(issue);return;}setLocalError('');void flow.upload(file,anchor,addOffices,autoAssign);};
 return <Modal isOpen title={`Import PDF into ${projectTitle}`} description="Turn your proposal into a project table." onClose={close} preventClose={flow.busy} width="max-w-3xl" className="pdf-import-modal"
  footer={<div className="pdf-import-footer"><span>{flow.busy?'Keep this window open. Progress is saved as each step finishes.':state&&!flow.result?'Your progress is saved. You can close and resume later.':'Due times default to 11:59 PM.'}</span>
   {flow.result?<><ModalButton onClick={close}>Open project table</ModalButton>{(flow.result.officeCount||0)>0&&onOffices&&<ModalButton variant="primary" onClick={()=>{close();onOffices();}}>Set up office invitations</ModalButton>}</>:<ModalButton disabled={flow.busy} onClick={close}>Close</ModalButton>}</div>}>
  <section className="project-pdf-import" aria-label="Import PDF into project" aria-busy={flow.busy}>
   {flow.loading?<p role="status"><LoaderCircle className="project-pdf-import__spin" size={20}/>Checking saved imports…</p>:!state&&!flow.result?<>
    <div className="pdf-import-intro"><span><FileUp size={24}/></span><div><h3>From PDF to work plan</h3><p>Keep the source groups, tasks and budgets. Let AI help with priorities and people.</p></div></div>
    <div className="project-pdf-import__controls"><label>Schedule starts<input type="date" aria-label="PDF schedule starts" min={today} value={anchor} onChange={event=>setAnchor(event.target.value)}/><small>“Month 1” starts on this date.</small></label>
     <label className="project-pdf-import__upload"><FileUp size={24}/><span><strong>Choose PDF</strong><small>Up to 20 MB</small></span><input aria-label="Import project PDF" type="file" accept=".pdf,application/pdf" disabled={flow.busy||!anchor} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)upload(file);}}/></label></div>
    <div className="pdf-import-options"><label><input type="checkbox" checked={autoAssign} onChange={event=>setAutoAssign(event.target.checked)}/><Sparkles size={19}/><span><strong>Choose people automatically</strong><small>Qwen matches eligible people using skills and workload. They appear in Add people.</small></span></label>
     <label><input type="checkbox" checked={addOffices} onChange={event=>setAddOffices(event.target.checked)}/><Building2 size={19}/><span><strong>Add offices found in the PDF</strong><small>Check their names here. Invite representatives or employees yourself afterward.</small></span></label></div>
   </>:null}
   {state&&!flow.result&&<>
    <div className="pdf-import-document"><FileUp size={18}/><strong>{state.sourceName}</strong><small>Saved import</small></div>
    {!!state.events.length&&<ol className="pdf-import-activity" aria-label="Import activity">{state.events.slice(-8).map((text,index,list)=><li key={text} className={flow.busy&&index===list.length-1?'is-current':''}>{flow.busy&&index===list.length-1?<LoaderCircle size={18} className="project-pdf-import__spin"/>:<CheckCircle2 size={18}/>}<span>{text}</span></li>)}</ol>}
    {flow.busy&&<div className="pdf-import-current" role="status"><Sparkles size={18}/><span>{flow.message||'Preparing your import…'}</span><i/></div>}
    {review&&!flow.busy&&state.draft&&<PdfOfficeReview offices={state.draft.offices} clarification={state.extraction?.clarification||[]} onConfirm={flow.confirmOffices}/>}
    {!flow.busy&&!review&&<div className="pdf-import-resume"><p>{state.events.length?'Continue from your last saved step.':'Your PDF is saved and ready to process.'}</p><ModalButton variant="primary" onClick={()=>void flow.resume()}><Play size={16}/> Resume import</ModalButton><ModalButton onClick={()=>{void flow.discard().catch(reason=>setLocalError((reason as Error).message));}}><Trash2 size={16}/> Discard saved draft</ModalButton>
     {!state.sourceText&&<label className="pdf-source-restore">Restore PDF if needed<input type="file" accept=".pdf,application/pdf" onChange={event=>{const file=event.target.files?.[0];if(file)upload(file);}}/></label>}</div>}
   </>}
   {!flow.result&&(flow.error||localError)&&<div role="alert"><AlertTriangle size={18}/><span>{flow.error||localError}</span><small>Your saved import is kept. Resume retries safely without adding work twice.</small></div>}
   {flow.result&&<div className="pdf-import-success" role="status"><CheckCircle2 size={38}/><h3>{flow.result.alreadyImported?'This PDF is already in your project':'Your project table is ready'}</h3><p>{flow.result.alreadyImported?`${flow.result.existingTaskCount||0} existing tasks were kept. Nothing was added or reassigned.`:`${flow.result.taskCount} tasks imported · ${flow.result.officeCount||0} offices added · ${flow.result.assignedTaskCount||0} tasks assigned`}</p>{!flow.result.alreadyImported&&!!flow.result.needsPeopleCount&&<p><ArrowRight size={16}/>{flow.result.needsPeopleCount} tasks still need people. Pending offices can be staffed after people accept their invitations.</p>}</div>}
  </section>
 </Modal>;
}
