import type { ReactElement, ReactNode } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../popover";
import { WorkspaceTooltip } from "./WorkspaceTooltip";
export function WorkspacePopover({trigger, children, tooltip, open, onOpenChange}: {trigger: ReactElement; children: ReactNode; tooltip?: string; open?: boolean; onOpenChange?: (open:boolean)=>void}) {
  return <Popover open={open} onOpenChange={onOpenChange}>{tooltip ? <WorkspaceTooltip content={tooltip}><PopoverTrigger asChild>{trigger}</PopoverTrigger></WorkspaceTooltip> : <PopoverTrigger asChild>{trigger}</PopoverTrigger>}<PopoverContent className="eflow-workspace-popover" align="start">{children}</PopoverContent></Popover>;
}
