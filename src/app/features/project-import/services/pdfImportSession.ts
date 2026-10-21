import { supabase } from '../../../../lib/supabase';
import type { ProjectImportDraft, ProjectImportResult } from '../types';
import type { OfficeExtraction } from './pdfOffices';
import { notifyTaskListeners } from '../../tasks';
import { notifyProjectListeners } from '../../projects';
import { notifyAccessChanged } from '../../project-access';
import { reviewedImportPayload } from '../selectors/draftValidation';

export interface PdfSessionState {
 stage:'reading'|'preparing'|'offices'|'review_offices'|'staffing'|'ready'|'saving'|'failed'|'discarded';
 sourceName:string; sourceText?:string; anchor:string; addOffices:boolean;autoAssign:boolean;
 draft?:ProjectImportDraft; extraction?:OfficeExtraction; officesReviewed?:boolean;
 staffingIndex?:number;assignments:Array<{key:string;lead:string;people:string[];hours:number}>;
 events:string[];review?:ReturnType<typeof reviewedImportPayload>;
}
export interface PdfImportSession {id:string;project_id:string;revision:number;state:PdfSessionState;result:ProjectImportResult|null;lease_until:string|null;runner:string|null}
async function pendingRows(project:string,fields:string){
 const {data:auth}=await supabase.auth.getSession();if(!auth.session)return null;
 const {data,error}=await supabase.from('project_pdf_import_sessions').select(fields).eq('project_id',project).eq('actor_id',auth.session.user.id).is('result',null).neq('state->>stage','discarded').order('created_at',{ascending:false}).limit(1);
 if(error)throw new Error(error.message);return data?.[0]||null;
}
export const pendingPdfImport=async(project:string)=>await pendingRows(project,'*') as PdfImportSession|null;
export const hasPendingPdfImport=async(project:string)=>!!await pendingRows(project,'id');
export async function checkpointPdfImport(session:PdfImportSession,runner:string,state:PdfSessionState):Promise<PdfImportSession>{
 const {data,error}=await supabase.rpc('save_pdf_import_session',{p_id:session.id,p_project:session.project_id,p_revision:session.revision,p_runner:runner,p_state:state});
 if(error)throw new Error(error.message);return data;
}
export async function touchPdfImport(id:string,runner:string,release=false){const {error}=await supabase.rpc('touch_pdf_import_session',{p_id:id,p_runner:runner,p_release:release});if(error)throw new Error(error.message);}
export async function publishPdfImport(session:PdfImportSession,runner:string):Promise<ProjectImportResult>{
 const {data,error}=await supabase.rpc('complete_pdf_import_session',{p_id:session.id,p_revision:session.revision,p_runner:runner});
 if(error)throw new Error(error.message);
 if(!data||!Array.isArray(data.groupIds)||!data.taskIds)throw new Error('Import receipt was not confirmed. Resume this saved import to check it safely.');
 await Promise.allSettled([notifyTaskListeners(),notifyProjectListeners(),notifyAccessChanged()]);return data;
}

function fileStore<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{const open=indexedDB.open('eflow-pdf-imports',1);open.onupgradeneeded=()=>open.result.createObjectStore('files');open.onerror=()=>reject(open.error);open.onsuccess=()=>{
  const db=open.result,tx=db.transaction('files',mode),request=operation(tx.objectStore('files'));let result:T;
  request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};
 };});
}
export const cacheImportFile=(id:string,file:File)=>fileStore('readwrite',store=>store.put(file,id));
export const readImportFile=(id:string)=>fileStore<File|undefined>('readonly',store=>store.get(id));
export const clearImportFile=(id:string)=>fileStore('readwrite',store=>store.delete(id));
