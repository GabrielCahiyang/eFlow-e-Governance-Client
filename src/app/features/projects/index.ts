import { lazyFeature } from '../../shared/lazyFeature';
// Data/selectors must not synchronously pull their consuming workspace back in.
export const ProjectsWorkspace = lazyFeature(() => import('./components/ProjectsWorkspace').then(m => ({default:m.ProjectsWorkspace})),undefined,'ProjectsWorkspace');
export const HeadProjectsWorkspace = lazyFeature(() => import('./components/HeadProjectsWorkspace').then(m => ({default:m.HeadProjectsWorkspace})),undefined,'HeadProjectsWorkspace');
export const EmployeeProjectsWorkspace = lazyFeature(() => import('./components/EmployeeProjectsWorkspace').then(m => ({default:m.EmployeeProjectsWorkspace})),undefined,'EmployeeProjectsWorkspace');
export const ProjectCommandWorkspace = lazyFeature(() => import('./components/project-command/ProjectCommandWorkspace').then(m => ({default:m.ProjectCommandWorkspace})),undefined,'ProjectCommandWorkspace');
export * from "./selectors/projectCommandSelectors";
export * from "./selectors/proposalPortfolioSelectors";
export * from "./selectors/deadlines";
export type { ProjectScope } from "./components/model";
export * from "./services/projectService";
export {
  deleteEmptyProjectAfterTaskCleanup,
  findEmptyProjectCleanupCandidate,
  offerEmptyProjectCleanup,
} from "./services/emptyProjectCleanupService";
export type {
  EmptyProjectCleanupCandidate,
  EmptyProjectCleanupOutcome,
} from "./services/emptyProjectCleanupService";
export type { ProjectCommandData } from './components/project-command/types';
export const ProjectActivityHistory = lazyFeature(() => import('./components/project-command/ProjectActivityTab').then(m => ({default:m.ProjectActivityHistory})),undefined,'ProjectActivityHistory');
