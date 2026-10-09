import { useId, type ReactElement, type ReactNode } from "react";
import { WorkspaceTooltip } from "./WorkspaceTooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../dropdown-menu";
export interface WorkspaceAction {
  id: string;
  label: string;
  icon?: ReactNode;
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
}: {
  trigger: ReactElement;
  actions: WorkspaceAction[];
  onCloseAutoFocus?: (event: Event) => void;
  side?: "top" | "bottom";
  tooltip?: string;
}) {
  const menuId = useId();
  return (
    <DropdownMenu>
      {tooltip ? <WorkspaceTooltip content={tooltip}><DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger></WorkspaceTooltip> : <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>}
      <DropdownMenuContent
        data-placement={side}
        side={side}
        className="eflow-workspace-popover"
        align="end"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            variant={action.variant}
            aria-label={action.label}
            disabled={action.disabled}
            aria-describedby={
              action.disabled && action.disabledReason
                ? `${menuId}-${action.id}`
                : undefined
            }
            onSelect={action.onSelect}
          >
            {action.icon}
            <span>
              {action.label}
              {action.disabled && action.disabledReason && (
                <small id={`${menuId}-${action.id}`} className="block">
                  {action.disabledReason}
                </small>
              )}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
