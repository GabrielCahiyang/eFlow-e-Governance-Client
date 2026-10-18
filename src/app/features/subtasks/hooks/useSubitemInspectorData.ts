import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {isCurrentWorkSnapshot,type WorkTreeController} from '../../nested-work';
import {fetchSubitemInspectorRecord} from '../services/subtaskWorkflowService';

type RecordData=Awaited<ReturnType<typeof fetchSubitemInspectorRecord>>;
/** Reads never fall back to root-team membership or a caller's stale item. */
export function useSubitemInspectorData(rootId:string,itemId:string,controller:WorkTreeController){
 const {user}=useAuth(),actorId=user?.id||null;
 const identity=JSON.stringify([actorId,rootId,itemId]);
 const scope=useRef(identity),sequence=useRef(0),active=useRef(true);
 if(scope.current!==identity){scope.current=identity;++sequence.current;}
 const [state,setState]=useState<{identity:string;data?:RecordData;error:string;loading:boolean}>({identity,error:'',loading:true});
 const tree=controller.data;
 const verified=!!tree&&controller.actorId===actorId&&controller.rootId===rootId&&controller.authorityFresh
  &&isCurrentWorkSnapshot(tree,{actorId,rootId,projectId:tree.root.project,officeId:tree.root.office,kind:tree.root.kind,revision:tree.revision});
 const node=verified?tree.nodes.find(node=>node.id===itemId&&node.task_id===rootId):undefined;
 const current=()=>active.current&&scope.current===identity;
 async function load(){
  const run=++sequence.current;
  if(!node){const waiting=controller.loading||controller.refreshPending;setState({identity,error:waiting?'':controller.error||'Subitem unavailable. Verify current work access.',loading:waiting});return;}
  setState(previous=>({identity,data:previous.identity===identity?previous.data:undefined,error:'',loading:true}));
  try{
   const data=await fetchSubitemInspectorRecord(rootId,itemId);
   if(current()&&run===sequence.current)setState({identity,data,error:'',loading:false});
  }catch(reason){if(current()&&run===sequence.current)setState({identity,error:reason instanceof Error?reason.message:'Could not load subitem.',loading:false});}
 }
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false;++sequence.current;};},[identity,verified,!!node,tree?.revision]);
 const same=state.identity===identity;
 return {tree:verified?tree:undefined,node,data:same&&verified&&node?state.data:undefined,
  loading:controller.loading||!same||state.loading,error:controller.error||(!same?'':state.error),
  fresh:verified&&!!node&&same&&!!state.data&&!state.error,
  pending:state.loading||controller.refreshPending||controller.pending,
  reload:async()=>{await controller.reload();if(current())await load();}};
}
