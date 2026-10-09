import {supabase} from '../../../../lib/supabase';
import {PROJECT_FILE_BUCKET,validateProjectFile} from '../constants';
import type {ProjectFile,ProjectFileSnapshot,ProjectUploadDraft,ProjectFileEvent} from '../types';
const failure=(error:{message:string;code?:string})=>new Error(error.code==='PGRST202'
 ? 'Project library is not available on this server yet. Existing workflow evidence remains available.' : error.message);
export async function fetchProjectFiles(project:string,task?:string):Promise<ProjectFileSnapshot>{
 const {data,error}=await supabase.rpc('r6_list_project_files',{p_project:project,p_task:task||null});
 if(error)throw failure(error);
 if(!data || !Array.isArray(data.files))throw new Error('Could not load the authorized project library.');
 return data as ProjectFileSnapshot;
}
export async function projectFileCommand(project:string,task:string|undefined,command:'reserve'|'commit'|'link'|'unlink'|'remove',payload:Record<string,unknown>):Promise<ProjectFile>{
 const {data,error}=await supabase.rpc('r6_project_file_command',{p_project:project,p_task:task||null,p_command:command,p_payload:payload});
 if(error)throw failure(error);
 if(!data?.id)throw new Error('No file receipt was returned. Retry this operation.');
 return data as ProjectFile;
}
/** The same draft ID is retained on failure; no replacement, copy or compensation delete. */
export async function uploadProjectFile(project:string,task:string|undefined,draft:ProjectUploadDraft):Promise<ProjectFile>{
 const invalid=validateProjectFile(draft.file);if(invalid)throw new Error(invalid);
 if(!draft.sha256){
  const bytes=await draft.file.arrayBuffer();
  draft.sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 const reserved=await projectFileCommand(project,task,'reserve',{id:draft.id,name:draft.file.name.trim(),size:draft.file.size,type:draft.file.type,sha256:draft.sha256});
 // Commit first recovers an upload whose successful Storage response was lost.
 let receipt=await projectFileCommand(project,task,'commit',{id:reserved.id});
 if(receipt.state==='ready')return receipt;
 const {error}=await supabase.storage.from(PROJECT_FILE_BUCKET).upload(reserved.object_path,draft.file,{upsert:false,contentType:draft.file.type});
 if(error){
  receipt=await projectFileCommand(project,task,'commit',{id:reserved.id});
  if(receipt.state==='ready')return receipt;
  throw new Error(error.message);
 }
 receipt=await projectFileCommand(project,task,'commit',{id:reserved.id});
 if(receipt.state!=='ready')throw new Error('Upload has not been confirmed. Keep this draft and retry.');
 return receipt;
}
export async function openProjectFile(file:ProjectFile):Promise<string>{
 const {data,error}=await supabase.storage.from(PROJECT_FILE_BUCKET).createSignedUrl(file.object_path,60);
 if(error || !data)throw new Error(error?.message||'Could not open this project file.');
 return data.signedUrl;
}
export async function fetchProjectFileEvents(projectId:string,taskId:string):Promise<ProjectFileEvent[]>{
 const {data,error}=await supabase.from('project_library_events').select('id,actor_name,action,occurred_at').eq('project_id',projectId).eq('task_id',taskId).order('occurred_at',{ascending:false});
 if(error)throw new Error('Project file history is unavailable. '+error.message);
 return (data||[]).map(row=>({id:row.id as string,actorName:row.actor_name as string,action:row.action as ProjectFileEvent['action'],at:new Date(row.occurred_at as string).getTime()}));
}
