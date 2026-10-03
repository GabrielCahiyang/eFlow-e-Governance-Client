import { Button } from "@vibe/core";
import { ChevronDown } from "lucide-react";
import { ActionMenu, type WorkspaceAction } from "./ActionMenu";
export function SplitActionButton({label, onClick, actions, disabled = false}: {label: string; onClick: () => void; actions: WorkspaceAction[]; disabled?: boolean}) {
  return <div className="eflow-split-action"><Button kind="primary" size="small" disabled={disabled} onClick={onClick}>{label}</Button><ActionMenu actions={actions} trigger={<button type="button" className="eflow-split-action-menu" aria-label={`${label} options`} disabled={disabled}><ChevronDown size={16} /></button>} /></div>;
}
