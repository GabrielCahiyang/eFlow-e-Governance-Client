import type { ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
export interface WorkspaceTab {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}
export function WorkspaceTabs({
  tabs,
  value,
  onValueChange,
  label = "Workspace views",
  orientation = "horizontal",
  className,
}: {
  tabs: WorkspaceTab[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <Tabs.Root
      orientation={orientation}
      className={className}
      value={encodeURIComponent(value)}
      onValueChange={(next) => onValueChange(decodeURIComponent(next))}
    >
      <Tabs.List className="eflow-workspace-tabs" aria-label={label}>
        {tabs.map((tab) => (
          <Tabs.Trigger
            className="eflow-workspace-tab"
            key={tab.id}
            value={encodeURIComponent(tab.id)}
            disabled={tab.disabled}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content
          className="eflow-workspace-panel"
          key={tab.id}
          value={encodeURIComponent(tab.id)}
        >
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
