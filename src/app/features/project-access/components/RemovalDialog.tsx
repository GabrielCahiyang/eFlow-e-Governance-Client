import {useEffect,useRef,useState} from 'react';
import {FeatureDialog} from '../../../components/ui/FeatureDialog';
import {useNavigationBlocker} from '../../../shared/navigationGuard';
import {previewRemoval,removePerson} from '../services/accessService';
import type {RemovalImpact} from '../types';
import '../projectAccess.css';
type RemovalProps={project:string;user:string;office?:string|null;name:string;onClose:()=>void;onRemoved:()=>void|Promise<void>};
export function RemovalDialog(props:RemovalProps){return <RemovalReview key={`${props.project}:${props.user}:${props.office||''}`} {...props}/>;}
function RemovalReview({project,user,office,name,onClose,onRemoved}:RemovalProps){
 const [impact,setImpact]=useState<RemovalImpact>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[revision,setRevision]=useState(0);
 const request=useRef<string | undefined>(undefined),pending=useRef(false),generation=useRef(0);
 useEffect(()=>{const token=++generation.current;setImpact(undefined);setError('');void previewRemoval(project,user,office).then(data=>{if(token===generation.current)setImpact(data);}).catch(reason=>{if(token===generation.current)setError((reason as Error).message);});return()=>{generation.current++;};},[project,user,office,revision]);
 useNavigationBlocker({label:'Removing project member',dirty:false,pending:busy,onDiscard:()=>{}});
 async function confirm(){if(!impact||pending.current||saved)return;pending.current=true;setBusy(true);setError('');request.current??=crypto.randomUUID();try{await removePerson(impact,request.current);setSaved(true);try{await onRemoved();}catch{setError('Removal saved. Refresh failed; close and reload Members.');}}catch(reason){setError((reason as Error).message);}finally{pending.current=false;setBusy(false);}}
 return <FeatureDialog title={`Review removal · ${name}`} preventClose={busy} onClose={()=>{if(!busy)onClose();}} contentClassName="r9-dialog"><h2>Remove {name} from this project?</h2><p>Confirmation unassigns their tasks and every affected subitem, clears Lead appointments and dependent delegation, and revokes the applicable membership, grants and pending invitations. Unfinished work requires reassignment. Historical progress, evidence and authorship stay recorded.</p><p>Other projects, account roles and Office affiliation stay unchanged. Existing signed file links may remain usable for their short lifetime.</p>
 {!impact&&!error&&<p role="status">Loading all affected work…</p>}{impact&&<><p>{impact.tasks.length} tasks · {impact.nodes.length} subitems affected across the complete project scope.</p><ul>{impact.tasks.map(t=><li key={t.id}>{t.title} · {t.status} · Task / Lead / reviewer assignment</li>)}{impact.nodes.map(n=><li key={n.id}>{n.title} · {n.status} · Subitem staffing / delegation</li>)}</ul>{!impact.tasks.length&&!impact.nodes.length&&<p>No current work assignments. The applicable project access will end.</p>}</>}
 {error&&<p role="alert">{error}</p>}{saved&&<p role="status">Removal saved. Affected unfinished work requires reassignment.</p>}
 <footer><button type="button" disabled={busy} onClick={onClose}>{saved?'Done':'Cancel removal'}</button>{!saved&&<><button type="button" disabled={busy} onClick={()=>{request.current=undefined;setRevision(x=>x+1);}}>Refresh impact preview</button><button type="button" className="r9-danger" disabled={busy||!impact} onClick={()=>void confirm()}>{busy?'Removing…':'Confirm removal and unassign work'}</button></>}</footer></FeatureDialog>;
}
