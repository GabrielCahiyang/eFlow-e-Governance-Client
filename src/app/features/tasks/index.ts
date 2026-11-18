import { createElement } from "react";
import { InspectorSkeleton } from "../../components/ui/SurfaceSkeletons";
import { ProjectViewLoading } from "../../components/workflow/ProjectWorkspaceSkeleton";
import { lazyFeature } from "../../shared/lazyFeature";
export {subscribeToProgressUpdates,type ProgressUpdate} from '../../services/taskDiscussionService';
// Compatibility bridge: new consumers import task behavior from this feature.
export * from "./services/taskService";
export * from "./selectors";
export {
  calculateDeadlineWorkload,
  workingHoursBetween,
  workloadDeadline,
} from "./selectors/deadlineWorkload";
export type {
  DeadlineWorkload,
  WorkloadLevel,
} from "./selectors/deadlineWorkload";
export {
  deadlineInputParts,
  deadlineFromInputs,
  isValidCalendarDeadline,
} from "./selectors/deadlineInput";
export { withEmployeeDeadlineWorkload } from "./selectors/employeeDeadlineWorkload";
export {
  TaskDepartmentLabel,
  TaskDepartmentProvider,
} from "./components/TaskDepartmentLabel";
export const HeadTaskBoardView = lazyFeature(() => import('./components/HeadTaskBoardView').then(m => ({default:m.HeadTaskBoardView})),undefined,'HeadTaskBoardView');
export { useHeadTaskBoard } from "./hooks/useHeadTaskBoard";
export { RecurringTaskTemplatesPanel } from "./components/RecurringTaskTemplatesPanel";
export const MondayBoard = lazyFeature(
  () =>
    import("./components/board/MondayBoard").then((module) => ({
      default: module.MondayBoard,
    })),
  undefined,
  "MondayBoard",
  createElement(ProjectViewLoading, { view: "board" }),
);
export { ScopedTaskKanban } from "./components/board/ScopedTaskKanban";
export type { MondayBoardProps } from "./components/board/model";
export const EmployeeTaskWorkspace = lazyFeature(() => import('../../components/Member/EmployeeTaskWorkspace').then(m => ({default:m.EmployeeTaskWorkspace})),undefined,'EmployeeTaskWorkspace');
export const TaskDetailDrawer = lazyFeature(
  () => import('../../components/workflow/TaskDetailDrawer').then(m => ({default:m.TaskDetailDrawer})),
  (props) => Boolean(props.task || props.taskId),
  'TaskDetailDrawer',
  (props) =>
    createElement(InspectorSkeleton, {
      presentation: props.presentation,
      label: "Loading task details…",
    }),
);
export { TaskTeamEditorDialog } from "./components/team/TaskTeamEditorDialog";
export { TaskTeamMemberList } from "./components/team/TaskTeamMemberList";
export const AdminTaskOversight = lazyFeature(() => import('./components/AdminTaskOversight').then(m => ({default:m.AdminTaskOversight})),undefined,'AdminTaskOversight');
export {
  resolveTaskDetailCapabilities,
  resolveSubtaskManagementCapability,
} from "./components/taskDetailAccess";
export { TaskStatusLabel } from "./presentation/TaskStatusLabel";
export { getTaskStatusPresentation } from "./presentation/taskStatusPresentation";
export type {
  TaskStatusPresentation,
  TaskStatusPresentationState,
} from "./presentation/taskStatusPresentation";
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
export { notifyTaskListeners } from "./services/taskRealtimeService";

export { TaskActivityTimeline } from "../../components/workflow/TaskActivityTimeline";
export { TaskDiscussion } from "../../components/workflow/TaskDiscussion";
export { ProgressUpdateForm } from "../../components/workflow/ProgressUpdateForm";

export {rowToTask} from './services/taskMapper';

export { fetchTaskById } from "./services/taskRealtimeService";
export { pendingTaskDependencies, taskStartBlocker } from './selectors/dependencyReadiness';
export { getTaskSubmissionReadiness } from './selectors/submissionReadiness';
export { TaskEvidenceRecovery } from './components/TaskEvidenceRecovery';
export { checkTaskExecution } from './services/taskExecutionAccess';
export { taskActivityDetails } from './selectors/taskActivityDetails';
