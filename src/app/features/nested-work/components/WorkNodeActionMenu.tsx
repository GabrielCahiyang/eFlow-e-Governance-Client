import {useRef} from 'react';
import {ActionMenu,type WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';

/** Capabilities/callbacks are resolved by the hierarchy owner, never legacy flags. */
export function WorkNodeActionMenu({label,actions}:{label:string;actions:WorkspaceAction[]}) {
 const handoff=useRef(false);
 const trigger=useRef<HTMLButtonElement>(null);
 if(!actions.length)return null;
 const editorActions=new Set(['staff','create','order','edit','move','delete','progress','submit','review']);
 const menuActions=actions.map(action=>({...action,onSelect:()=>{handoff.current=editorActions.has(action.id);if(handoff.current)trigger.current?.focus();action.onSelect();}}));
 return <ActionMenu onCloseAutoFocus={event=>{if(handoff.current){event.preventDefault();handoff.current=false;}}} trigger={<button ref={trigger} type="button" className="nw-hierarchy-control" aria-label={label}>Actions</button>} actions={menuActions}/>;
}
