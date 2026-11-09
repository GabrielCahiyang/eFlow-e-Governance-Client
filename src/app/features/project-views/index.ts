import { createElement } from "react";
import { ProjectViewLoading } from "../../components/workflow/ProjectWorkspaceSkeleton";
import { lazyFeature } from "../../shared/lazyFeature";
export { ProjectViewFilters } from "./components/ProjectViewFilters";
export const TaskDatesDialog = lazyFeature(() =>
  import("./components/TaskDatesDialog").then((module) => ({
    default: module.TaskDatesDialog,
  })),
  undefined,
  "TaskDatesDialog",
);
export const ProjectGanttView = lazyFeature(() =>
  import("./components/ProjectGanttView").then((module) => ({
    default: module.ProjectGanttView,
  })),
  undefined,
  "ProjectGanttView",
  createElement(ProjectViewLoading, { view: "gantt" }),
);
export const ProjectOfficesView = lazyFeature(() =>
  import("./components/ProjectOfficesView").then((module) => ({
    default: module.ProjectOfficesView,
  })),
  undefined,
  "ProjectOfficesView",
  createElement(ProjectViewLoading, { view: "offices" }),
);
export const ProjectInsightsView = lazyFeature(() =>
  import("./components/ProjectInsightsView").then((module) => ({
    default: module.ProjectInsightsView,
  })),
  undefined,
  "ProjectInsightsView",
  createElement(ProjectViewLoading, { view: "dashboard" }),
);
export { useProjectViewActions } from "./hooks/useProjectViewActions";
export { useProjectReviewDates } from "./hooks/useProjectReviewDates";
export {
  filterProjectViewTasks,
  calendarDay,
  dayString,
  shiftedTaskDates,
  officeTaskSummaries,
  longestDependencyChain,
} from "./selectors";
export { EMPTY_PROJECT_FILTERS } from "./types";
export type { ProjectViewFilters as ProjectViewFilterState } from "./types";

export { matchesProjectDateRange, projectBoardMoveError } from "./selectors";
export { useProjectViewPreferences } from "./hooks/useProjectViewPreferences";
export { useProjectPresentation } from "./hooks/useProjectPresentation";
