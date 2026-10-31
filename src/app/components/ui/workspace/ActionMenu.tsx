import { useId, type ReactElement, type ReactNode } from "react";
import { WorkspaceTooltip } from "./WorkspaceTooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,DropdownMenuSub,DropdownMenuSubTrigger,DropdownMenuSubContent,DropdownMenuSeparator,
} from "../dropdown-menu";
export interface WorkspaceAction {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: WorkspaceAction[];
  disabled?: boolean;
  disabledReason?: string;
  variant?: "default" | "destructive";
  onSelect: () => void;
}
export function ActionMenu({
  trigger,
  actions,
  onCloseAutoFocus,
  side = "bottom",
  tooltip,
  open,
  onOpenChange,
  contentClassName = "",
}: {
  trigger: ReactElement;
  actions: WorkspaceAction[];
  onCloseAutoFocus?: (event: Event) => void;
  side?: "top" | "bottom";
  tooltip?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
}) {
  const menuId = useId();
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {tooltip ? <WorkspaceTooltip content={tooltip}><DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger></WorkspaceTooltip> : <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>}
      <DropdownMenuContent
        data-placement={side}
        side={side}
        className={`eflow-workspace-popover ${contentClassName}`}
        align="end"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {actions.map((action,index) => <MenuAction key={action.id} action={action} menuId={menuId} separate={action.variant==='destructive'&&index>0}/>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuAction({action,menuId,separate=false}:{action:WorkspaceAction;menuId:string;separate?:boolean}){
 const label=<>{action.icon}<span>{action.label}{action.disabled&&action.disabledReason&&<small id={`${menuId}-${action.id}`} className="block">{action.disabledReason}</small>}</span></>;
 return <>{separate&&<DropdownMenuSeparator/>}{action.children?.length?<DropdownMenuSub><DropdownMenuSubTrigger disabled={action.disabled} aria-label={action.label}>{label}</DropdownMenuSubTrigger><DropdownMenuSubContent className="eflow-workspace-popover">{action.children.map(child=><MenuAction key={child.id} action={child} menuId={menuId}/>)}</DropdownMenuSubContent></DropdownMenuSub>:<DropdownMenuItem variant={action.variant} aria-label={action.label} disabled={action.disabled} aria-describedby={action.disabled&&action.disabledReason?`${menuId}-${action.id}`:undefined} onSelect={action.onSelect}>{label}</DropdownMenuItem>}</>;
}
