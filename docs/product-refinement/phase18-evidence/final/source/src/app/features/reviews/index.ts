import { lazyFeature } from "../../shared/lazyFeature";
export {
  type ForReviewInboxProps,
  type ReviewInboxScope,
} from "./components/ForReviewInbox";
export {
  TaskReviewPanel,
  type TaskReviewPanelProps,
} from "./components/TaskReviewPanel";
export { SubmitForReviewForm } from "../../components/workflow/SubmitForReviewForm";
export {
  fetchSubmissionAttachments,
  fetchTaskSubmissions,
} from "./services/reviewService";
export {
  canUserReviewTask,
  canOpenBudgetReviewWorkspace,
  getInitialReviewWorkspaceKind,
  isTaskVisibleInReviewQueue,
} from "./selectors";
export { SubtaskReviewInbox } from "./components/SubtaskReviewInbox";
export type {
  ReviewAttachment,
  ReviewSubmission,
  SubmissionDecision,
  TaskSubtaskReviewEvidence,
} from "./types";

export const ForReviewInbox = lazyFeature(
  () =>
    import("./components/ForReviewInbox").then((module) => ({
      default: module.ForReviewInbox,
    })),
  undefined,
  "ForReviewInbox",
);
export const LeaderReviewInbox = lazyFeature(
  () =>
    import("./components/ForReviewInbox").then((module) => ({
      default: module.LeaderReviewInbox,
    })),
  undefined,
  "LeaderReviewInbox",
);
