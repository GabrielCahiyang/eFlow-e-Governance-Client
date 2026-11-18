import { createElement } from "react";
import { InspectorSkeleton } from "../../components/ui/SurfaceSkeletons";
import { lazyFeature } from "../../shared/lazyFeature";
export * from "../../services/subtaskService";
export const SubtasksWorkspace = lazyFeature(
  () =>
    import("../../components/workflow/SubtasksWorkspace").then((module) => ({
      default: module.SubtasksWorkspace,
    })),
  undefined,
  "SubtasksWorkspace",
);
export { TaskSubtasksWidget } from "./components/TaskSubtasksWidget";
export { SubitemInspector, type SubitemInspectorProps } from "./components/SubitemInspector";
export { SubitemActionModal, type SubitemActionModalProps, type SubitemActionSection } from "./components/SubitemActionModal";
export { SubitemLeadReview } from "./components/SubitemLeadReview";
export type { SubtaskWorkDrawerProps } from "./components/SubtaskWorkDrawer";
export const SubtaskWorkDrawer = lazyFeature(
  () =>
    import("./components/SubtaskWorkDrawer").then((module) => ({
      default: module.SubtaskWorkDrawer,
    })),
  (props) => Boolean(props.subtask),
  "SubtaskWorkDrawer",
  (props) =>
    createElement(InspectorSkeleton, {
      presentation: props.presentation,
      label: "Loading subtask details…",
    }),
);
export { SubtaskDeadlineEditor } from "./components/SubtaskDeadlineEditor";
export { SubtaskProgressHistory } from "./components/SubtaskProgressHistory";
export { SubtaskSubmissionHistory } from "./components/SubtaskSubmissionHistory";
export { SubtaskReviewerBadge } from "./components/SubtaskReviewerBadge";
export { SubtaskSequenceControls } from "./components/sequencing/SubtaskSequenceControls";
export * from "./services/subtaskWorkflowService";
export * from "./services/subtaskReviewerService";
export type * from "./types";
export * from "./selectors/sequencing";
export * from "./selectors/deadlines";
export * from "./hooks/useTaskSubtasks";
export * from "./hooks/useSubtaskReviewerDirectory";

export { SubtaskEvidenceLink } from "./components/SubtaskEvidenceLink";
