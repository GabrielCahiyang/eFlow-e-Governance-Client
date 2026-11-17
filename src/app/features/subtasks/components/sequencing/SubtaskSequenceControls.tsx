import { WorkspaceTooltip } from "../../../../components/ui/workspace/WorkspaceTooltip";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

export function SubtaskSequenceControls({
  index,
  total,
  disabled,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  index: number;
  total: number;
  disabled?: boolean;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" aria-label={`Sequence controls for step ${index + 1}`}>
      <WorkspaceTooltip content={disabled ? "Sequence is locked" : "Drag to reorder"}><span aria-label={disabled ? "Sequence is locked" : "Drag to reorder"}
        draggable={!disabled}
        onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; onDragStart(); }}
        onDragEnd={onDragEnd}
        className={`rounded-md p-1 text-neutral-400 ${disabled ? "cursor-not-allowed opacity-35" : "cursor-grab hover:bg-neutral-200 hover:text-neutral-700 active:cursor-grabbing"}`}
        role="img"
        tabIndex={disabled ? -1 : 0}

      ><GripVertical size={13} /></span></WorkspaceTooltip>
      <WorkspaceTooltip content="Move step up"><button aria-label="Move step up" type="button" disabled={disabled || index === 0} onClick={() => onMove(-1)} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-25" ><ArrowUp size={11} /></button></WorkspaceTooltip>
      <WorkspaceTooltip content="Move step down"><button aria-label="Move step down" type="button" disabled={disabled || index === total - 1} onClick={() => onMove(1)} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-25" ><ArrowDown size={11} /></button></WorkspaceTooltip>
    </div>
  );
}
