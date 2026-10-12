import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {fetchWorkEvents,type WorkEvent} from '../services/workTreeService';
import {isCurrentWorkSnapshot} from '../selectors/capabilities';
import {selectFocusedWorkEvents,type WorkActivityFocus} from '../selectors/workActivityScope';
import {presentWorkEvent} from '../selectors/workEventPresentation';
import type {WorkTreeSnapshot} from '../types';
export function WorkActivity({roots,focusedNode,snapshot}:{roots:string[];focusedNode?:WorkActivityFocus;snapshot?:WorkTreeSnapshot}){
 const {user}=useAuth();
 const verified=!focusedNode||!!snapshot&&roots.length===1&&roots[0]===focusedNode.rootId&&snapshot.nodes.some(node=>node.id===focusedNode.nodeId)&&isCurrentWorkSnapshot(snapshot,{actorId:user?.id||null,rootId:focusedNode.rootId,projectId:snapshot.root.project,officeId:snapshot.root.office,kind:snapshot.root.kind,revision:snapshot.revision});
 return verified?<Activity key={JSON.stringify([user?.id,roots,focusedNode])} roots={roots} focusedNode={focusedNode} snapshot={snapshot}/>:<p role="status">Verify current subitem access to read its work changes.</p>;
}
function Activity({roots,focusedNode,snapshot}:{roots:string[];focusedNode?:WorkActivityFocus;snapshot?:WorkTreeSnapshot}){
 const refreshButton=useRef<HTMLButtonElement>(null),pageFocus=useRef(false);
 const [pages,setPages]=useState<WorkEvent[][]>([]),[more,setMore]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false),[cursor,setCursor]=useState<{time:string;id:string}>(),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');void fetchWorkEvents(roots,cursor).then(result=>{if(active){setPages(prior=>cursor?[...prior,result.events]:[result.events]);setMore(result.more);}}).catch(reason=>{if(active){setPages([]);setMore(false);setError((reason as Error).message);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[cursor,retry]);
 useEffect(()=>{if(loading||!pageFocus.current)return;pageFocus.current=false;if(!document.activeElement||document.activeElement===document.body)refreshButton.current?.focus();},[loading,pages,error]);
 const events=pages[pages.length-1]||[];
 const displayed=focusedNode&&snapshot?selectFocusedWorkEvents(events,focusedNode,snapshot):events.map(event=>({event}));
 if(!focusedNode&&!events.length&&!error&&!loading)return null;
 return <section className="r7-work" aria-label="Delegation history"><h3>Delegation history</h3><p>Immutable work changes · 25 events per page · Root manual progress remains separate.</p>
 {error&&<p role="alert">{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>Retry delegation history</button></p>}{loading&&<p role="status">Loading delegation history…</p>}
 {focusedNode&&!displayed.length&&!error&&!loading&&<p>No permitted work changes on this page.</p>}
 <ol>{displayed.map(({event})=>{const presentation=presentWorkEvent(event,focusedNode);return <li key={event.id}><strong>{event.actor_name}</strong> · {presentation.title}<p>{presentation.detail}</p><time dateTime={event.occurred_at}> · {new Date(event.occurred_at).toLocaleString()}</time></li>;})}</ol>
 <button ref={refreshButton} type="button" disabled={loading} onClick={()=>{setCursor(undefined);setPages([]);setRetry(v=>v+1);}}>Refresh history</button>{more&&<button type="button" disabled={loading||!!error} onClick={()=>{const last=events[events.length-1];if(last){pageFocus.current=true;setCursor({time:last.occurred_at,id:last.id});}}}>Older work changes</button>}
 </section>;
}
