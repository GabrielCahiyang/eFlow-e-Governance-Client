import type { ReactElement, ReactNode } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../popover";
export function WorkspacePopover({trigger, children}: {trigger: ReactElement; children: ReactNode}) {
  return <Popover><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent className="eflow-workspace-popover" align="start">{children}</PopoverContent></Popover>;
}
