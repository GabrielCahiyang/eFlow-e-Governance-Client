import { createElement } from "react";
import { CardSectionSkeleton } from "../../components/ui/SurfaceSkeletons";
import { ViewLoadingState } from "../../components/ui/ViewLoadingState";
import { ProjectViewLoading } from "../../components/workflow/ProjectWorkspaceSkeleton";
import { lazyFeature } from "../../shared/lazyFeature";
export { useDepartmentTeamAnalytics } from "./hooks/useDepartmentTeamAnalytics";
export const EmployeeAnalyticsWorkspace = lazyFeature(
  () =>
    import("./components/analytics/EmployeeAnalyticsWorkspace").then((m) => ({
      default: m.EmployeeAnalyticsWorkspace,
    })),
  undefined,
  "EmployeeAnalyticsWorkspace",
  (props) =>
    props?.home
      ? createElement(ProjectViewLoading, { view: "dashboard" })
      : createElement(ViewLoadingState),
);
export const OfficeIdentityAccessWorkspace = lazyFeature(
  () =>
    import("./components/supervision/OfficeIdentityAccessWorkspace").then(
      (module) => ({ default: module.OfficeIdentityAccessWorkspace }),
    ),
  undefined,
  "OfficeIdentityAccessWorkspace",
  (props) =>
    props?.embedded
      ? createElement(CardSectionSkeleton, {
          rows: 4,
          label: "Loading identity and access…",
        })
      : createElement(ViewLoadingState),
);
export {
  getTeamWorkloadBand,
  TEAM_WORKLOAD_ELEVATED_THRESHOLD,
  TEAM_WORKLOAD_HIGH_THRESHOLD,
} from "./constants";
export {
  buildSkillCoverage,
  buildTeamAttentionItems,
  buildTeamHealthSummary,
  buildTeamMemberMetrics,
  latestProgressByWorkItem,
  taskParticipantIds,
} from "./selectors/teamAnalyticsSelectors";
export type * from "./types";
export {
  fetchTeamWorkflowFacts,
  subscribeToTeamWorkflowFacts,
  warmTeamWorkflowFacts,
} from "./services/teamWorkflowFactsService";
