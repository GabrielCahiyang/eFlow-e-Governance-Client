import { useId, useState, type ReactElement, type ReactNode } from "react";
import { OctagonAlert } from "lucide-react";
import { WorkspaceTooltip } from "./WorkspaceTooltip";
import {
  ActionBlockersModal,
  normalizeBlockers,
  type ActionBlockerInput,
  type ActionBlockerItem,
} from "../action-blockers";
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
  blockers?: ActionBlockerInput;
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
  const [localOpen, setLocalOpen] = useState(false);
  const [blockerModal, setBlockerModal] = useState<{
    label: string;
    items: ActionBlockerItem[];
  } | null>(null);
  const menuOpen = open ?? localOpen;
  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={next => { setLocalOpen(next); onOpenChange?.(next); }}>
        {tooltip ? <WorkspaceTooltip content={tooltip} disabled={menuOpen}><DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger></WorkspaceTooltip> : <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>}
        <DropdownMenuContent
          data-placement={side}
          side={side}
          className={`eflow-workspace-popover ${contentClassName}`}
          align="end"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          {actions.map((action,index) => (
            <MenuAction
              key={action.id}
              action={action}
              menuId={menuId}
              separate={action.variant==='destructive'&&index>0}
              onInspectBlockers={(label, items) => setBlockerModal({ label, items })}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {blockerModal && (
        <ActionBlockersModal
          open
          actionLabel={blockerModal.label}
          blockers={blockerModal.items}
          onClose={() => setBlockerModal(null)}
        />
      )}
    </>
  );
}

function MenuAction({
  action,
  menuId,
  separate = false,
  onInspectBlockers,
}: {
  action: WorkspaceAction;
  menuId: string;
  separate?: boolean;
  onInspectBlockers: (label: string, items: ActionBlockerItem[]) => void;
}) {
  const normalizedBlockers = action.disabled
    ? normalizeBlockers(action.blockers ?? action.disabledReason)
    : [];
  const hasStopBlocker = action.disabled && normalizedBlockers.length > 0;

  if (action.children?.length) {
    const label = <>{action.icon}<span>{action.label}</span></>;
    return (
      <>
        {separate && <DropdownMenuSeparator />}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={action.disabled} aria-label={action.label}>
            {label}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="eflow-workspace-popover">
            {action.children.map(child => (
              <MenuAction
                key={child.id}
                action={child}
                menuId={menuId}
                onInspectBlockers={onInspectBlockers}
              />
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </>
    );
  }

  if (hasStopBlocker) {
    return (
      <>
        {separate && <DropdownMenuSeparator />}
        <DropdownMenuItem
          variant={action.variant}
          aria-label={`${action.label} — blocked (${normalizedBlockers.length} ${normalizedBlockers.length === 1 ? "blocker" : "blockers"})`}
          onSelect={() => onInspectBlockers(action.label, normalizedBlockers)}
        >
          <span className="eflow-action-menu-blocked">
            <span className="inline-flex items-center gap-2 opacity-65">
              {action.icon}
              <span>{action.label}</span>
            </span>
            <span className="eflow-action-menu-stop-tag" data-slot="action-blocker-stop">
              <OctagonAlert size={11} strokeWidth={2.3} aria-hidden="true" />
              {normalizedBlockers.length === 1 ? "Blocked" : `${normalizedBlockers.length}`}
            </span>
          </span>
        </DropdownMenuItem>
      </>
    );
  }

  const label = (
    <>
      {action.icon}
      <span>
        {action.label}
        {action.disabled && action.disabledReason && (
          <small id={`${menuId}-${action.id}`} className="block">{action.disabledReason}</small>
        )}
      </span>
    </>
  );

  return (
    <>
      {separate && <DropdownMenuSeparator />}
      <DropdownMenuItem
        variant={action.variant}
        aria-label={action.label}
        disabled={action.disabled}
        aria-describedby={action.disabled && action.disabledReason ? `${menuId}-${action.id}` : undefined}
        onSelect={action.onSelect}
      >
        {label}
      </DropdownMenuItem>
    </>
  );
}
