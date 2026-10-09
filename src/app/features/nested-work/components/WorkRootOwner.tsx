import {useState,type ReactNode} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {FeatureDialog} from '../../../components/ui/FeatureDialog';
import {requestNavigation} from '../../../shared/navigationGuard';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkTreeEditor} from './WorkTreeEditor';
import '../nestedWork.css';
export function WorkRootOwner(props:{rootId:string;fallback?:ReactNode;readOnly?:boolean}){const {user}=useAuth();return <WorkRootOwnerContent key={`${user?.id}:${props.rootId}`} {...props}/>;}
function WorkRootOwnerContent({rootId,fallback,readOnly=false}:{rootId:string;fallback?:ReactNode;readOnly?:boolean}){
 const tree=useWorkTree(rootId);const [open,setOpen]=useState(false),[saved,setSaved]=useState('');tree.hold.current=open;
 if(tree.unavailable)return <>{fallback}</>;
 if(tree.loading&&!tree.data)return <span role="status">Loading project people…</span>;
 if(tree.error)return <span role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry project people</button></span>;
 const data=tree.data;if(!data)return null;
 const names=(id:string)=>data.people.find(p=>p.id===id)?.name||'Previously assigned person';
 return <div className="r7-work"><div className="r7-chips">{[...new Set([data.root.lead,...data.root.people].filter((id):id is string=>!!id))].map(id=><span key={id}>{names(id)}{id===data.root.lead?' · Lead':''}</span>)}</div>
  {!data.root.lead&&<span>Needs reassignment</span>}
  {!readOnly&&data.can_manage&&<button type="button" aria-label="Choose task lead and contributors" onClick={()=>setOpen(true)}>Choose people</button>}
  {saved&&<p role="status">{saved}</p>}
  {open&&<FeatureDialog title="Task lead and contributors" onClose={()=>void requestNavigation(()=>setOpen(false))} contentClassName="max-w-lg"><div className="r7-work p-4 overflow-y-auto"><WorkTreeEditor data={data} edit={{command:'staff',root:true}} save={tree.save} onDone={()=>{setOpen(false);setSaved('Task people saved.');}} onCancel={()=>{setOpen(false);void tree.reload();}}/></div></FeatureDialog>}
 </div>;
}
