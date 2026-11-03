import { EmptyState } from '../../../components/ui/EmptyState';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {fetchWorkEvents,type WorkEvent} from '../services/workTreeService';
import {isCurrentWorkSnapshot} from '../selectors/capabilities';
import {selectFocusedWorkEvents,type WorkActivityFocus} from '../selectors/workActivityScope';
import {presentWorkEvent} from '../selectors/workEventPresentation';
import type {WorkTreeSnapshot} from '../types';
import {History,RefreshCw,ArrowDown} from 'lucide-react';
import {WorkActivityCard} from './WorkActivityCard';
import '../workActivity.css';
export function WorkActivity({roots,focusedNode,snapshot}:{roots:string[];focusedNode?:WorkActivityFocus;snapshot?:WorkTreeSnapshot}){
 const {user}=useAuth();
 const verified=!focusedNode||!!snapshot&&roots.length===1&&roots[0]===focusedNode.rootId&&snapshot.nodes.some(node=>node.id===focusedNode.nodeId)&&isCurrentWorkSnapshot(snapshot,{actorId:user?.id||null,rootId:focusedNode.rootId,projectId:snapshot.root.project,officeId:snapshot.root.office,kind:snapshot.root.kind,revision:snapshot.revision});
 return verified?<Activity key={JSON.stringify([user?.id,roots,focusedNode])} roots={roots} focusedNode={focusedNode} snapshot={snapshot}/>:<p role="status">Verify current subtask access to read its work changes.</p>;
}
function Activity({roots,focusedNode,snapshot}:{roots:string[];focusedNode?:WorkActivityFocus;snapshot?:WorkTreeSnapshot}){
 const refreshButton=useRef<HTMLButtonElement>(null),pageFocus=useRef(false);
 const [pages,setPages]=useState<WorkEvent[][]>([]),[more,setMore]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false),[cursor,setCursor]=useState<{time:string;id:string}>(),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');void fetchWorkEvents(roots,cursor).then(result=>{if(active){setPages(prior=>cursor?[...prior,result.events]:[result.events]);setMore(result.more);}}).catch(reason=>{if(active){setPages([]);setMore(false);setError((reason as Error).message);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[cursor,retry]);
 useEffect(()=>{if(loading||!pageFocus.current)return;pageFocus.current=false;if(!document.activeElement||document.activeElement===document.body)refreshButton.current?.focus();},[loading,pages,error]);
 const events=pages[pages.length-1]||[];
 const displayed=focusedNode&&snapshot?selectFocusedWorkEvents(events,focusedNode,snapshot):events.map(event=>({event}));
 if(!focusedNode&&!events.length&&!error&&!loading)return null;
 return <section className="r7-work nw-activity" aria-label="Delegation history"><header className="nw-activity-heading"><div className="nw-activity-heading-icon"><History size={22} aria-hidden="true"/></div><div><h3>Activity history</h3><p>Who changed what, and when. Latest changes first.</p></div><button ref={refreshButton} type="button" disabled={loading} aria-label="Refresh history" title="Refresh history" onClick={()=>{setCursor(undefined);setPages([]);setRetry(v=>v+1);}}><RefreshCw size={16} aria-hidden="true"/><span>Refresh</span></button></header>
 {error&&<p role="alert">{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>Retry delegation history</button></p>}{loading&&<p role="status">Loading delegation history…</p>}
 {focusedNode&&!displayed.length&&!error&&!loading&&<EmptyState illustration="tasks" size="compact" title="No permitted work changes on this page."/>}
 <ol className="nw-activity-timeline">{displayed.map(({event})=><WorkActivityCard key={event.id} event={event} presentation={presentWorkEvent(event,focusedNode)}/>)}</ol>
 {more&&<button type="button" className="nw-activity-older" disabled={loading||!!error} onClick={()=>{const last=events[events.length-1];if(last){pageFocus.current=true;setCursor({time:last.occurred_at,id:last.id});}}}><ArrowDown size={15} aria-hidden="true"/>Older work changes</button>}
 </section>;
}
