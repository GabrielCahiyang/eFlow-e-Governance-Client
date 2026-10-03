import type { ReactElement, ReactNode } from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../dropdown-menu";
export interface WorkspaceAction { id: string; label: string; icon?: ReactNode; disabled?: boolean; onSelect: () => void; }
export function ActionMenu({trigger, actions}: {trigger: ReactElement; actions: WorkspaceAction[]}) {
  return <DropdownMenu><DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger><DropdownMenuContent className="eflow-workspace-popover" align="end">{actions.map(action => <DropdownMenuItem key={action.id} disabled={action.disabled} onSelect={action.onSelect}>{action.icon}{action.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
