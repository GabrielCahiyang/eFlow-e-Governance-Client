import { useState } from 'react';
import { Building2,AlertTriangle,X } from 'lucide-react';
import { ModalButton } from '../../../components/ui/Modal';
import type { ProposedOffice } from '../types';

export function PdfOfficeReview({offices,clarification,onConfirm}:{offices:ProposedOffice[];clarification:string[];onConfirm:(offices:ProposedOffice[])=>Promise<void>}){
 const [rows,setRows]=useState(offices),[busy,setBusy]=useState(false),[clarified,setClarified]=useState<Record<number,string>>({});
 const names=rows.map(row=>row.name.trim().toLowerCase());
 const allNames=[...names,...Object.values(clarified).filter(name=>name.trim()).map(name=>name.trim().toLowerCase())];
 const invalid=rows.some(row=>!row.name.trim())||new Set(allNames).size!==allNames.length;
 return <div className="pdf-office-review"><h3><Building2 size={20}/> Check the offices</h3><p>Only these names will be added. Contacts stay blank until you send invitations.</p>
  {rows.map(row=><div className="pdf-office-review__row" key={row.key}><label><span className="sr-only">Office name</span><input maxLength={200} value={row.name} onChange={event=>setRows(current=>current.map(item=>item.key===row.key?{...item,name:event.target.value,officeId:''}:item))}/></label><button type="button" aria-label={`Exclude ${row.name}`} onClick={()=>setRows(current=>current.filter(item=>item.key!==row.key))}><X size={17}/></button><details><summary>View PDF evidence</summary><p>{row.evidence}</p></details></div>)}
  {!rows.length&&<p>No named offices selected. The project’s existing office stays unchanged.</p>}
  {!!clarification.length&&<><div className="pdf-office-review__notice"><AlertTriangle size={18}/><span>These names need clarification. Enter a specific office only if you know which one; leave blank to skip it.</span></div>{clarification.map((name,index)=><label key={name} className="pdf-office-review__row"><span>{name}</span><input aria-label={`Specific office for ${name}`} maxLength={200} placeholder="Specific office name (optional)" value={clarified[index]||''} onChange={event=>setClarified(current=>({...current,[index]:event.target.value}))}/></label>)}</>}
  {invalid&&<p role="alert">Use a different, non-empty name for each office.</p>}
  <ModalButton variant="primary" pending={busy} disabled={invalid} onClick={()=>{setBusy(true);const manual=Object.entries(clarified).filter(([,name])=>name.trim()).map(([index,name])=>({key:`clarified-${index}`,name:name.trim(),evidence:`Head clarified the source reference: ${clarification[Number(index)]}`,officeId:'',confirmed:true}));void onConfirm([...rows,...manual]).finally(()=>setBusy(false));}}>Confirm offices & continue</ModalButton>
 </div>;
}
