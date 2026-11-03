import {supabase} from '../../../../lib/supabase';
import type {OfficeCashSnapshot,OfficeCashCommand} from '../types';
export async function loadOfficeCash(office:string):Promise<OfficeCashSnapshot>{
 const {data,error}=await supabase.rpc('office_petty_cash_snapshot',{p_office:office});if(error)throw new Error(error.message);return data as OfficeCashSnapshot;
}
export async function commandOfficeCash(office:string,command:OfficeCashCommand){
 const {error}=await supabase.rpc('office_petty_cash_command',{p_office:office,p_key:command.key,p_action:command.action,p_data:command.data});
 if(error)throw Object.assign(new Error(error.message),{definite:/^[0-9A-Z]{5}$/.test(error.code||'')});
}
export async function uploadOfficeReceipt(request:string,file:File){
 if(file.size>10*1024*1024||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a PDF, JPG, PNG or WebP up to 10 MB.');
 const path=`${request}/${crypto.randomUUID()}`;
 const {error}=await supabase.storage.from('office-petty-receipts').upload(path,file,{contentType:file.type,upsert:false});if(error)throw new Error(error.message);return path;
}
export async function openOfficeReceipt(path:string){
 const {data,error}=await supabase.storage.from('office-petty-receipts').createSignedUrl(path,60);if(error)throw new Error(error.message);window.open(data.signedUrl,'_blank','noopener,noreferrer');
}
