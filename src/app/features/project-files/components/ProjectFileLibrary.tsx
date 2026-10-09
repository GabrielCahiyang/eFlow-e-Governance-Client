import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {PROJECT_FILE_ACCEPT,validateProjectFile} from '../constants';
import {fetchProjectFiles,openProjectFile,projectFileCommand,uploadProjectFile} from '../services/projectFileService';
import type {ProjectFile,ProjectFileSnapshot,ProjectUploadDraft} from '../types';
import '../projectFiles.css';

export function ProjectFileLibrary({projectId,taskId,readOnly=false}:{projectId:string;taskId?:string;readOnly?:boolean}){
 const {user}=useAuth();
 return <ProjectFileLibraryContent key={`${user?.id||''}:${projectId}:${taskId||''}`} projectId={projectId} taskId={taskId} readOnly={readOnly}/>;
}
function ProjectFileLibraryContent({projectId,taskId,readOnly=false}:{projectId:string;taskId?:string;readOnly?:boolean}){
 const {user}=useAuth();
 const [data,setData]=useState<ProjectFileSnapshot>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const [draft,setDraft]=useState<ProjectUploadDraft>(),[busy,setBusy]=useState(false),[picker,setPicker]=useState(false),[search,setSearch]=useState('');
 const input=useRef<HTMLInputElement>(null), generation=useRef(0), mounted=useRef(true);
 const guard=useExplicitDraft('Project file upload',!!draft,busy,()=>{setDraft(undefined);if(input.current)input.current.value='';});
 async function refresh(){
  const current=++generation.current;setLoading(true);setError('');setData(undefined);
  try{const next=await fetchProjectFiles(projectId,taskId);if(mounted.current&&current===generation.current)setData(next);}
  catch(reason){if(mounted.current&&current===generation.current)setError(reason instanceof Error?reason.message:'Could not load project files.');}
  finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  mounted.current=true;void refresh();
  const reload=()=>{if(!guard.pendingRef.current)void refresh();};
  window.addEventListener('focus',reload);
  return()=>{mounted.current=false;++generation.current;window.removeEventListener('focus',reload);};
 },[projectId,taskId,user?.id]);
 const canWrite=!readOnly&&!!data?.can_write;
 async function run(action:()=>Promise<unknown>,message:string,upload=false){
  if(guard.pendingRef.current||!canWrite)return;
  guard.pendingRef.current=true;setBusy(true);setError('');setSaved('');
  try{await action();if(upload){setDraft(undefined);if(input.current)input.current.value='';}guard.markClean();setSaved(message);await refresh();}
  catch(reason){setError(reason instanceof Error?reason.message:'Could not save project file.');}
  finally{guard.pendingRef.current=false;setBusy(false);}
 }
 async function open(file:ProjectFile){
  try{const url=await openProjectFile(file);if(mounted.current)window.open(url,'_blank','noopener,noreferrer');}
  catch(reason){setError(reason instanceof Error?reason.message:'Could not open file.');}
 }
 const files=data?.files||[], attached=taskId?files.filter(f=>f.linked):files;
 return <section aria-label="Project documents" className="r6-file-library space-y-3">
  <h3 className="text-sm font-semibold">Project documents</h3>
  <p className="text-xs text-neutral-500">General documents are separate from formal submission evidence. Files stay private to this project.</p>
  {loading&&<p role="status">Loading project files…</p>}{error&&<div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={()=>void refresh()}>Retry project files</button></div>}{saved&&<p role="status">{saved}</p>}
  {canWrite&&<div className="space-y-2">
   <label className="block text-sm">Upload a project document<input ref={input} type="file" accept={PROJECT_FILE_ACCEPT} disabled={busy||!!draft} onChange={e=>{
    const file=e.target.files?.[0];if(!file)return;const invalid=validateProjectFile(file);setError(invalid);setSaved('');if(!invalid)setDraft({id:crypto.randomUUID(),file});else e.target.value='';
   }}/></label><p className="text-xs text-neutral-500">PDF, text, images, DOCX or XLSX · Up to 10 MB</p>
   {draft&&<div className="flex flex-wrap items-center gap-2"><span className="text-sm break-all">{draft.file.name}</span><button type="button" disabled={busy} onClick={()=>void run(()=>uploadProjectFile(projectId,taskId,draft),'Document saved to the project library.',true)}>{busy?'Uploading…':'Save document / retry'}</button><button type="button" disabled={busy} onClick={()=>{setDraft(undefined);if(input.current)input.current.value='';}}>Discard upload draft</button></div>}
   {taskId&&<button type="button" disabled={busy||!!draft} aria-expanded={picker} onClick={()=>setPicker(!picker)}>Insert from project library</button>}
  </div>}
  {!loading&&data&&!attached.length&&<p className="text-sm text-neutral-500">No general documents {taskId?'linked to this task':'in this project'}.</p>}
  <ul className="space-y-2">{attached.map(file=><li key={file.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
   <button type="button" className="text-teal-700 break-all text-left" onClick={()=>void open(file)}>{file.file_name}</button>
   <p className="text-xs text-neutral-500">Uploaded by {file.uploader_name} · {new Date(file.created_at).toLocaleDateString()} · {Math.ceil(file.file_size/1024)} KB</p>
   <p className="text-xs text-neutral-500">Source: this project library{file.link?` · Linked ${new Date(file.link.linked_at).toLocaleDateString()}`:''}</p>
   {canWrite&&taskId&&<button type="button" disabled={busy||!!draft} onClick={()=>void run(()=>projectFileCommand(projectId,taskId,'unlink',{id:file.id}),'Document unlinked. Source retained in the project library.')}>Unlink document</button>}
   {canWrite&&file.can_remove&&!file.links&&<button type="button" disabled={busy||!!draft} onClick={()=>void run(()=>projectFileCommand(projectId,taskId,'remove',{id:file.id}),'Document removed from the library; provenance retained.')}>Remove from library</button>}
  </li>)}</ul>
  {picker&&canWrite&&<section aria-label="Insert project document" className="space-y-2"><label className="text-sm">Find a project document<input value={search} onChange={e=>setSearch(e.target.value)} type="search" className="block w-full border rounded p-2"/></label>
   {files.filter(f=>!f.linked&&f.file_name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(file=><div key={file.id} className="flex justify-between gap-2 text-sm"><span className="break-all">{file.file_name} · {file.uploader_name}</span><button type="button" disabled={busy||!!draft} onClick={()=>void run(()=>projectFileCommand(projectId,taskId,'link',{id:file.id}),'Project document linked.')}>Insert {file.file_name}</button>{file.can_remove&&!file.links&&<button type="button" disabled={busy||!!draft} onClick={()=>void run(()=>projectFileCommand(projectId,taskId,'remove',{id:file.id}),'Document removed from library.')}>Remove {file.file_name}</button>}</div>)}
  </section>}
 </section>;
}
