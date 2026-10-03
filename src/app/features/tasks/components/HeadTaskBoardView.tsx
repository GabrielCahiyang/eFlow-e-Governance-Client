import type { ComponentProps } from "react";
import { useState } from "react";
import { MondayBoard } from "./board/MondayBoard";

/**
 * Department Head task-board presentation boundary.
 *
 * Data scoping remains in the Department Head adapter so the current
 * organization and permission behavior stay unchanged while the board UI is
 * owned by the tasks feature.
 */
export function HeadTaskBoardView(
  props: ComponentProps<typeof MondayBoard>,
) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const activeProjectId = props.selectedProjectId ?? selectedProjectId;
  const onSelectProject = props.onSelectProject ?? setSelectedProjectId;

  return (
    <div className="eflow-operational-workspace min-h-full bg-neutral-50 p-4 sm:p-8">
      <MondayBoard
        {...props}
        selectedProjectId={activeProjectId}
        onSelectProject={onSelectProject}
      />
    </div>
  );
}
