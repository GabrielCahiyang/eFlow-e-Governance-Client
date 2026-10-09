import { Tooltip } from "@vibe/core";
import type { ReactElement } from "react";

/** Supplemental help. Keep labels and essential guidance visible in the
 * trigger or its opened panel. Vibe supplies focus/Escape handling and portals. */
export function WorkspaceTooltip({ content, children }: { content: string; children: ReactElement }) {
  return <Tooltip content={<span role="tooltip">{content}</span>} position="bottom" showDelay={150} hideDelay={100} className="eflow-workspace-tooltip">{children}</Tooltip>;
}
