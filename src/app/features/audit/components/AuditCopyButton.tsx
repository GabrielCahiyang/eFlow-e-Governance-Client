import {useState} from 'react';
import {Check,Copy} from 'lucide-react';
export function AuditCopyButton({value,label}:{value:string;label:string}){
 const [result,setResult]=useState('');
 const copy=async()=>{try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(value);setResult('Copied');}catch{setResult('Copy unavailable. Select the reference to copy it.');}};
 return <span className="audit-copy"><button type="button" onClick={()=>void copy()} aria-label={label}>{result==='Copied'?<Check size={15} aria-hidden="true"/>:<Copy size={15} aria-hidden="true"/>}{label}</button>{result&&<span role="status">{result}</span>}</span>;
}
