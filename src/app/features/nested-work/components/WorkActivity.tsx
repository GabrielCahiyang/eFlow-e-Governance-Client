import {useEffect,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {fetchWorkEvents,type WorkEvent} from '../services/workTreeService';
export function WorkActivity({roots}:{roots:string[]}){const {user}=useAuth();return <Activity key={`${user?.id}:${roots.join(',')}`} roots={roots}/>;}
function Activity({roots}:{roots:string[]}){
 const [pages,setPages]=useState<WorkEvent[][]>([]),[more,setMore]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false),[cursor,setCursor]=useState<{time:string;id:string}>(),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');void fetchWorkEvents(roots,cursor).then(result=>{if(active){setPages(prior=>cursor?[...prior,result.events]:[result.events]);setMore(result.more);}}).catch(reason=>{if(active)setError((reason as Error).message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[cursor,retry]);
 const events=pages[pages.length-1]||[];
 if(!events.length&&!error&&!loading)return null;
 return <section className="r7-work" aria-label="Delegation history"><h3>Delegation history</h3><p>Immutable work changes · 25 events per page · Root manual progress remains separate.</p>
 {error&&<p role="alert">{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>Retry delegation history</button></p>}{loading&&<p role="status">Loading delegation history…</p>}
 <ol>{events.map(event=><li key={event.id}><strong>{event.actor_name}</strong> · {event.command.replace('_',' ')} · {event.node_id?(event.after_data?.nodes.find(n=>n.id===event.node_id)||event.before_data?.nodes.find(n=>n.id===event.node_id))?.title||'Subitem':'Root task people'}<time dateTime={event.occurred_at}> · {new Date(event.occurred_at).toLocaleString()}</time></li>)}</ol>
 <button type="button" disabled={loading} onClick={()=>{setCursor(undefined);setPages([]);setRetry(v=>v+1);}}>Refresh history</button>{more&&<button type="button" disabled={loading||!!error} onClick={()=>{const last=events[events.length-1];if(last)setCursor({time:last.occurred_at,id:last.id});}}>Older work changes</button>}
 </section>;
}
