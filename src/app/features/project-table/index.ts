import { createElement } from "react";
import { ProjectViewLoading } from "../../components/workflow/ProjectWorkspaceSkeleton";
import { lazyFeature } from "../../shared/lazyFeature";
export { CreateProjectDialog } from "./components/CreateProjectDialog";
export { ProjectTaskCreateAction } from './components/ProjectTaskCreateAction';
export const ProjectTableWorkspace = lazyFeature(
  () =>
    import("./components/ProjectTableWorkspace").then((module) => ({
      default: module.ProjectTableWorkspace,
    })),
  undefined,
  "ProjectTableWorkspace",
  createElement(ProjectViewLoading, { view: "tasks" }),
);
export type { ProjectGroup, ProjectColumn } from "./types";
export type { WorkspaceTaskPatch } from "./types";
export {
  visibleProjectTasks,
  tasksInGroup,
  visibleProjectGroups,
  inlineStatusOptions,
  canEditProjectTask,
  STATUS_COLORS,
} from "./selectors";
export type { TableSort } from "./selectors";
export { fetchProjectGroups, patchWorkspaceTask } from "./services/workspaceService";
export { timelineDraft, timelinePatch, timelineError, todayDate } from "./planningDraft";
