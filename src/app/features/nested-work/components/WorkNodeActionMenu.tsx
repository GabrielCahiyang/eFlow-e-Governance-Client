import {useRef} from 'react';
import {MoreHorizontal} from 'lucide-react';
import {ActionMenu,type WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';

/** Capabilities/callbacks are resolved by the hierarchy owner, never legacy flags. */
export function WorkNodeActionMenu({label,actions,compact=false}:{label:string;actions:WorkspaceAction[];compact?:boolean}) {
 const handoff=useRef<WorkspaceAction['onSelect']|null>(null);
 if(!actions.length)return null;
 const editorActions=new Set(['staff','create','order','edit','move','delete','progress','submit','review']);
 // A closing dropdown can still trap focus. Open the editor after its close
 // event, and leave canonical return-focus selection to the WorkTree owner.
 const menuActions=actions.map(action=>({...action,onSelect:()=>{
  if(editorActions.has(action.id))handoff.current=action.onSelect;
  else action.onSelect();
 }}));
 return <ActionMenu onCloseAutoFocus={event=>{
  const action=handoff.current;
  if(!action)return;
  event.preventDefault();handoff.current=null;action();
 }} trigger={<button type="button" className="nw-hierarchy-control" aria-label={label}>{compact?<MoreHorizontal size={16} aria-hidden="true"/>:'Actions'}</button>} actions={menuActions}/>;
}
