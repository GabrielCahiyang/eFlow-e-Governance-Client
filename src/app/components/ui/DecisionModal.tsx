import type {ReactNode} from 'react';
import {AlertCircle,Check,CheckCircle2,Loader2,RotateCcw} from 'lucide-react';
import {Modal} from './Modal';
import './decisionModal.css';

export function DecisionModal({title,description,decision='approve',reason='',onReasonChange,reasonLabel,requireReason=false,busy=false,disabled=false,error,children,onCancel,onConfirm,confirmLabel,maxReasonLength=4000,preventClose=false}:{
 title:string;description:ReactNode;decision?:'approve'|'reject'|'changes';reason?:string;onReasonChange?:(value:string)=>void;reasonLabel?:string;requireReason?:boolean;busy?:boolean;disabled?:boolean;error?:string;children?:ReactNode;onCancel:()=>void;onConfirm:()=>void;confirmLabel?:string;maxReasonLength?:number;preventClose?:boolean;
}){
 const positive=decision==='approve';const Icon=positive?CheckCircle2:RotateCcw;
 return <Modal isOpen title={title} onClose={onCancel} preventClose={busy||preventClose} width="max-w-lg" className="decision-modal" footer={<div className="decision-modal__actions"><button type="button" disabled={busy||preventClose} onClick={onCancel}>Cancel</button><button type="button" className="decision-modal__confirm" data-tone={positive?'approve':'return'} disabled={busy||disabled||requireReason&&!reason.trim()} onClick={onConfirm}>{busy?<Loader2 size={17} className="decision-modal__spin" aria-hidden="true"/>:<Check size={17} aria-hidden="true"/>}{busy?'Saving…':confirmLabel||(positive?'Yes, approve':decision==='changes'?'Yes, request changes':'Yes, reject')}</button></div>}>
  <div className="decision-modal__intro" data-tone={positive?'approve':'return'}><span className="decision-modal__icon"><Icon size={28} aria-hidden="true"/></span><div>{description}</div></div>
  {onReasonChange&&<label className="decision-modal__reason">{reasonLabel||(requireReason?'Reason (required)':'Note (optional)')}<textarea autoFocus={!positive} value={reason} disabled={busy} onChange={event=>onReasonChange(event.target.value)} rows={3} maxLength={maxReasonLength} placeholder={positive?'Add a note if needed.':'Explain what needs to change.'}/></label>}
  {children}
  {error&&<div role="alert" className="decision-modal__error"><AlertCircle size={18} aria-hidden="true"/>{error}</div>}
 </Modal>;
}

export function DecisionResultModal({title,message,tone,onClose,onCheck}:{title:string;message:string;tone:'success'|'returned'|'warning'|'error';onClose:()=>void;onCheck?:()=>void}){
 const Icon=tone==='success'?CheckCircle2:tone==='error'?AlertCircle:RotateCcw;
 return <Modal isOpen title={title} onClose={onClose} width="max-w-lg" className="decision-modal" footer={<div className="decision-modal__actions">{onCheck&&<button type="button" onClick={onCheck}>Check latest status</button>}<button type="button" className="decision-modal__confirm" data-tone={tone==='success'?'approve':tone==='error'?'error':'return'} onClick={onClose}>Done</button></div>}><div className="decision-modal__intro" data-tone={tone==='success'?'approve':tone==='error'?'error':'return'} role={tone==='error'?'alert':'status'}><span className="decision-modal__icon"><Icon size={30} aria-hidden="true"/></span><p>{message}</p></div></Modal>;
}
