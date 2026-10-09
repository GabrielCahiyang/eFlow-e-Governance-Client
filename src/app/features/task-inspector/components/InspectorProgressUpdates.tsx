import {useEffect,useState} from 'react';
import {subscribeToProgressUpdates,type ProgressUpdate} from '../../tasks';
export function InspectorProgressUpdates({taskId}:{taskId:string}){
 const [updates,setUpdates]=useState<ProgressUpdate[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{setLoading(true);setUpdates([]);setError('');
  return subscribeToProgressUpdates(taskId,next=>{setLoading(false);setError('');setUpdates(next);},message=>{setLoading(false);setError(message);setUpdates([]);});
 },[taskId,retry]);
 return <section aria-label="Progress updates" className="space-y-2">
  <h3 className="text-sm font-semibold">Progress updates</h3>{loading&&<p role="status">Loading progress updates…</p>}{error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(r=>r+1)}>Retry progress updates</button></div>}
  {!loading&&!error&&!updates.length&&<p className="text-sm text-neutral-500">No progress updates yet.</p>}
  {updates.map(update=><article key={update.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{update.authorName} · {update.percentComplete??0}%</p>
   <time className="text-xs text-neutral-500">{new Date(update.createdAt).toLocaleString()}</time>
   {update.note?<p className="whitespace-pre-wrap">{update.note}</p>:null}{update.blocker?<p>Blocker: {update.blocker}</p>:null}{update.nextStep?<p>Next: {update.nextStep}</p>:null}
   {update.attachmentPath?<p className="text-xs text-neutral-500">Attachment available in Files</p>:null}
  </article>)}
 </section>;
}
