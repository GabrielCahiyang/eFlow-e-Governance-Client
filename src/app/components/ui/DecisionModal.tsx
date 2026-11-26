import { useId, useRef, useState, type ReactNode } from 'react';
import {AlertCircle,Check,CheckCircle2,Loader2,RotateCcw} from 'lucide-react';
import {Modal} from './Modal';
import {BoundedTextarea} from './BoundedInput';
import {FieldValidationTooltip} from './FieldValidationTooltip';
import {ActionBlockerGroup, type ActionBlockerInput} from './action-blockers';
import './decisionModal.css';

export function DecisionModal({title,description,decision='approve',reason='',onReasonChange,reasonLabel,requireReason=false,minReasonLength=0,busy=false,disabled=false,disabledReason='',blockers,warningTooltip='',error,children,onCancel,onConfirm,confirmLabel,maxReasonLength=4000,preventClose=false}:{
 title:string;description:ReactNode;decision?:'approve'|'reject'|'changes';reason?:string;onReasonChange?:(value:string)=>void;reasonLabel?:string;requireReason?:boolean;minReasonLength?:number;busy?:boolean;disabled?:boolean;disabledReason?:string;blockers?:ActionBlockerInput;warningTooltip?:string;error?:string;children?:ReactNode;onCancel:()=>void;onConfirm:()=>void;confirmLabel?:string;maxReasonLength?:number;preventClose?:boolean;
}){
 const positive=decision==='approve';const Icon=positive?CheckCircle2:RotateCcw;
 const [touched,setTouched]=useState(false);
 const [tipOpen,setTipOpen]=useState(false);
 const textareaRef=useRef<HTMLTextAreaElement|null>(null);
 const confirmAnchorRef=useRef<HTMLSpanElement|null>(null);
 const reasonId=useId();
 const tipId=useId();
 const trimmed=reason.trim();
 const effectiveMin=requireReason?Math.max(1,minReasonLength):minReasonLength;
 const tooShort=effectiveMin>0&&(requireReason?trimmed.length<effectiveMin:trimmed.length>0&&trimmed.length<effectiveMin);
 const missingChars=Math.max(0,effectiveMin-trimmed.length);
 const showFieldError=Boolean(onReasonChange)&&(touched||reason.length>0)&&tooShort;
 const fieldError=showFieldError
  ?trimmed.length===0
   ?(minReasonLength>1?`Reason is required (minimum ${minReasonLength} characters).`:'A reason is required before continuing.')
   :`Enter at least ${effectiveMin} characters (${missingChars} more needed).`
  :'';
 const blockedByReason=Boolean(onReasonChange)&&tooShort;
 const confirmDisabled=busy||disabled||blockedByReason;
 const reasonBlocker=blockedByReason
  ?(trimmed.length===0
   ?(minReasonLength>1?`Enter a reason (minimum ${minReasonLength} characters) before confirming.`:'Enter a required reason before confirming.')
   :`Reason needs ${missingChars} more character${missingChars===1?'':'s'} (minimum ${effectiveMin}).`)
  :'';
 const activeBlockers=confirmDisabled&&!busy
  ?[
   ...(Array.isArray(blockers)?blockers:blockers?[blockers]:[]),
   ...(disabled&&disabledReason?[disabledReason]:[]),
   ...(reasonBlocker?[reasonBlocker]:[]),
  ]
  :[];
 const activeWarningTip=!busy&&!confirmDisabled&&(warningTooltip||decision==='reject')
  ?(warningTooltip||'This records a formal rejection and notifies the requester.')
  :'';
 const resolvedConfirmLabel=confirmLabel||(positive?'Yes, approve':decision==='changes'?'Yes, request changes':'Yes, reject');
 const resolvedLabel=reasonLabel||(requireReason?'Reason (required)':'Note (optional)');
 const showAsterisk=requireReason&&!/\*|\(required\)/i.test(resolvedLabel);
 return <Modal isOpen title={title} onClose={onCancel} preventClose={busy||preventClose} width="max-w-lg" className="decision-modal" footer={<div className="decision-modal__actions"><button type="button" disabled={busy||preventClose} onClick={onCancel}>Cancel</button><ActionBlockerGroup actionLabel={resolvedConfirmLabel} blockers={activeBlockers} busy={busy}><span ref={confirmAnchorRef} className={`inline-flex${confirmDisabled?' cursor-not-allowed':''}`} onMouseEnter={()=>setTipOpen(true)} onMouseLeave={()=>setTipOpen(false)} onFocus={()=>setTipOpen(true)} onBlur={()=>setTipOpen(false)} onClick={()=>{if(blockedByReason&&!busy){setTouched(true);textareaRef.current?.focus();}}}><button type="button" className="decision-modal__confirm disabled:pointer-events-none" data-tone={positive?'approve':'return'} aria-describedby={tipOpen&&activeWarningTip?tipId:undefined} onFocus={()=>setTipOpen(true)} onBlur={()=>setTipOpen(false)} disabled={confirmDisabled} onClick={onConfirm}>{busy?<Loader2 size={17} className="decision-modal__spin" aria-hidden="true"/>:<Check size={17} aria-hidden="true"/>}{busy?'Saving…':resolvedConfirmLabel}</button><FieldValidationTooltip id={tipId} anchorRef={confirmAnchorRef} message={activeWarningTip} open={tipOpen&&Boolean(activeWarningTip)} tone="warning"/></span></ActionBlockerGroup></div>}>
  <div className="decision-modal__intro" data-tone={positive?'approve':'return'}><span className="decision-modal__icon"><Icon size={28} aria-hidden="true"/></span><div>{description}</div></div>
  {onReasonChange&&<div className="decision-modal__reason"><label htmlFor={reasonId}>{resolvedLabel}{showAsterisk&&<span className="text-[var(--eflow-negative-text)]" aria-hidden="true"> *</span>}</label><BoundedTextarea ref={textareaRef} id={reasonId} autoFocus={!positive} value={reason} disabled={busy} aria-required={requireReason||undefined} onBlur={()=>setTouched(true)} onChange={event=>onReasonChange(event.target.value)} rows={3} maxLength={maxReasonLength} error={fieldError||undefined} placeholder={positive?'Add a note if needed.':'Explain what needs to change.'}/></div>}
  {children}
  {error&&<div role="alert" className="decision-modal__error"><AlertCircle size={18} aria-hidden="true"/>{error}</div>}
 </Modal>;
}

export function DecisionResultModal({title,message,tone,onClose,onCheck}:{title:string;message:string;tone:'success'|'returned'|'warning'|'error';onClose:()=>void;onCheck?:()=>void}){
 const Icon=tone==='success'?CheckCircle2:tone==='error'?AlertCircle:RotateCcw;
 return <Modal isOpen title={title} onClose={onClose} width="max-w-lg" className="decision-modal" footer={<div className="decision-modal__actions">{onCheck&&<button type="button" onClick={onCheck}>Check latest status</button>}<button type="button" className="decision-modal__confirm" data-tone={tone==='success'?'approve':tone==='error'?'error':'return'} onClick={onClose}>Done</button></div>}><div className="decision-modal__intro" data-tone={tone==='success'?'approve':tone==='error'?'error':'return'} role={tone==='error'?'alert':'status'}><span className="decision-modal__icon"><Icon size={30} aria-hidden="true"/></span><p>{message}</p></div></Modal>;
}
