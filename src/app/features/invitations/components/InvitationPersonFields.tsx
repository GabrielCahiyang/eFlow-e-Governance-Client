import type {ReactNode} from 'react';
import {Paperclip} from 'lucide-react';
/** Shared content for Office invitations and Head-approved project requests. */
export function InvitationPersonFields({id,index,email,file,disabled,compact=false,children,onEmail,onFile,onError}:{id:string;index:number;email:string;file?:File;disabled:boolean;compact?:boolean;children?:ReactNode;onEmail:(value:string)=>void;onFile:(value:File|undefined)=>void;onError:(message:string)=>void}){
 const content=<><label className={compact?'sr-only':undefined} htmlFor={`invite-email-${id}`}>Email address {index+1}</label><input id={`invite-email-${id}`} type="email" autoComplete="email" placeholder="Add email here" value={email} maxLength={254} onChange={e=>onEmail(e.target.value)}/>{children}</>;
 return <fieldset className="eflow-invite-row" disabled={disabled}><legend className={compact?'sr-only':undefined}>Person {index+1}</legend>{compact?<div className="eflow-invite-inputs">{content}</div>:content}
 <label className="eflow-pds-attachment"><Paperclip size={14}/><span>{file?.name||'Attach PDS PDF'} <small>Optional · private · up to 10 MB</small></span><input type="file" accept="application/pdf,.pdf" aria-label={`PDS PDF ${index+1}`} onChange={e=>{const next=e.target.files?.[0];if(next&&(next.size>10485760||!next.name.toLowerCase().endsWith('.pdf'))){onError('Choose a PDF smaller than 10 MB.');e.target.value='';return;}onFile(next);}}/></label>
 </fieldset>;
}
