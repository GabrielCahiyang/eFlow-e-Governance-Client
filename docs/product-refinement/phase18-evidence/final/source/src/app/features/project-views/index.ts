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
);
export const ProjectOfficesView = lazyFeature(() =>
  import("./components/ProjectOfficesView").then((module) => ({
    default: module.ProjectOfficesView,
  })),
  undefined,
  "ProjectOfficesView",
);
export const ProjectInsightsView = lazyFeature(() =>
  import("./components/ProjectInsightsView").then((module) => ({
    default: module.ProjectInsightsView,
  })),
  undefined,
  "ProjectInsightsView",
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
