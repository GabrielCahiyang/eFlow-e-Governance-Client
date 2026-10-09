import {supabase} from '../../../../lib/supabase';
export interface InspectorFile {id:string;name:string;path:string;bucket:'task-attachments'|'task-comment-attachments';source:string;uploader:string;at:string;restriction:string}
type Row=Record<string,unknown>;
const text=(row:Row,key:string,fallback='')=>String(row[key]||fallback);
export function mapInspectorFiles(parent:Row[],progress:Row[],submissions:Row[],subProgress:Row[],subFiles:Row[],subSubmissions:Row[],subtasks:Row[]):InspectorFile[]{
 const subTitle=(row:Row)=>text(subtasks.find(s=>s.id===row.subtask_id)||{},'title','Subitem');
 const attachment=(row:Row,sub:boolean):InspectorFile=>{
  const attempt=(sub?subSubmissions:submissions).find(s=>s.id===row.submission_id);
  return {id:`${sub?'sub':'task'}-${row.id}`,name:text(row,'file_name','Evidence'),path:text(row,'file_path'),bucket:'task-attachments',
   source:`${sub?subTitle(row):'Task'} · ${attempt?`Submission ${attempt.version} (${attempt.status})`:'Workflow attachment'}`,
   uploader:text(row,'uploader_name',text(attempt||{},'submitter_name','Recorded uploader')),
   at:text(row,'created_at',text(attempt||{},'submitted_at')),restriction:'Formal evidence · Existing review and immutability rules apply'};
 };
 const update=(row:Row,sub:boolean):InspectorFile=>({id:`${sub?'sub':'task'}-progress-${row.id}`,name:text(row,'attachment_name','Progress attachment'),path:text(row,'attachment_path'),
  bucket:sub?'task-attachments':'task-comment-attachments',source:`${sub?subTitle(row):'Task'} · Progress update`,uploader:text(row,'author_name','Recorded contributor'),at:text(row,'created_at'),restriction:'Progress evidence · Existing workflow restrictions apply'});
 return [...parent.map(r=>attachment(r,false)),...progress.filter(r=>r.attachment_path).map(r=>update(r,false)),...subFiles.map(r=>attachment(r,true)),...subProgress.filter(r=>r.attachment_path).map(r=>update(r,true))]
  .filter(f=>f.path).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
export async function fetchInspectorFiles(taskId:string):Promise<InspectorFile[]>{
 const tables=['task_attachments','task_progress_updates','task_submissions','subtask_progress_updates','subtask_submission_attachments','subtask_submissions','subtasks'];
 const results=await Promise.all(tables.map(table=>supabase.from(table).select('*').eq('task_id',taskId)));
 const failed=results.find(r=>r.error);if(failed?.error)throw new Error(failed.error.message);
 return mapInspectorFiles(...results.map(r=>(r.data||[]) as Row[]) as [Row[],Row[],Row[],Row[],Row[],Row[],Row[]]);
}
export async function openInspectorFile(file:InspectorFile):Promise<string>{
 const {data,error}=await supabase.storage.from(file.bucket).createSignedUrl(file.path,file.bucket==='task-attachments'?300:600);
 if(error||!data)throw new Error(error?.message||'Could not open workflow evidence.');
 return data.signedUrl;
}
