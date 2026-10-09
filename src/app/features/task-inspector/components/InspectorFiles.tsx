import {useEffect,useState} from 'react';
import {ProjectFileLibrary} from '../../project-files';
import type {Task} from '../../tasks';
import {TaskReviewPanel} from '../../reviews';
import {fetchInspectorFiles,openInspectorFile,type InspectorFile} from '../services/inspectorFileService';
export function InspectorFiles({task,readOnly}:{task:Task;readOnly:boolean}){
 const [files,setFiles]=useState<InspectorFile[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setFiles([]);setLoading(true);setError('');
  void fetchInspectorFiles(task.id).then(next=>{if(active)setFiles(next);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not load workflow files.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[task.id,task.latestSubmission?.id,retry]);
 async function open(file:InspectorFile){try{window.open(await openInspectorFile(file),'_blank','noopener,noreferrer');}catch(reason){setError(reason instanceof Error?reason.message:'Could not open evidence.');}}
 return <div className="space-y-5">
  <section aria-label="Workflow files" className="space-y-3"><h3 className="text-sm font-semibold">Workflow evidence</h3>
   <p className="text-xs text-neutral-500">Task and subitem progress and submission files keep their original access and approval restrictions. Comments are text-only.</p>
   {loading&&<p role="status">Loading workflow files…</p>}{error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(r=>r+1)}>Retry workflow files</button></div>}
   {!loading&&!error&&!files.length&&<p className="text-sm text-neutral-500">No authorized workflow attachments yet.</p>}
   <ul className="space-y-2">{files.map(file=><li key={file.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
    <button type="button" className="text-teal-700 break-all text-left" onClick={()=>void open(file)}>{file.name}</button>
    <p className="text-xs text-neutral-500">{file.source} · {file.uploader} · {file.at?new Date(file.at).toLocaleDateString():'Date not recorded'}</p>
    <p className="text-xs text-neutral-500">{file.restriction}</p>
   </li>)}</ul>
   <details><summary className="cursor-pointer text-sm">Submission notes and previous attempts</summary><TaskReviewPanel task={task} canReview={false} showDecision={false}/></details>
  </section>
  {task.linkedProjectId?<ProjectFileLibrary key={task.linkedProjectId+task.id} projectId={task.linkedProjectId} taskId={task.id} readOnly={readOnly}/>:<p className="text-sm text-neutral-500">General documents require an authorized project. Workflow evidence remains available above.</p>}
 </div>;
}
