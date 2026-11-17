import type { ReactElement, ReactNode } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../popover";
import { WorkspaceTooltip } from "./WorkspaceTooltip";
import { useState } from "react";
export function WorkspacePopover({trigger, children, tooltip, open, onOpenChange, contentClassName, collisionPadding}: {trigger: ReactElement; children: ReactNode; tooltip?: string; open?: boolean; onOpenChange?: (open:boolean)=>void; contentClassName?:string; collisionPadding?:number}) {
  const [localOpen, setLocalOpen] = useState(false);
  const popoverOpen = open ?? localOpen;
  return <Popover open={popoverOpen} onOpenChange={next => { setLocalOpen(next); onOpenChange?.(next); }}>{tooltip ? <WorkspaceTooltip content={tooltip} disabled={popoverOpen}><PopoverTrigger asChild>{trigger}</PopoverTrigger></WorkspaceTooltip> : <PopoverTrigger asChild>{trigger}</PopoverTrigger>}<PopoverContent className={['eflow-workspace-popover',contentClassName].filter(Boolean).join(' ')} align="start" collisionPadding={collisionPadding}>{children}</PopoverContent></Popover>;
}
