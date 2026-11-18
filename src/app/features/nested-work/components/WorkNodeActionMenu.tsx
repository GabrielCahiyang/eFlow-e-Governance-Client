import {useRef} from 'react';
import {ChevronDown, MoreHorizontal, Plus} from 'lucide-react';
import {ActionMenu,type WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';

/** Capabilities/callbacks are resolved by the hierarchy owner, never legacy flags. */
export function WorkNodeActionMenu({label,actions,compact=false,prominent=false}:{label:string;actions:WorkspaceAction[];compact?:boolean;prominent?:boolean}) {
 const handoff=useRef<WorkspaceAction['onSelect']|null>(null);
 if(!actions.length)return null;
 const only=actions[0];
 if(prominent&&actions.length===1&&only.id==='create'){
  return <button type="button" data-work-toolbar-primary="true" className="nw-hierarchy-control nw-hierarchy-control--primary" disabled={only.disabled} title={only.disabledReason} onClick={()=>{if(!only.disabled)only.onSelect();}}><Plus size={17} aria-hidden="true"/>{only.label}</button>;
 }
 const editorActions=new Set(['staff','create','order','edit','move','delete','progress','submit','review','evidence','funding','files']);
 // A closing dropdown can still trap focus. Open the editor after its close
 // event, and leave canonical return-focus selection to the WorkTree owner.
 const menuActions=actions.map(action=>({...action,onSelect:()=>{
  if(editorActions.has(action.id))handoff.current=action.onSelect;
  else action.onSelect();
 }}));
 return <ActionMenu tooltip={compact||!prominent?'Subtask actions':undefined} onCloseAutoFocus={event=>{
  const action=handoff.current;
  if(!action)return;
  event.preventDefault();handoff.current=null;action();
 }} trigger={<button type="button" className={`nw-hierarchy-control${prominent?' nw-hierarchy-control--primary':''}`} aria-label={label}>{prominent?<><Plus size={17} aria-hidden="true"/>Subtask actions<ChevronDown size={15} aria-hidden="true"/></>:<MoreHorizontal size={16} aria-hidden="true"/>}</button>} actions={menuActions}/>;
}
