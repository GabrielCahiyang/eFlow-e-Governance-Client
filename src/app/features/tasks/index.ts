// Compatibility bridge: new consumers import task behavior from this feature.
export * from "./services/taskService";
export * from "./selectors";
export { calculateDeadlineWorkload, taskDurationHours, workingHoursBetween, workloadDeadline, HOURS_PER_TASK_DAY, taskEstimateError } from "./selectors/deadlineWorkload";
export type { DeadlineWorkload, WorkloadLevel } from "./selectors/deadlineWorkload";
export { deadlineInputParts, deadlineFromInputs, isValidCalendarDeadline } from "./selectors/deadlineInput";
export { withEmployeeDeadlineWorkload } from "./selectors/employeeDeadlineWorkload";
export { TaskDepartmentLabel, TaskDepartmentProvider } from "./components/TaskDepartmentLabel";
export { DeptHeadTaskBoardView } from "./components/DeptHeadTaskBoardView";
export { useDeptHeadTaskBoard } from "./hooks/useDeptHeadTaskBoard";
export { RecurringTaskTemplatesPanel } from "./components/RecurringTaskTemplatesPanel";
export { MondayBoard } from "./components/board/MondayBoard";
export { ScopedTaskKanban } from "./components/board/ScopedTaskKanban";
export type { MondayBoardProps } from "./components/board/model";
export { EmployeeTaskWorkspace } from "../../components/Employee/EmployeeTaskWorkspace";
export { YouAreLeadingView } from "../../components/workflow/YouAreLeadingView";
export { TaskDetailDrawer } from "../../components/workflow/TaskDetailDrawer";
export { TaskTeamEditorDialog } from "./components/team/TaskTeamEditorDialog";
export { TaskTeamMemberList } from "./components/team/TaskTeamMemberList";
export { AdminTaskOversight } from "./components/AdminTaskOversight";
export { resolveTaskDetailCapabilities } from "./components/taskDetailAccess";
export { cancelTask } from "./services/taskLifecycleService";
export { TaskStatusLabel } from "./presentation/TaskStatusLabel";
export { getTaskStatusPresentation } from "./presentation/taskStatusPresentation";
export type { TaskStatusPresentation, TaskStatusPresentationState } from "./presentation/taskStatusPresentation";
export { runTaskMaintenance } from "./services/taskMaintenanceService";
export {
  createTaskTemplate,
  deleteTaskTemplate,
  fetchTaskTemplates,
  setTaskTemplateActive,
} from "./services/taskTemplateService";
export type {
  RecurrenceFrequency,
  RecurrenceRule,
  TaskTemplate,
  TaskTemplateInput,
} from "./types";
