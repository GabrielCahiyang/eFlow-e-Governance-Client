import {AlertCircle} from 'lucide-react';
export function FlowError({error}:{error:string}){return error?<div role="alert" className="pf-error"><AlertCircle size={20}/><div><strong>Please check</strong><p>{error}</p></div></div>:null;}
