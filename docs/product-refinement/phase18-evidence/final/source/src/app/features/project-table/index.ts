import { lazyFeature } from "../../shared/lazyFeature";
export { CreateProjectDialog } from "./components/CreateProjectDialog";
export const ProjectTableWorkspace = lazyFeature(() =>
  import("./components/ProjectTableWorkspace").then((module) => ({
    default: module.ProjectTableWorkspace,
  })),
  undefined,
  "ProjectTableWorkspace",
);
export type { ProjectGroup, ProjectColumn } from "./types";
export type { WorkspaceTaskPatch } from "./types";
export {
  visibleProjectTasks,
  inlineStatusOptions,
  canEditProjectTask,
  STATUS_COLORS,
} from "./selectors";
export type { TableSort } from "./selectors";
export { patchWorkspaceTask } from "./services/workspaceService";
