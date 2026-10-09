import { Button } from "../../../../components/ui/button";
import { WorkspaceTabs } from "../../../../components/ui/workspace";
import { ProjectActivityTab } from "./ProjectActivityTab";
import { ProjectReportsTab } from "./ProjectReportsTab";
import { ProjectReviewsTab } from "./ProjectReviewsTab";
import type { ProjectCommandData } from "./types";
import { InspectorPanel } from "../../../../shared/motion";
export type ProjectTool = "reviews" | "activity" | "reports";
export function ProjectToolsInspector({
  tool,
  data,
  canExport,
  onOpenTask,
  onClose,
  onToolChange,
}: {
  tool: ProjectTool | null;
  data: ProjectCommandData;
  canExport: boolean;
  onOpenTask: (task: string) => void;
  onClose: () => void;
  onToolChange: (tool: ProjectTool) => void;
}) {
  if (!tool) return null;
  return (
    <InspectorPanel
      open
      onClose={onClose}
      ariaLabel="Project tools inspector"
      className="eflow-project-tools-inspector"
      layer={60}
    >
      <header className="eflow-project-tools-inspector__header">
        <div>
          <span className="eflow-project-tools-inspector__eyebrow">
            Project tools
          </span>
          <h2>{data.project.title}</h2>
        </div>
        <Button
          variant="ghost"
          aria-label="Close project tools"
          onClick={onClose}
        >
          Close
        </Button>
      </header>
      <div className="eflow-project-tools-inspector__body">
        <WorkspaceTabs
          value={tool}
          onValueChange={(value) => onToolChange(value as ProjectTool)}
          label="Project tool views"
          tabs={[
            {
              id: "reviews",
              label: "Reviews",
              content: (
                <ProjectReviewsTab data={data} onOpenTask={onOpenTask} />
              ),
            },
            {
              id: "activity",
              label: "Activity",
              content: <ProjectActivityTab data={data} />,
            },
            {
              id: "reports",
              label: "Reports",
              content: (
                <ProjectReportsTab
                  data={data}
                  canExport={canExport}
                  onOpenTask={onOpenTask}
                />
              ),
            },
          ]}
        />
      </div>
    </InspectorPanel>
  );
}
