import { lazyFeature } from "../../shared/lazyFeature";
export const TaskInspector = lazyFeature(
  () =>
    import("./components/TaskInspector").then((module) => ({
      default: module.TaskInspector,
    })),
  (props) => Boolean(props.task || props.taskId),
  "TaskInspector",
);
export { TaskInspector as TaskDetailDrawer };
export {
  useTaskInspector,
  type TaskInspectorOrigin,
} from "./hooks/useTaskInspector";
export { ProjectStatusBadge } from "../../components/workflow/StatusBadges";
export { TASK_INSPECTOR_SECTIONS, resolveTaskInspectorSection } from './types';
export type { TaskInspectorSection } from './types';

export {InspectorSurface} from './components/InspectorSurface';
