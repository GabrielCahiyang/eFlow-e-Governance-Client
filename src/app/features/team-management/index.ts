import { lazyFeature } from "../../shared/lazyFeature";
export { useDepartmentTeamAnalytics } from "./hooks/useDepartmentTeamAnalytics";
export const EmployeeAnalyticsWorkspace=lazyFeature(()=>import('./components/analytics/EmployeeAnalyticsWorkspace').then(m=>({default:m.EmployeeAnalyticsWorkspace})),undefined,'EmployeeAnalyticsWorkspace');
export const OfficeIdentityAccessWorkspace = lazyFeature(() =>
  import("./components/supervision/OfficeIdentityAccessWorkspace").then(
    (module) => ({ default: module.OfficeIdentityAccessWorkspace }),
  ),
  undefined,
  "OfficeIdentityAccessWorkspace",
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
} from "./services/teamWorkflowFactsService";
