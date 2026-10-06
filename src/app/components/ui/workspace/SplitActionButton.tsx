import { useRef } from "react";
import { Button } from "@vibe/core";
import { ChevronDown } from "lucide-react";
import { ActionMenu, type WorkspaceAction } from "./ActionMenu";
export function SplitActionButton({label, onClick, actions, disabled = false}: {label: string; onClick: () => void; actions: WorkspaceAction[]; disabled?: boolean}) {
  const pendingAction=useRef<(() => void)|null>(null), trigger=useRef<HTMLButtonElement>(null);
  const menuActions=actions.map(action=>({...action,onSelect:()=>{pendingAction.current=action.onSelect;}}));
  return <div className="eflow-split-action"><Button kind="primary" size="small" disabled={disabled} onClick={onClick}>{label}</Button><ActionMenu actions={menuActions} onCloseAutoFocus={event=>{
    const action=pendingAction.current;if(!action)return;pendingAction.current=null;event.preventDefault();
    // Release the menu's focus scope before a callback opens an editor or dialog.
    requestAnimationFrame(()=>{trigger.current?.focus();action();});
  }} trigger={<button ref={trigger} type="button" className="eflow-split-action-menu" aria-label={`${label} options`} disabled={disabled}><ChevronDown size={16} /></button>} /></div>;
}
